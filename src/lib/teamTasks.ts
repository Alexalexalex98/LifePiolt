import { t } from '@/i18n/core';
import { myUserId } from '@/lib/teams';
import { sendMessage } from '@/lib/teamComms';
import { db, q, run, today } from '@/lib/teamWork';
import { newEventId } from '@/lib/workPlan';
import { fromTemplate, lateDigest, nextDue, type ProjectTemplate, type Priority, type Recurrence, type Status, type WTask } from '@/lib/workTasks';
import { mentionIds } from '@/lib/workComms';
import { usePeople } from '@/store/people';
import { useWTasks, type WProject } from '@/store/tasks';
import { useWorkspace } from '@/store/workspace';

/** Task e progetti sul server: condivisi con la squadra in tempo reale. Ogni permesso lo decide il server. */
const st = () => useWTasks.getState();
export async function pullTasks(team: string): Promise<void> {
  try {
    const rows = await q<WTask[]>((await db()).from('team_tasks').select('*').eq('team_id', team).order('created_at', { ascending: true }));
    st().setTasks(team, rows.filter((r) => !r.deleted));
    const ps = await q<WProject[]>((await db()).from('team_projects').select('*').eq('team_id', team));
    st().setProjects(team, ps);
  } catch { /* offline: restano quelli in memoria */ }
}
export async function watchTasks(team: string): Promise<() => void> {
  try {
    const c = await db();
    const ch = c.channel(`tasks-${team}`).on('postgres_changes', { event: '*', schema: 'public', table: 'team_tasks', filter: `team_id=eq.${team}` }, () => { void pullTasks(team); }).subscribe();
    const cp = c.channel(`projects-${team}`).on('postgres_changes', { event: '*', schema: 'public', table: 'team_projects', filter: `team_id=eq.${team}` }, () => { void pullTasks(team); }).subscribe();
    return () => { c.removeChannel(ch); c.removeChannel(cp); };
  } catch { return () => undefined; }
}

export type NewTask = { team: string; title: string; project?: string | null; assignee?: string | null; priority?: Priority; due?: string | null; est_min?: number | null; parent?: string | null; recurrence?: Recurrence; depends_on?: string[]; notes?: string };
export const createTask = (n: NewTask) => run(async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  const id = newEventId();
  await q((await db()).from('team_tasks').insert({ id, team_id: n.team, project: n.project ?? null, title: n.title.trim(), notes: n.notes ?? '', assignee: n.assignee ?? null, priority: n.priority ?? 'normal', due: n.due ?? null, est_min: n.est_min ?? null, parent: n.parent ?? null, recurrence: n.recurrence ?? 'none', depends_on: n.depends_on ?? [], created_by: me }));
  await pullTasks(n.team); return id;
});
export const updateTask = (task: WTask, patch: Partial<Pick<WTask, 'title' | 'notes' | 'assignee' | 'priority' | 'status' | 'due' | 'est_min' | 'parent' | 'depends_on' | 'recurrence' | 'block_reason' | 'project'>>) => run(async () => {
  await q((await db()).from('team_tasks').update(patch).eq('id', task.id));
  await pullTasks(task.team_id);
});
/** Cambia stato. Se un task che si ripete viene chiuso ne nasce subito il prossimo. */
export const setStatus = (task: WTask, status: Status, reason = '') => run(async () => {
  await q((await db()).from('team_tasks').update({ status, block_reason: status === 'blocked' ? reason.slice(0, 300) : '' }).eq('id', task.id));
  if (status === 'done' && task.status !== 'done' && task.recurrence !== 'none') {
    const me = await myUserId();
    if (me) await q((await db()).from('team_tasks').insert({ id: newEventId(), team_id: task.team_id, project: task.project, title: task.title, notes: task.notes, assignee: task.assignee, priority: task.priority, due: nextDue(task.due, task.recurrence, today()), est_min: task.est_min, recurrence: task.recurrence, created_by: me }));
  }
  await pullTasks(task.team_id);
});
export const deleteTask = (task: WTask) => run(async () => { await q((await db()).from('team_tasks').update({ deleted: true }).eq('id', task.id)); await pullTasks(task.team_id); });

/** Scheda del progetto (obiettivo, scadenza, stato): la crea la prima volta, poi la aggiorna. */
export const saveProject = (team: string, id: string, patch: Partial<Pick<WProject, 'goal' | 'due' | 'status'>>) => run(async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  const d = await db();
  const have = st().projects[team]?.some((p) => p.id === id);
  if (have) await q(d.from('team_projects').update(patch).eq('id', id));
  else await q(d.from('team_projects').insert({ id, team_id: team, goal: patch.goal ?? '', due: patch.due ?? null, status: patch.status ?? 'active', created_by: me }));
  await pullTasks(team);
});
/** Crea un progetto da un modello: la pagina condivisa, la scheda e tutti i task con le scadenze. */
export const createProjectFromTemplate = (team: string, tpl: ProjectTemplate, start: string, assignee: string | null) => run(async () => {
  const page = useWorkspace.getState().addPage(null, 'page', tpl.name, team);
  const goal = tpl.goal; const items = fromTemplate(tpl, start);
  const last = items.reduce((a, x) => (x.due > a ? x.due : a), start);
  const r = await saveProject(team, page, { goal, due: last }); if (!r.ok) throw new Error(r.message);
  for (const it of items) { const x = await createTask({ team, title: it.t, project: page, assignee, priority: it.prio, due: it.due }); if (!x.ok) throw new Error(x.message); }
  return page;
});

/* ---------- ore ---------- */
export type TimeRow = { id: string; task: string; user_id: string; day: string; minutes: number; note: string };
export const logTime = (task: WTask, minutes: number, note = '') => run(async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  await q((await db()).from('team_time').insert({ id: newEventId(), team_id: task.team_id, task: task.id, user_id: me, day: today(), minutes: Math.round(minutes), note: note.slice(0, 200) }));
});
export const timeOf = (task: string) => run(async () => q<TimeRow[]>((await db()).from('team_time').select('*').eq('task', task).order('day', { ascending: false })));

/** Theia avvisa i ritardatari: un messaggio nella chat del progetto con le persone citate. */
export async function alertLate(team: string, project: string | null): Promise<{ ok: boolean; message: string }> {
  const all = (st().tasks[team] ?? []).filter((x) => (project ? x.project === project : true));
  const people = (usePeople.getState().people[team] ?? []).map((p) => ({ id: p.user_id, name: p.name }));
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name || t('Collega');
  const d = lateDigest(all, today(), nameOf); if (!d) return { ok: true, message: t('Nessun task in ritardo.') };
  const r = await sendMessage(team, project ?? 'general', d.text, { mentions: [...new Set([...d.mentions, ...mentionIds(d.text, people)])] });
  return r.ok ? { ok: true, message: t('Ho avvisato le persone nella chat.') } : { ok: false, message: r.message };
}

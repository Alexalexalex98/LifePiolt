import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/T';
import { DayField } from '@/components/work/DayField';
import { NoWorkspace } from '@/components/work/NoWorkspace';
import { Body, Btn, Card, ChipBtn, Empty, H, Input, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { alertT } from '@/lib/alert';
import { go } from '@/lib/nav';
import { loadPeople, useCaps } from '@/lib/teamPeople';
import { alertLate, createProjectFromTemplate, createTask, deleteTask, logTime, pullTasks, saveProject, setStatus, timeOf, updateTask, watchTasks, type TimeRow } from '@/lib/teamTasks';
import { today } from '@/lib/teamWork';
import { addDays } from '@/lib/workHours';
import { planMyTasks } from '@/lib/planMine';
import { PRIORITY_LABEL, PROJECT_TEMPLATES, STATUS_LABEL, groupByStatus, isLate, lateTasks, progress, sortTasks, subtasksOf, waitingOn, type Priority, type Recurrence, type Status, type WTask } from '@/lib/workTasks';
import { usePeople } from '@/store/people';
import { useTasks as useTaskStore } from '@/store/tasksView';
import { useTeams } from '@/store/teams';
import { toast } from '@/store/toast';
import { useWork } from '@/store/work';
import { useWorkspace } from '@/store/workspace';
import { useWTasks } from '@/store/tasks';

const PRIO_COLOR: Record<Priority, string> = { urgent: '#ff5a64', high: '#e0a030', normal: '#8e98a8', low: '#6b7685' };
const day = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/** Task e progetti del workspace: elenco, kanban e calendario, responsabile, priorità, sottotask, dipendenze, ripetizioni, ore, pianificazione nel tuo orario. */
export function Tasks() {
  const th = useTheme();
  const teams = useTeams((s) => s.teams);
  const active = useWork((s) => s.active);
  const team = teams.find((x) => x.id === active) ?? teams[0];
  const all = useWTasks((s) => (team ? s.tasks[team.id] : undefined)) ?? [];
  const projects = useWTasks((s) => (team ? s.projects[team.id] : undefined)) ?? [];
  const pages = useWorkspace((s) => s.pages);
  const people = usePeople((s) => (team ? s.people[team.id] : undefined)) ?? [];
  const me = usePeople((s) => s.me);
  const { caps } = useCaps(team?.id);
  const { filter, view, project } = useTaskStore();
  const [open, setOpen] = useState<string | null>(null);
  const [neu, setNeu] = useState(false);
  const [tpl, setTpl] = useState(false);
  useEffect(() => { if (!team) return; void pullTasks(team.id); void loadPeople(team.id); let off: () => void = () => undefined; let dead = false; void watchTasks(team.id).then((f) => { if (dead) f(); else off = f; }); return () => { dead = true; off(); }; }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!team) return <NoWorkspace />;

  const nameOf = (id: string | null) => (id ? (id === me ? tl('Tu') : people.find((p) => p.user_id === id)?.name || tl('Collega')) : tl('Nessuno'));
  const t0 = today();
  const projPages = pages.filter((p) => p.teamId === team.id && p.parent === null && p.kind === 'page');
  const scoped = all.filter((x) => (project ? x.project === project : true));
  const shown = scoped.filter((x) => (filter === 'mine' ? x.assignee === me : filter === 'late' ? isLate(x, t0) : true));
  const proj = project ? projects.find((p) => p.id === project) : undefined;
  const pct = progress(scoped);
  const late = lateTasks(scoped, t0).length;
  const canAssign = caps.has('tasks.assign');

  const planMine = () => { const r = planMyTasks(team!.id, me); toast(r.message); };

  const card = (x: WTask) => {
    const subs = subtasksOf(x, all); const wait = waitingOn(x, all);
    return (
      <View key={x.id} style={{ backgroundColor: th.card, borderRadius: 14, borderWidth: 1, borderColor: th.border, padding: 10, marginBottom: 8 }}>
        <Row gap={8}>
          <View style={{ width: 8, height: 34, borderRadius: 4, backgroundColor: PRIO_COLOR[x.priority] }} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={{ color: th.text, fontWeight: '800', fontSize: 14.5, textDecorationLine: x.status === 'done' ? 'line-through' : 'none' }}>{x.title}</Text>
            <Text style={{ color: isLate(x, t0) ? '#ff5a64' : th.muted, fontSize: 12, marginTop: 2 }}>{[nameOf(x.assignee), x.due ? day(x.due) : '', isLate(x, t0) ? tl('in ritardo') : '', subs.length ? `${subs.filter((s) => s.status === 'done').length}/${subs.length}` : '', wait.length ? tl('aspetta {0}', wait[0]!.title) : '', x.status === 'blocked' && x.block_reason ? x.block_reason : ''].filter(Boolean).join(' · ')}</Text>
          </View>
          <ChipBtn icon="chevron-right" title="Apri" onPress={() => setOpen(x.id)} />
        </Row>
      </View>
    );
  };
  const cur = open ? all.find((x) => x.id === open) : undefined;

  return (
    <View style={{ gap: 14 }}>
      {teams.length > 1 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{teams.map((x) => <Pill key={x.id} label={x.name} on={x.id === team.id} onPress={() => { useWork.getState().set({ active: x.id }); useTaskStore.getState().set({ project: null }); }} />)}</View> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Pill label={tl('Tutti i progetti')} on={!project} onPress={() => useTaskStore.getState().set({ project: null })} />
        {projPages.map((p) => <Pill key={p.id} label={p.title || tl('Progetto')} on={project === p.id} onPress={() => useTaskStore.getState().set({ project: p.id })} />)}
      </ScrollView>

      <Card>
        <Row><View style={{ flex: 1 }}><H>{project ? (pages.find((p) => p.id === project)?.title || tl('Progetto')) : tl('Tutti i task')}</H><Body small muted>{`${pct}% ${tl('completato')}${late ? ` · ${late} ${tl('in ritardo')}` : ''}${proj?.due ? ` · ${tl('scadenza')} ${day(proj.due)}` : ''}`}</Body></View></Row>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: th.border, marginTop: 8 }}><View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: late ? '#e0a030' : th.accent }} /></View>
        {project ? <ProjectMeta team={team.id} id={project} goal={proj?.goal ?? ''} due={proj?.due ?? ''} status={proj?.status ?? 'active'} /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <Btn small icon="plus" title="Nuovo task" onPress={() => setNeu(true)} />
          {caps.has('projects.create') ? <Btn small ghost icon="note" title="Progetto da modello" onPress={() => setTpl(true)} /> : null}
          <Btn small ghost icon="calendar" title="Pianifica i miei task" onPress={planMine} />
          {canAssign && late ? <Btn small ghost icon="bell" title="Avvisa i ritardi" onPress={() => { void alertLate(team.id, project).then((r) => toast(r.message)); }} /> : null}
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {([['mine', 'I miei'], ['all', 'Tutti'], ['late', 'In ritardo']] as const).map(([k, l]) => <Pill key={k} label={tl(l)} on={filter === k} onPress={() => useTaskStore.getState().set({ filter: k })} />)}
        <View style={{ width: 8 }} />
        {([['list', 'Elenco'], ['kanban', 'Kanban'], ['cal', 'Calendario']] as const).map(([k, l]) => <Pill key={k} label={tl(l)} on={view === k} onPress={() => useTaskStore.getState().set({ view: k })} />)}
      </View>

      {shown.length === 0 ? <Card><Empty text={filter === 'mine' ? 'Nessun task per te. Creane uno o guarda «Tutti».' : 'Nessun task qui.'} /></Card> : view === 'kanban' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {(Object.entries(groupByStatus(shown)) as [Status, WTask[]][]).map(([s, list]) => (
            <View key={s} style={{ width: 270 }}><Body small bold muted style={{ marginBottom: 6 }}>{`${tl(STATUS_LABEL[s]).toUpperCase()} · ${list.length}`}</Body>{list.map(card)}</View>
          ))}
        </ScrollView>
      ) : view === 'cal' ? (
        <View>
          {Array.from({ length: 14 }, (_, i) => addDays(t0, i)).map((d) => { const l = sortTasks(shown.filter((x) => x.due === d && x.status !== 'done' && !x.parent)); return l.length ? <View key={d} style={{ marginBottom: 6 }}><Body small bold muted style={{ marginBottom: 6 }}>{day(d).toUpperCase()}</Body>{l.map(card)}</View> : null; })}
          {sortTasks(shown.filter((x) => x.due && x.due < t0 && x.status !== 'done' && !x.parent)).length ? <View><Body small bold color="#ff5a64" style={{ marginBottom: 6 }}>{tl('IN RITARDO').toUpperCase()}</Body>{sortTasks(shown.filter((x) => x.due && x.due < t0 && x.status !== 'done' && !x.parent)).map(card)}</View> : null}
          {sortTasks(shown.filter((x) => !x.due && x.status !== 'done' && !x.parent)).length ? <View><Body small bold muted style={{ marginBottom: 6 }}>{tl('SENZA SCADENZA').toUpperCase()}</Body>{sortTasks(shown.filter((x) => !x.due && x.status !== 'done' && !x.parent)).map(card)}</View> : null}
        </View>
      ) : <View>{(['doing', 'blocked', 'todo', 'done'] as Status[]).map((s) => { const l = groupByStatus(shown)[s]; return l.length ? <View key={s} style={{ marginBottom: 6 }}><Body small bold muted style={{ marginBottom: 6 }}>{`${tl(STATUS_LABEL[s]).toUpperCase()} · ${l.length}`}</Body>{l.map(card)}</View> : null; })}</View>}

      <NewTask team={team.id} open={neu} onClose={() => setNeu(false)} project={project} canAssign={canAssign} me={me} people={people.map((p) => ({ id: p.user_id, name: p.name }))} projects={projPages.map((p) => ({ id: p.id, name: p.title }))} />
      <TemplateSheet team={team.id} open={tpl} onClose={() => setTpl(false)} />
      {cur ? <TaskSheet task={cur} all={all} me={me} canAssign={canAssign} nameOf={nameOf} people={people.map((p) => ({ id: p.user_id, name: p.name }))} onClose={() => setOpen(null)} /> : null}
    </View>
  );
}

function ProjectMeta({ team, id, goal, due, status }: { team: string; id: string; goal: string; due: string; status: 'active' | 'paused' | 'done' }) {
  const [g, setG] = useState(goal); const [d, setD] = useState(due);
  useEffect(() => { setG(goal); setD(due); }, [goal, due, id]);
  const save = (patch: { goal?: string; due?: string | null; status?: 'active' | 'paused' | 'done' }) => { void saveProject(team, id, patch).then((r) => { if (!r.ok) toast(r.message); }); };
  return (
    <View style={{ marginTop: 10 }}>
      <Input placeholder="Obiettivo del progetto" value={g} onChangeText={setG} onBlur={() => { if (g !== goal) save({ goal: g }); }} maxLines={3} />
      <Row><Input flex={1} placeholder="Scadenza (2026-12-31)" value={d} onChangeText={setD} onBlur={() => { if (d !== due && (/^\d{4}-\d{2}-\d{2}$/.test(d) || !d)) save({ due: d || null }); }} /></Row>
      <View style={{ flexDirection: 'row', gap: 8 }}>{([['active', 'Attivo'], ['paused', 'In pausa'], ['done', 'Finito']] as const).map(([k, l]) => <Pill key={k} label={tl(l)} on={status === k} onPress={() => save({ status: k })} />)}</View>
    </View>
  );
}

function NewTask({ team, open, onClose, project, canAssign, me, people, projects }: { team: string; open: boolean; onClose: () => void; project: string | null; canAssign: boolean; me: string | null; people: { id: string; name: string }[]; projects: { id: string; name: string }[] }) {
  const [title, setTitle] = useState(''); const [proj, setProj] = useState<string | null>(project); const [who, setWho] = useState<string | null>(me);
  const [prio, setPrio] = useState<Priority>('normal'); const [due, setDue] = useState(''); const [est, setEst] = useState<number | null>(null); const [rec, setRec] = useState<Recurrence>('none');
  useEffect(() => { if (open) { setProj(project); setWho(me); } }, [open, project, me]);
  const save = () => {
    if (!title.trim()) { toast('Scrivi che cosa va fatto'); return; }
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) { toast('Scrivi la scadenza come 2026-12-31'); return; }
    void createTask({ team, title, project: proj, assignee: who, priority: prio, due: due || null, est_min: est, recurrence: rec }).then((r) => { if (r.ok) { toast('Task creato'); setTitle(''); setDue(''); setEst(null); setRec('none'); setPrio('normal'); onClose(); } else toast(r.message); });
  };
  const chips = <T,>(label: string, items: { k: T; l: string }[], val: T, set: (v: T) => void) => (<><Body small bold muted style={{ marginBottom: 6 }}>{tl(label).toUpperCase()}</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>{items.map((i) => <Pill key={String(i.k)} label={i.l} on={val === i.k} onPress={() => set(i.k)} />)}</View></>);
  return (
    <Sheet visible={open} title="Nuovo task" onClose={onClose}>
      <Input placeholder="Che cosa va fatto?" value={title} onChangeText={setTitle} />
      {projects.length ? chips('Progetto', [{ k: null as string | null, l: tl('Nessuno') }, ...projects.map((p) => ({ k: p.id as string | null, l: p.name || tl('Progetto') }))], proj, setProj) : null}
      {canAssign ? chips('Responsabile', [{ k: null as string | null, l: tl('Nessuno') }, ...people.map((p) => ({ k: p.id as string | null, l: p.id === me ? tl('Io') : p.name || tl('Collega') }))], who, setWho) : null}
      {chips('Priorità', (Object.keys(PRIORITY_LABEL) as Priority[]).map((k) => ({ k, l: tl(PRIORITY_LABEL[k]) })), prio, setPrio)}
      <DayField value={due} onChange={setDue} placeholder="Scadenza (scegli dal Plan)" />
      {chips('Tempo previsto', [{ k: null as number | null, l: tl('Non so') }, ...[30, 60, 120, 240].map((m) => ({ k: m as number | null, l: m < 60 ? `${m} min` : `${m / 60} h` }))], est, setEst)}
      {chips('Si ripete', [{ k: 'none' as Recurrence, l: tl('No') }, { k: 'daily' as Recurrence, l: tl('Ogni giorno') }, { k: 'weekly' as Recurrence, l: tl('Ogni settimana') }, { k: 'monthly' as Recurrence, l: tl('Ogni mese') }], rec, setRec)}
      <Btn icon="check" title="Crea task" onPress={save} />
    </Sheet>
  );
}

function TemplateSheet({ team, open, onClose }: { team: string; open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false); const me = usePeople((s) => s.me);
  return (
    <Sheet visible={open} title="Progetto da modello" onClose={onClose}>
      <Body small muted style={{ marginBottom: 8 }}>Crea il progetto con tutti i task e le scadenze già pronte, a partire da oggi. Poi li modifichi come vuoi.</Body>
      {PROJECT_TEMPLATES.map((p) => <Btn key={p.id} ghost disabled={busy} style={{ marginTop: 6 }} title={`${tl(p.name)} · ${p.tasks.length} ${tl('task')}`} onPress={() => { setBusy(true); void createProjectFromTemplate(team, p, today(), me).then((r) => { setBusy(false); if (r.ok) { toast('Progetto creato'); useTaskStore.getState().set({ project: r.data }); onClose(); } else toast(r.message); }); }} />)}
    </Sheet>
  );
}

function TaskSheet({ task, all, me, canAssign, nameOf, people, onClose }: { task: WTask; all: WTask[]; me: string | null; canAssign: boolean; nameOf: (id: string | null) => string; people: { id: string; name: string }[]; onClose: () => void }) {
  const [title, setTitle] = useState(task.title); const [due, setDue] = useState(task.due ?? ''); const [reason, setReason] = useState(task.block_reason);
  const [sub, setSub] = useState(''); const [mins, setMins] = useState(''); const [times, setTimes] = useState<TimeRow[]>([]);
  useEffect(() => { void timeOf(task.id).then((r) => { if (r.ok) setTimes(r.data); }); }, [task.id]);
  const subs = subtasksOf(task, all); const wait = waitingOn(task, all);
  const mine = task.created_by === me || task.assignee === me || canAssign;
  const total = times.reduce((a, x) => a + x.minutes, 0);
  const others = all.filter((x) => x.id !== task.id && x.project === task.project && !x.parent && x.status !== 'done').slice(0, 8);
  const patch = (p: Parameters<typeof updateTask>[1]) => { void updateTask(task, p).then((r) => { if (!r.ok) toast(r.message); }); };
  return (
    <Sheet visible title={task.title} onClose={onClose}>
      {wait.length ? <Body small bold color="#e0a030" style={{ marginBottom: 6 }}>{tl('Aspetta: {0}', wait.map((x) => x.title).join(', '))}</Body> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <Pill key={s} label={tl(STATUS_LABEL[s])} on={task.status === s} onPress={() => { if (!mine) { toast('Non puoi cambiare questo task'); return; } if (s === 'blocked' && !reason.trim()) { toast('Scrivi qui sotto che cosa lo blocca'); } void setStatus(task, s, reason).then((r) => { if (!r.ok) toast(r.message); else if (s === 'done' && task.recurrence !== 'none') toast('Fatto: ho creato il prossimo'); }); }} />)}
      </View>
      {task.status === 'blocked' || reason ? <Input placeholder="Che cosa lo blocca?" value={reason} onChangeText={setReason} onBlur={() => { if (reason !== task.block_reason && task.status === 'blocked') void setStatus(task, 'blocked', reason); }} /> : null}
      {mine ? (
        <>
          <Input value={title} onChangeText={setTitle} onBlur={() => { if (title.trim() && title !== task.title) patch({ title: title.trim() }); }} />
          <Input placeholder="Scadenza (2026-12-31)" value={due} onChangeText={setDue} onBlur={() => { if (due !== (task.due ?? '') && (!due || /^\d{4}-\d{2}-\d{2}$/.test(due))) patch({ due: due || null }); }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>{(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => <Pill key={p} label={tl(PRIORITY_LABEL[p])} on={task.priority === p} onPress={() => patch({ priority: p })} />)}</View>
        </>
      ) : <Body small muted>{`${tl(PRIORITY_LABEL[task.priority])} · ${task.due ? day(task.due) : tl('senza scadenza')}`}</Body>}
      {canAssign ? (<><Body small bold muted style={{ marginBottom: 6 }}>{tl('RESPONSABILE').toUpperCase()}</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}><Pill label={tl('Nessuno')} on={!task.assignee} onPress={() => patch({ assignee: null })} />{people.map((p) => <Pill key={p.id} label={p.id === me ? tl('Io') : p.name || tl('Collega')} on={task.assignee === p.id} onPress={() => patch({ assignee: p.id })} />)}</View></>) : <Body small muted>{tl('Responsabile: {0}', nameOf(task.assignee))}</Body>}

      <Body small bold muted style={{ marginTop: 6, marginBottom: 6 }}>{tl('SOTTOTASK').toUpperCase()}</Body>
      {subs.map((s) => <Row key={s.id} style={{ marginBottom: 4 }}><Body small style={{ flex: 1, textDecorationLine: s.status === 'done' ? 'line-through' : 'none' }}>{s.title}</Body><ChipBtn icon="check" title={s.status === 'done' ? 'Riapri' : 'Fatto'} onPress={() => { void setStatus(s, s.status === 'done' ? 'todo' : 'done').then((r) => { if (!r.ok) toast(r.message); }); }} /></Row>)}
      <Row><Input flex={1} style={{ marginBottom: 0 }} placeholder="Aggiungi un passaggio" value={sub} onChangeText={setSub} /><Btn small icon="plus" title="" label="Aggiungi" onPress={() => { if (!sub.trim()) return; void createTask({ team: task.team_id, title: sub, project: task.project, parent: task.id, assignee: task.assignee }).then((r) => { if (r.ok) setSub(''); else toast(r.message); }); }} /></Row>

      {mine && others.length ? (<><Body small bold muted style={{ marginTop: 10, marginBottom: 6 }}>{tl('PARTE DOPO').toUpperCase()}</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{others.map((o) => <Pill key={o.id} label={o.title.slice(0, 28)} on={task.depends_on.includes(o.id)} onPress={() => patch({ depends_on: task.depends_on.includes(o.id) ? task.depends_on.filter((x) => x !== o.id) : [...task.depends_on, o.id] })} />)}</View></>) : null}
      {mine ? (<><Body small bold muted style={{ marginTop: 10, marginBottom: 6 }}>{tl('SI RIPETE').toUpperCase()}</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{([['none', 'No'], ['daily', 'Ogni giorno'], ['weekly', 'Ogni settimana'], ['monthly', 'Ogni mese']] as const).map(([k, l]) => <Pill key={k} label={tl(l)} on={task.recurrence === k} onPress={() => patch({ recurrence: k })} />)}</View></>) : null}

      <Body small bold muted style={{ marginTop: 10, marginBottom: 6 }}>{tl('ORE LAVORATE').toUpperCase()}</Body>
      <Body small muted>{total ? `${Math.floor(total / 60)} h ${total % 60} min${task.est_min ? ` ${tl('su')} ${Math.round(task.est_min / 60 * 10) / 10} h ${tl('previste')}` : ''}` : tl('Nessuna ora registrata.')}</Body>
      <Row style={{ marginTop: 6 }}><Input flex={1} style={{ marginBottom: 0 }} placeholder="Minuti (es. 45)" value={mins} onChangeText={setMins} keyboardType="number-pad" /><Btn small icon="clock" title="" label="Registra" onPress={() => { const m = parseInt(mins, 10); if (!m || m < 1 || m > 1440) { toast('Scrivi i minuti'); return; } void logTime(task, m).then((r) => { if (r.ok) { setMins(''); void timeOf(task.id).then((x) => { if (x.ok) setTimes(x.data); }); toast('Ore registrate'); } else toast(r.message); }); }} /></Row>
      {mine ? <Btn style={{ marginTop: 12 }} ghost danger icon="trash" title="Elimina il task" onPress={() => alertT('Eliminare il task?', task.title, [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => { void deleteTask(task).then((r) => { if (r.ok) onClose(); else toast(r.message); }); } }])} /> : null}
    </Sheet>
  );
}

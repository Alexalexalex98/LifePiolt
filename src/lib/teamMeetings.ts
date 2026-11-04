import { t } from '@/i18n/core';
import { supa } from '@/lib/accountApi';
import { buildNotes, type CallNotes } from '@/lib/callNotes';
import { actionsOf, buildMinutes, nextOccurrence, type Line, type Meeting } from '@/lib/meetings';
import { listMembers, myUserId, type Res } from '@/lib/teams';
import { db, pushWorkEvent, q, removeWorkEvent, run } from '@/lib/teamWork';
import { WORK_COLOR_ID, newEventId } from '@/lib/workPlan';
import { useLife } from '@/store/life';
import { useMeetings } from '@/store/meetings';
import { useWorkspace } from '@/store/workspace';

/** Riunioni di lavoro sul server: ogni persona invitata vede la riunione, chi sta trascrivendo e le righe che arrivano dagli altri. */
const st = () => useMeetings.getState();
const put = (m: Meeting) => st().set({ items: m.deleted ? st().items.filter((x) => x.id !== m.id) : st().items.some((x) => x.id === m.id) ? st().items.map((x) => (x.id === m.id ? m : x)) : [...st().items, m] });

export async function pullMeetings(team: string): Promise<void> {
  try {
    const rows = await q<Meeting[]>((await db()).from('team_meetings').select('*').eq('team_id', team));
    st().set({ items: [...st().items.filter((x) => x.team_id !== team), ...rows.filter((r) => !r.deleted)] });
  } catch { /* offline: restano quelle sul telefono */ }
}

export type NewMeeting = { team: string; project?: string | null; title: string; day: string; time: string; dur: number; agenda?: string; attendees: string[]; recurrence?: Meeting['recurrence'] };
/** Crea la riunione e il suo impegno nel Plan (etichetta Lavoro) di tutti gli invitati. */
export const createMeeting = (m: NewMeeting) => run(async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  const id = newEventId(); const wid = newEventId();
  const row = { id, team_id: m.team, project: m.project ?? null, title: m.title.trim(), day: m.day, time: m.time, dur: m.dur, agenda: m.agenda ?? '', attendees: m.attendees.filter((x) => x !== me), created_by: me, recurrence: m.recurrence ?? 'none', event_id: wid };
  await q((await db()).from('team_meetings').insert(row));
  const ev = { time: m.time, title: m.title.trim(), dur: m.dur, color: WORK_COLOR_ID, team: m.team, wid, with: row.attendees, by: me, kind: 'meeting' as const, ...(m.project ? { proj: m.project } : {}) };
  useLife.getState().addEvent(m.day, ev);
  await pushWorkEvent(m.day, ev);
  const full: Meeting = { ...row, status: 'scheduled', rec_by: null, rec_users: [], notes: null, minutes: null } as Meeting;
  put(full);
  return full;
});

/** Cambia titolo, orario, ordine del giorno, invitati; l'impegno nel Plan si aggiorna insieme. */
export const updateMeeting = (id: string, patch: Partial<Pick<Meeting, 'title' | 'day' | 'time' | 'dur' | 'agenda' | 'attendees' | 'recurrence'>>) => run(async () => {
  const cur = st().items.find((x) => x.id === id); if (!cur) throw new Error(t('Riunione non trovata.'));
  await q((await db()).from('team_meetings').update(patch).eq('id', id));
  const next = { ...cur, ...patch }; put(next);
  if (cur.event_id && (patch.title || patch.day || patch.time || patch.dur || patch.attendees)) {
    const me = await myUserId();
    const evs = useLife.getState().events;
    for (const [d, l] of Object.entries(evs)) { const i = l.findIndex((e) => e.wid === cur.event_id); if (i >= 0) useLife.getState().delEvent(d, i); }
    const ev = { time: next.time, title: next.title, dur: next.dur, color: WORK_COLOR_ID, team: next.team_id, wid: cur.event_id, with: next.attendees, by: me ?? undefined, kind: 'meeting' as const, ...(next.project ? { proj: next.project } : {}) };
    useLife.getState().addEvent(next.day, ev);
    await pushWorkEvent(next.day, ev);
  }
});

export const removeMeeting = (id: string) => run(async () => {
  const cur = st().items.find((x) => x.id === id);
  await q((await db()).from('team_meetings').update({ deleted: true }).eq('id', id));
  put({ ...(cur as Meeting), deleted: true });
  if (cur?.event_id) {
    await removeWorkEvent(cur.event_id);
    for (const [d, l] of Object.entries(useLife.getState().events)) { const i = l.findIndex((e) => e.wid === cur.event_id); if (i >= 0) useLife.getState().delEvent(d, i); }
  }
});

/** Entra nella riunione: registrazione e trascrizione partono da sole (lo dice la policy). */
export const joinMeeting = (id: string) => run(async () => { const m = await (await supa()).rpc<Meeting>('team_meeting_join', { p_id: id }); if (m) put(m); return m; });
/** Esce. Se eri l'ultimo la riunione si chiude: appunti, verbale e cose da fare si salvano da soli nel progetto. */
export const leaveMeeting = (id: string) => run(async () => {
  const m = await (await supa()).rpc<Meeting>('team_meeting_leave', { p_id: id }); if (!m) return null;
  put(m);
  if (m.status === 'ended' && !m.notes) {
    const lines = await loadLines(id);
    const r = await finishMeeting(m, lines);
    if (r.ok) { const full = st().items.find((x) => x.id === id); if (full) saveToWorkspace(full); }
  }
  return m;
});

/** Nome da mostrare nel Plan: «Meeting · nome del progetto». */
export const meetingLabel = (proj?: string): string => { const n = proj ? useWorkspace.getState().pages.find((p) => p.id === proj)?.title : ''; return n ? `${t('Meeting')} · ${n}` : t('Meeting'); };

/** Salva la riunione finita nel workspace: verbale in una pagina «Meeting · progetto» e cose da fare nel database condiviso. */
export function saveToWorkspace(m: Meeting): void {
  const ws = useWorkspace.getState();
  const page = ws.addPage(m.project ?? null, 'page', `${meetingLabel(m.project ?? undefined)} · ${m.day}`, m.team_id);
  const body = (m.minutes ?? '').split('\n');
  const first = useWorkspace.getState().pages.find((p) => p.id === page)?.blocks[0];
  if (first) ws.patchBlock(page, first.id, { text: body[0] ?? '' });
  body.slice(1).forEach((l) => ws.addBlock(page, 'p', l));
  const acts = m.notes?.actions ?? [];
  if (!acts.length) return;
  const nm = t('Cose da fare'); const owner = t('Responsabile'); const due = t('Scadenza');
  let dbId = useWorkspace.getState().pages.find((p) => p.teamId === m.team_id && p.kind === 'db' && p.title === nm)?.id;
  if (!dbId) { dbId = ws.addPage(null, 'db', nm, m.team_id); ws.addCol(dbId, owner, 'text'); ws.addCol(dbId, due, 'date'); }
  const cols = useWorkspace.getState().pages.find((p) => p.id === dbId)?.cols ?? [];
  const oc = cols.find((c) => c.name === owner)?.id; const dc = cols.find((c) => c.name === due)?.id;
  for (const a of actionsOf(m.notes, '', new Date())) {
    const rid = ws.addRow(dbId); ws.patchRow(dbId, rid, cols[0]!.id, a.text);
    if (oc) ws.patchRow(dbId, rid, oc, a.owner); if (dc && a.due) ws.patchRow(dbId, rid, dc, a.due);
  }
}
/** Le tue cose da fare della riunione nel tuo Plan (con l'etichetta «Lavoro»). Una sola volta per riunione. */
export function addMyActions(m: Meeting, myName: string): number {
  let n = 0;
  for (const a of actionsOf(m.notes, myName, new Date())) if (a.mine) { useLife.getState().addTask({ t: a.text, team: m.team_id, ...(a.due ? { due: a.due } : {}) }); n++; }
  return n;
}

export const sendLine = (id: string, at: number, text: string) => run(async () => { await (await supa()).rpc('team_meeting_line', { p_id: id, p_at: Math.max(0, Math.round(at)), p_text: text }); });

export async function loadLines(id: string): Promise<Line[]> {
  try {
    const rows = await q<Line[]>((await db()).from('team_meeting_lines').select('id,speaker,at,text').eq('meeting_id', id).order('at', { ascending: true }));
    st().set({ lines: { ...st().lines, [id]: rows } });
    return rows;
  } catch { return st().lines[id] ?? []; }
}

/** Resta in ascolto di una riunione aperta: cambi di stato, chi trascrive e nuove righe degli altri. */
export async function watchMeeting(id: string): Promise<() => void> {
  try {
    const c = await db();
    const a = c.channel(`meeting-${id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'team_meetings', filter: `id=eq.${id}` }, (p: { new?: Meeting }) => { if (p?.new?.id) put(p.new); }).subscribe();
    const b = c.channel(`meeting-lines-${id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_meeting_lines', filter: `meeting_id=eq.${id}` }, () => { void loadLines(id); }).subscribe();
    return () => { c.removeChannel(a); c.removeChannel(b); };
  } catch { return () => undefined; }
}

/** Chiude la riunione: appunti (decisioni, da fare, domande) e verbale salvati per tutti. Se è ricorrente fissa la prossima. */
export async function finishMeeting(m: Meeting, lines: Line[]): Promise<Res<{ notes: CallNotes; minutes: string }>> {
  return run(async () => {
    const members = await listMembers(m.team_id); const names = new Map(members.ok ? members.data.map((x) => [x.user_id, x.name || t('Collega')]) : []);
    const nameOf = (u: string) => names.get(u) ?? t('Collega');
    const notes = buildNotes(lines.map((l) => ({ at: l.at, speaker: nameOf(l.speaker), text: l.text })));
    const minutes = buildMinutes({ title: m.title, day: m.day, time: m.time, names: [m.created_by, ...m.attendees].map(nameOf), agenda: m.agenda, notes, lines, nameOf });
    await (await supa()).rpc('team_meeting_end', { p_id: m.id, p_notes: notes, p_minutes: minutes });
    put({ ...m, status: 'ended', rec_users: [], rec_by: null, notes, minutes });
    const nx = nextOccurrence(m.day, m.recurrence);
    if (nx) void createMeeting({ team: m.team_id, project: m.project, title: m.title, day: nx, time: m.time, dur: m.dur, agenda: m.agenda, attendees: m.attendees, recurrence: m.recurrence });
    return { notes, minutes };
  });
}

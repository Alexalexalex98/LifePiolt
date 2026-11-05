import { t } from '@/i18n/core';
import { supa } from '@/lib/accountApi';
import { myUserId, raw, type Res } from '@/lib/teams';
import type { Range, Schedule } from '@/lib/workHours';
import { fromMin, toMin } from '@/lib/workHours';
import { mergeWork, toWireEvent, type CalLike, type WireEvent } from '@/lib/workPlan';
import { incomingConflicts } from '@/lib/conflicts';
import { useConflicts, type Clash } from '@/store/conflicts';
import { useLife } from '@/store/life';
import { useTeams } from '@/store/teams';
import { useWork, type Absence } from '@/store/work';

/** Pianificazione del lavoro sul server: orari, impegni condivisi, assenze, occupato/libero. Ogni permesso lo decide il server. */
export type LQ = { insert(v: unknown): LQ; select(c?: string): LQ; eq(c: string, v: unknown): LQ; gte(c: string, v: unknown): LQ; upsert(v: unknown): LQ; update(v: unknown): LQ; order(c: string, o?: { ascending: boolean }): LQ; limit(n: number): LQ; delete(): LQ; then: PromiseLike<{ data: unknown; error: { message?: string } | null }>['then'] };
export type Db = { from(t: string): LQ; channel(n: string): { on(...a: unknown[]): { subscribe(cb?: (s: string) => void): unknown } }; removeChannel(c: unknown): unknown };
export const db = async () => (await raw()) as unknown as Db;
export const q = async <T,>(p: LQ): Promise<T> => { const r = await (p as unknown as Promise<{ data: unknown; error: { message?: string } | null }>); if (r.error) throw new Error(r.error.message); return r.data as T; };
const msg = (e: unknown) => { const m = e instanceof Error ? e.message : ''; return /risorsa_occupata/.test(m) ? t('La risorsa è già occupata in quell\'orario.') : /invitato_non_nel_team/.test(m) ? t('Puoi invitare solo persone del workspace.') : /troppi_tentativi/.test(m) ? t('Troppi tentativi sbagliati: riprova tra 15 minuti.') : /pagina_riservata/.test(m) ? t('Questa pagina è riservata: serve la password.') : /password_troppo_corta/.test(m) ? t('La password deve avere almeno 6 caratteri.') : /stato_non_valido/.test(m) ? t('Non si può fare in questo stato.') : /persona_non_nel_team/.test(m) ? t('Puoi scegliere solo persone del workspace.') : /non_autorizzato|row-level security/.test(m) ? t('Non hai il permesso per farlo.') : m || t('Operazione non riuscita: riprova.'); };
export const run = async <T,>(f: () => Promise<T>): Promise<Res<T>> => { try { return { ok: true, data: await f() }; } catch (e) { return { ok: false, message: msg(e) }; } };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/* ---------- orari ---------- */
export const loadHours = (team: string) => run(async () => {
  const rows = await q<{ user_id: string; schedule: Schedule }[]>((await db()).from('team_hours').select('user_id,schedule').eq('team_id', team));
  const me = await myUserId();
  const mine = rows.find((r) => r.user_id === me);
  if (mine) useWork.getState().set({ schedules: { ...useWork.getState().schedules, [team]: mine.schedule } });
  return Object.fromEntries(rows.map((r) => [r.user_id, r.schedule])) as Record<string, Schedule>;
});
export const saveMyHours = (team: string, schedule: Schedule) => run(async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  await q((await db()).from('team_hours').upsert({ team_id: team, user_id: me, schedule, updated_at: new Date().toISOString() }));
  useWork.getState().set({ schedules: { ...useWork.getState().schedules, [team]: schedule } });
});

/* ---------- impegni di lavoro condivisi ---------- */
/** Scarica gli impegni di lavoro del team e li unisce a quelli del Plan (i personali non si toccano). */
export async function pullWork(team: string): Promise<void> {
  try {
    const me = await myUserId(); if (!me) return;
    const from = new Date(Date.now() - 14 * 86400000); const f = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
    const rows = await q<WireEvent[]>((await db()).from('team_events').select('*').eq('team_id', team).gte('day', f));
    useLife.setState((s) => ({ events: mergeWork(s.events, rows, team, me) as typeof s.events }));
    detectClashes(team, me);
  } catch { /* offline: restano quelli sul telefono */ }
}
/** Riunioni che altri hanno messo nel mio Plan e che si scontrano con un altro mio impegno: le segnala, così scelgo quale spostare. */
export function detectClashes(team: string, me: string): void {
  const t0 = today(); const out: Clash[] = [];
  for (const [day, list] of Object.entries(useLife.getState().events)) {
    if (day < t0) continue;
    list.forEach((e) => {
      if (e.team !== team || !e.wid || !e.by || e.by === me) return;
      for (const c of incomingConflicts(list, { time: e.time, dur: e.dur, wid: e.wid })) {
        if (c.e.team === team && c.e.wid && c.e.by !== me) continue; // due riunioni degli altri: non tocca a me scegliere
        out.push({ id: `${e.wid}:${day}:${c.idx}`, team, day, time: e.time, dur: e.dur ?? 60, title: e.title, by: e.by, otherDay: day, otherIdx: c.idx, otherTitle: c.e.title, otherTime: c.e.time });
      }
    });
  }
  const ig = new Set(useConflicts.getState().ignored);
  useConflicts.getState().set({ clashes: [...useConflicts.getState().clashes.filter((c) => c.team !== team), ...out.filter((c) => !ig.has(c.id))] });
}
/** Salva (o aggiorna) un impegno di lavoro sul server: gli invitati lo vedono subito. */
export const pushWorkEvent = (day: string, ev: CalLike) => run(async () => {
  const me = await myUserId(); if (!me || !ev.team) throw new Error(t('Accedi per continuare.'));
  await q((await db()).from('team_events').upsert(toWireEvent(day, ev, me)));
});
export const removeWorkEvent = (wid: string) => run(async () => { await q((await db()).from('team_events').update({ deleted: true }).eq('id', wid)); });

/* ---------- occupato / libero (solo intervalli, mai titoli) ---------- */
export type Busy = { user_id: string; day: string; time: string; dur: number };
export const teamBusy = (team: string, from: string, to: string) => run(async () => (await (await supa()).rpc<Busy[]>('team_busy', { p_team: team, p_from: from, p_to: to })) ?? []);
export const busyRanges = (rows: Busy[], user: string, day: string): Range[] => rows.filter((r) => r.user_id === user && r.day === day).map((r): Range => [toMin(r.time), toMin(r.time) + r.dur]);

/* ---------- assenze ---------- */
export const listAbsences = (team: string) => run(async () => q<Absence[]>((await db()).from('team_absences').select('*').eq('team_id', team).order('from_day', { ascending: false })));
export const requestAbsence = (team: string, a: { kind: Absence['kind']; from_day: string; to_day: string; note?: string }) => run(async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  await q((await db()).from('team_absences').upsert({ id: `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, team_id: team, user_id: me, ...a }));
});
export const decideAbsence = (id: string, ok: boolean) => run(async () => { await (await supa()).rpc('team_absence_decide', { p_id: id, p_ok: ok }); });

/* ---------- sincronizzazione ---------- */
let channels: unknown[] = [];
/** Scarica orari e impegni di tutti i tuoi workspace e resta in ascolto: se un collega ti invita, compare subito nel Plan. */
export async function startWorkSync(): Promise<void> {
  try {
    const c = await db();
    for (const ch of channels) c.removeChannel(ch);
    channels = [];
    for (const tm of useTeams.getState().teams) {
      void loadHours(tm.id); await pullWork(tm.id);
      void import('@/lib/teamComms').then((m) => { void m.pullMessages(tm.id, 'general'); void m.pullMessages(tm.id, 'ann'); void m.pullAway(tm.id); });
      void import('@/lib/teamMeetings').then((m) => m.pullMeetings(tm.id));
      void import('@/lib/teamCompany').then((m) => m.pullCompany(tm.id));
      channels.push(c.channel(`team-meetings-${tm.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'team_meetings', filter: `team_id=eq.${tm.id}` }, () => { void import('@/lib/teamMeetings').then((m) => m.pullMeetings(tm.id)); }).subscribe());
      channels.push(c.channel(`team-events-${tm.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'team_events', filter: `team_id=eq.${tm.id}` }, () => { void pullWork(tm.id); }).subscribe());
    }
  } catch { /* senza server */ }
}

export { fromMin, today };

/** Imposta la mia assenza con risposta automatica (usata anche da Theia Lavoro). */
export const setAwayFor = async (team: string, a: { until: string; message: string }) => (await import('@/lib/teamComms')).setAway(team, a);

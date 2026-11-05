import { t } from '@/i18n/core';
import { supa } from '@/lib/accountApi';
import { myUserId } from '@/lib/teams';
import { submitExpense } from '@/lib/teamMoney';
import { db, q, run } from '@/lib/teamWork';
import { SEG_LABEL, defaultDocs, departureReminders, expenseDrafts, itinerary, type Seg, type Trip } from '@/lib/tripWork';
import { WORK_COLOR_ID, newEventId } from '@/lib/workPlan';
import { useLife } from '@/store/life';
import { useTrips } from '@/store/trips';

/** Trasferte sul server: le vede chi viaggia e chi può approvare; lo stato (richiesta, approvata, rifiutata) lo cambia solo il server. Non prenota e non paga nulla. */
export async function pullTrips(team: string): Promise<void> {
  try {
    const rows = await q<Trip[]>((await db()).from('team_trips').select('*').eq('team_id', team).order('from_day', { ascending: false }));
    useTrips.getState().set(team, rows.map((r) => ({ ...r, budget: r.budget == null ? null : Number(r.budget), segments: r.segments ?? [], docs: r.docs ?? [] })));
  } catch { /* senza server */ }
}
const after = <T,>(team: string, f: () => Promise<T>) => run(async () => { const r = await f(); await pullTrips(team); return r; });

export type NewTrip = { team: string; title: string; dest: string; from_day: string; to_day: string; purpose?: string; budget?: number | null; currency?: 'CHF' | 'EUR'; international?: boolean };
export const createTrip = (n: NewTrip) => after(n.team, async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  const id = newEventId();
  await q((await db()).from('team_trips').insert({ id, team_id: n.team, user_id: me, title: n.title.trim(), dest: n.dest.trim(), from_day: n.from_day, to_day: n.to_day, purpose: n.purpose ?? '', budget: n.budget ?? null, currency: n.currency ?? 'CHF', international: !!n.international, docs: defaultDocs(!!n.international, false, false), segments: [] }));
  return id;
});
export const updateTrip = (tr: Trip, patch: Partial<Pick<Trip, 'title' | 'dest' | 'from_day' | 'to_day' | 'purpose' | 'budget' | 'currency' | 'international' | 'segments' | 'docs'>>) => after(tr.team_id, async () => { await q((await db()).from('team_trips').update(patch).eq('id', tr.id)); });
export const deleteTrip = (tr: Trip) => after(tr.team_id, async () => { await q((await db()).from('team_trips').delete().eq('id', tr.id)); });
export const requestTrip = (tr: Trip) => after(tr.team_id, async () => { await (await supa()).rpc('team_trip_request', { p_id: tr.id }); });
export const decideTrip = (tr: Trip, ok: boolean, note = '') => after(tr.team_id, async () => { await (await supa()).rpc('team_trip_decide', { p_id: tr.id, p_ok: ok, p_note: note }); });
export const closeTrip = (tr: Trip) => after(tr.team_id, async () => { await (await supa()).rpc('team_trip_close', { p_id: tr.id }); });

/** Mette il viaggio nel Plan (etichetta Lavoro) e i promemoria di partenza; non aggiunge due volte la stessa cosa. */
export function tripToPlan(tr: Trip, homeTz: string, today: string): number {
  const life = useLife.getState(); let n = 0;
  const has = (day: string, title: string, time: string) => (life.events[day] ?? []).some((e) => e.title === title && e.time === time);
  for (const d of itinerary(tr)) for (const s of d.items) {
    const title = `${SEG_LABEL[s.kind]}: ${s.title}`.slice(0, 190);
    if (has(s.day, title, s.time)) continue;
    life.addEvent(s.day, { time: s.time, title, dur: s.kind === 'hotel' ? 30 : 60, color: WORK_COLOR_ID, team: tr.team_id, wid: `trip-${s.id}`, by: tr.user_id }); n++;
  }
  for (const r of departureReminders(tr, homeTz, today)) { if (has(r.day, r.title, r.time)) continue; life.addEvent(r.day, { time: r.time, title: r.title.slice(0, 190), dur: 15, reminder: true }); n++; }
  return n;
}
/** Crea le note spese dai costi delle tratte (una volta sola per tratta); poi si approvano da Soldi. */
export const tripToExpenses = (tr: Trip) => run(async () => {
  const drafts = expenseDrafts(tr); const done = new Set<string>();
  for (const d of drafts) { const r = await submitExpense({ team: tr.team_id, day: d.day, category: d.category, description: d.description, amount: d.amount, currency: tr.currency }); if (r.ok) done.add(d.segId); else if (!done.size) throw new Error(r.message); }
  if (done.size) { const segs: Seg[] = tr.segments.map((s) => (done.has(s.id) ? { ...s, expensed: true } : s)); await q((await db()).from('team_trips').update({ segments: segs }).eq('id', tr.id)); }
  await pullTrips(tr.team_id);
  return done.size;
});

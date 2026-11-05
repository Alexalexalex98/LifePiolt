import { t } from '@/i18n/core';
import { supa } from '@/lib/accountApi';
import { OBLIGATIONS, PROCESSING_STARTERS, contractDeadlines, nextDue, readContract, type Processing } from '@/lib/workLegal';
import { myUserId } from '@/lib/teams';
import { db, pushWorkEvent, q, run, today } from '@/lib/teamWork';
import { WORK_COLOR_ID, newEventId } from '@/lib/workPlan';
import { useLegal, type AuditRow, type LegalItem } from '@/store/legal';
import { useLife } from '@/store/life';

/** Legale sul server: vede e modifica solo chi ha il permesso «legal.docs»; ogni cosa creata, cambiata, eliminata o aperta finisce nello storico. */
export async function pullLegal(team: string): Promise<void> {
  try {
    const c = await db();
    const items = (await q<(LegalItem & { deleted: boolean })[]>(c.from('team_legal').select('*').eq('team_id', team).eq('deleted', false))).map((x) => x);
    let audit: AuditRow[] = []; try { audit = await q<AuditRow[]>(c.from('team_audit').select('*').eq('team_id', team).order('at', { ascending: false }).limit(80)); } catch { audit = []; }
    useLegal.getState().set(team, { items, audit });
  } catch { /* senza permesso o senza server: resta vuoto */ }
}
const after = <T,>(team: string, f: () => Promise<T>) => run(async () => { const r = await f(); await pullLegal(team); return r; });
const planEvent = async (team: string, day: string, title: string) => {
  const list = useLife.getState().events[day] ?? []; if (list.some((e) => e.title === title.slice(0, 190))) return;
  const me = await myUserId(); const ev = { time: '09:00', title: title.slice(0, 190), dur: 30, color: WORK_COLOR_ID, team, wid: newEventId(), by: me ?? undefined };
  useLife.getState().addEvent(day, ev); void pushWorkEvent(day, ev);
};

/** Legge il testo di un contratto, lo salva e mette nel Plan l'ultimo giorno per disdire e la fine. */
export const addContract = (team: string, name: string, text: string) => after(team, async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  const r = readContract(name, text, today());
  const id = newEventId();
  await q((await db()).from('team_legal').insert({ id, team_id: team, kind: 'contract', title: r.title.slice(0, 190), data: { ...r, note: '' }, due: r.cancelBy ?? r.end ?? null, created_by: me }));
  for (const d of contractDeadlines(r, today())) await planEvent(team, d.day, d.title);
  return { id, read: r };
});
export const saveContractNote = (i: LegalItem, note: string) => after(i.team_id, async () => { await q((await db()).from('team_legal').update({ data: { ...i.data, note: note.slice(0, 2000) } }).eq('id', i.id)); });
export const deleteLegal = (i: LegalItem) => after(i.team_id, async () => { await q((await db()).from('team_legal').update({ deleted: true }).eq('id', i.id)); });
/** Registra che ho aperto una scheda: finisce nello storico («chi ha visto cosa»). */
export const viewedLegal = (id: string) => { void (async () => { try { await (await supa()).rpc('team_legal_viewed', { p_id: id }); } catch { /* storico non disponibile */ } })(); };

/** Segna un adempimento come fatto oggi (o in un altro giorno): il prossimo termine va nel Plan. */
export const doneCheck = (team: string, obl: string, day = today()) => after(team, async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  const o = OBLIGATIONS.find((x) => x.id === obl); if (!o) throw new Error(t('Adempimento non trovato.'));
  const id = `chk-${team.slice(0, 8)}-${obl}`; const data = { obl, last: day }; const due = nextDue(day, o.everyMonths, today());
  const c = await db();
  const ex = await q<{ id: string }[]>(c.from('team_legal').select('id').eq('id', id));
  if (ex.length) await q(c.from('team_legal').update({ data, due, deleted: false }).eq('id', id));
  else await q(c.from('team_legal').insert({ id, team_id: team, kind: 'check', title: o.title, data, due, created_by: me }));
  await planEvent(team, due, `Da fare: ${o.title}`);
});

export const addProcessing = (team: string, p: Omit<Processing, 'id' | 'country'> & { id?: string }) => after(team, async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  await q((await db()).from('team_legal').insert({ id: newEventId(), team_id: team, kind: 'processing', title: p.what.slice(0, 190), data: { ...p, country: 'ALL' }, created_by: me }));
});
export const addStarters = (team: string, have: string[]) => after(team, async () => { for (const p of PROCESSING_STARTERS.filter((x) => !have.includes(x.what))) { const me = await myUserId(); if (!me) return; await q((await db()).from('team_legal').insert({ id: newEventId(), team_id: team, kind: 'processing', title: p.what, data: p, created_by: me })); } });
export const saveLetter = (team: string, title: string, data: { letter: string; vars: Record<string, string>; text: string }) => after(team, async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  await q((await db()).from('team_legal').insert({ id: newEventId(), team_id: team, kind: 'letter', title: title.slice(0, 190), data, created_by: me }));
});

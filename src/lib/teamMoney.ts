import { t } from '@/i18n/core';
import type { Budget, Currency, Entry, Expense, Sub, TaxDate } from '@/lib/money';
import { readUriBytes } from '@/lib/readUri';
import { myUserId, raw } from '@/lib/teams';
import { updateDoc } from '@/lib/teamDocs';
import { db, pushWorkEvent, q, run, today } from '@/lib/teamWork';
import { WORK_COLOR_ID, newEventId } from '@/lib/workPlan';
import { supa } from '@/lib/accountApi';
import { useLife } from '@/store/life';
import { useMoney } from '@/store/money';
import type { TeamDoc } from '@/store/docs';

/** Soldi sul server: prima nota, note spese con scontrino, budget, abbonamenti. Ogni permesso lo decide il server. */
const sel = async <T,>(table: string, team: string): Promise<T[]> => { try { return await q<T[]>((await db()).from(table).select('*').eq('team_id', team)); } catch { return []; } };
export async function pullMoney(team: string): Promise<void> {
  const [entries, expenses, budgets, subs] = await Promise.all([sel<Entry>('team_entries', team), sel<Expense>('team_expenses', team), sel<Budget>('team_budgets', team), sel<Sub>('team_subscriptions', team)]);
  useMoney.getState().set(team, { entries: entries.sort((a, b) => b.day.localeCompare(a.day)), expenses: expenses.sort((a, b) => b.day.localeCompare(a.day)), budgets, subs });
}
const after = <T,>(team: string, f: () => Promise<T>) => run(async () => { const r = await f(); await pullMoney(team); return r; });
const planEvent = async (team: string, day: string, title: string) => { const me = await myUserId(); const ev = { time: '09:00', title: title.slice(0, 190), dur: 30, color: WORK_COLOR_ID, team, wid: newEventId(), by: me ?? undefined }; useLife.getState().addEvent(day, ev); void pushWorkEvent(day, ev); };

export type NewEntry = { team: string; day: string; kind: 'in' | 'out'; category: string; description?: string; amount: number; currency: Currency; project?: string | null; doc_id?: string | null };
export const createEntry = (n: NewEntry) => after(n.team, async () => { const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.')); await q((await db()).from('team_entries').insert({ id: newEventId(), team_id: n.team, day: n.day, kind: n.kind, category: n.category, description: n.description ?? '', amount: n.amount, currency: n.currency, project: n.project ?? null, doc_id: n.doc_id ?? null, created_by: me })); });
export const deleteEntry = (e: Entry) => after(e.team_id, async () => { await q((await db()).from('team_entries').delete().eq('id', e.id)); });

/** Fattura o bolletta pagata: il documento passa a «pagato» e nella prima nota nasce l'uscita. */
export const payDoc = (d: TeamDoc) => run(async () => {
  if (d.amount == null || !d.currency) throw new Error(t('Manca l\'importo del documento.'));
  const r = await updateDoc(d, { status: 'paid' }); if (!r.ok) throw new Error(r.message);
  const w = await createEntry({ team: d.team_id, day: today(), kind: 'out', category: d.kind === 'bill' ? 'Utenze' : 'Fornitori', description: d.title, amount: d.amount, currency: d.currency, doc_id: d.id }); if (!w.ok) throw new Error(w.message);
});

/** Nota spese con la foto dello scontrino (facoltativa). */
export const submitExpense = (n: { team: string; day: string; category: string; description: string; amount: number; currency: Currency; project?: string | null; receipt?: { uri: string; name: string; mime?: string } }) => after(n.team, async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  let path: string | null = null;
  if (n.receipt) {
    const bytes = await readUriBytes(n.receipt.uri); if (bytes.length > 10 * 1024 * 1024) throw new Error(t('La foto supera i 10 MB.'));
    path = `${n.team}/${me}/${Date.now().toString(36)}-${n.receipt.name.replace(/[^\w.\-]+/g, '_')}`;
    const up = await (await raw()).storage.from('team-receipts').upload(path, bytes, { contentType: n.receipt.mime ?? 'image/jpeg', upsert: false }); if (up.error) throw new Error(up.error.message);
  }
  await q((await db()).from('team_expenses').insert({ id: newEventId(), team_id: n.team, user_id: me, day: n.day, category: n.category, description: n.description, amount: n.amount, currency: n.currency, project: n.project ?? null, receipt_path: path }));
});
export const decideExpense = (e: Expense, status: 'approved' | 'rejected' | 'paid', note = '') => after(e.team_id, async () => {
  await (await supa()).rpc('team_expense_decide', { p_id: e.id, p_status: status, p_note: note });
  if (status === 'paid') await q((await db()).from('team_entries').insert({ id: newEventId(), team_id: e.team_id, day: today(), kind: 'out', category: 'Trasferte', description: `${t('Rimborso')}: ${e.description || e.category}`.slice(0, 290), amount: e.amount, currency: e.currency, project: e.project, created_by: (await myUserId())! }));
});
export const deleteExpense = (e: Expense) => after(e.team_id, async () => { await q((await db()).from('team_expenses').delete().eq('id', e.id)); if (e.receipt_path) await (await raw()).storage.from('team-receipts').remove([e.receipt_path]); });
export const downloadReceipt = (e: Expense) => run(async () => { const r = await (await raw()).storage.from('team-receipts').download(e.receipt_path!); if (r.error || !r.data) throw new Error(r.error?.message || t('Non riesco a scaricare lo scontrino.')); return new Uint8Array(await r.data.arrayBuffer()); });

export const saveBudget = (b: Omit<Budget, 'id'> & { id?: string }) => after(b.team_id, async () => { await q((await db()).from('team_budgets').upsert({ ...b, id: b.id ?? newEventId() })); });
export const deleteBudget = (b: Budget) => after(b.team_id, async () => { await q((await db()).from('team_budgets').delete().eq('id', b.id)); });

export const createSub = (s: Omit<Sub, 'id' | 'active'>) => after(s.team_id, async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  await q((await db()).from('team_subscriptions').insert({ ...s, id: newEventId(), created_by: me }));
  if (s.next_date && s.next_date >= today()) await planEvent(s.team_id, s.next_date, `${t('Rinnovo')}: ${s.name}`);
});
export const updateSub = (s: Sub, patch: Partial<Pick<Sub, 'active' | 'amount' | 'next_date' | 'name' | 'cycle'>>) => after(s.team_id, async () => { await q((await db()).from('team_subscriptions').update(patch).eq('id', s.id)); });
export const deleteSub = (s: Sub) => after(s.team_id, async () => { await q((await db()).from('team_subscriptions').delete().eq('id', s.id)); });
export const taxToPlan = (team: string, d: TaxDate) => run(async () => { await planEvent(team, d.day, d.title); });

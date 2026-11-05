import { t } from '@/i18n/core';
import type { Contact, Currency, Deal, Interaction, Kind, Receivable, Stage, Ticket } from '@/lib/crm';
import { myUserId } from '@/lib/teams';
import { db, pushWorkEvent, q, run, today } from '@/lib/teamWork';
import { WORK_COLOR_ID, newEventId } from '@/lib/workPlan';
import { useCrm, type CrmData } from '@/store/crm';
import { useLife } from '@/store/life';
import { fillPage } from '@/lib/reportPage';
import { useWorkspace } from '@/store/workspace';

/** Clienti, trattative, assistenza e da incassare sul server. Chi non ha il permesso non riceve nulla: lo decide il server. */
const sel = async <T,>(table: string, team: string): Promise<T[]> => { try { return await q<T[]>((await db()).from(table).select('*').eq('team_id', team)); } catch { return []; } };
export async function pullCrm(team: string): Promise<void> {
  const [contacts, interactions, deals, tickets, receivables] = await Promise.all([sel<Contact>('team_contacts', team), sel<Interaction>('team_interactions', team), sel<Deal>('team_deals', team), sel<Ticket>('team_tickets', team), sel<Receivable>('team_receivables', team)]);
  const d: CrmData = { contacts: contacts.filter((c) => c.status !== 'archived'), interactions: interactions.sort((a, b) => b.at.localeCompare(a.at)), deals, tickets, receivables };
  useCrm.getState().set(team, d);
}
export async function watchCrm(team: string): Promise<() => void> {
  try {
    const c = await db(); const chans = ['team_deals', 'team_interactions', 'team_tickets'].map((tb) => c.channel(`crm-${tb}-${team}`).on('postgres_changes', { event: '*', schema: 'public', table: tb, filter: `team_id=eq.${team}` }, () => { void pullCrm(team); }).subscribe());
    return () => { chans.forEach((x) => c.removeChannel(x)); };
  } catch { return () => undefined; }
}
const after = <T,>(team: string, f: () => Promise<T>) => run(async () => { const r = await f(); await pullCrm(team); return r; });

export type NewContact = { team: string; kind: Kind; name: string; company?: string; email?: string; phone?: string; address?: string; country?: 'IT' | 'CH' | null; vat?: string; notes?: string; owner?: string | null };
export const createContact = (n: NewContact) => after(n.team, async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  const id = newEventId();
  await q((await db()).from('team_contacts').insert({ id, team_id: n.team, kind: n.kind, name: n.name.trim(), company: n.company ?? '', email: n.email ?? '', phone: n.phone ?? '', address: n.address ?? '', country: n.country ?? null, vat: n.vat ?? '', notes: n.notes ?? '', owner: n.owner ?? me, created_by: me }));
  return id;
});
export const updateContact = (c: Contact, patch: Partial<Pick<Contact, 'kind' | 'name' | 'company' | 'email' | 'phone' | 'address' | 'country' | 'vat' | 'notes' | 'owner' | 'status'>>) => after(c.team_id, async () => { await q((await db()).from('team_contacts').update(patch).eq('id', c.id)); });
export const deleteContact = (c: Contact) => after(c.team_id, async () => { await q((await db()).from('team_contacts').delete().eq('id', c.id)); });

/** Nota dopo una chiamata o un incontro. Con un richiamo il promemoria finisce nel Plan (etichetta Lavoro). */
export const addInteraction = (c: Contact, kind: Interaction['kind'], text: string, followUp: string | null) => after(c.team_id, async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  await q((await db()).from('team_interactions').insert({ id: newEventId(), team_id: c.team_id, contact: c.id, kind, text: text.trim(), by: me, follow_up: followUp }));
  if (followUp) { const ev = { time: '09:00', title: `${t('Richiama')} ${c.name}`, dur: 15, color: WORK_COLOR_ID, team: c.team_id, wid: newEventId(), by: me }; useLife.getState().addEvent(followUp, ev); void pushWorkEvent(followUp, ev); }
});
export const setFollow = (i: Interaction, patch: { follow_done?: boolean; follow_up?: string | null }) => after(i.team_id, async () => { await q((await db()).from('team_interactions').update(patch).eq('id', i.id)); });

export type NewDeal = { team: string; contact: string; title: string; amount: number; currency: Currency; stage?: Stage; expected_close?: string | null; renewal?: string | null; owner?: string | null };
export const createDeal = (n: NewDeal) => after(n.team, async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  const id = newEventId();
  await q((await db()).from('team_deals').insert({ id, team_id: n.team, contact: n.contact, title: n.title.trim(), amount: n.amount, currency: n.currency, stage: n.stage ?? 'lead', expected_close: n.expected_close ?? null, renewal: n.renewal ?? null, owner: n.owner ?? me, created_by: me }));
  return id;
});
export const updateDeal = (d: Deal, patch: Partial<Pick<Deal, 'title' | 'stage' | 'amount' | 'currency' | 'expected_close' | 'renewal' | 'probability' | 'owner' | 'notes' | 'lost_reason'>>) => after(d.team_id, async () => {
  await q((await db()).from('team_deals').update(patch).eq('id', d.id));
  // un rinnovo da seguire va nel Plan: 30 giorni prima
  if (patch.stage === 'won' && (patch.renewal ?? d.renewal)) {
    const r = (patch.renewal ?? d.renewal)!; const dt = new Date(r + 'T12:00:00'); dt.setDate(dt.getDate() - 30); const day = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    if (day >= today()) { const me = await myUserId(); const ev = { time: '09:00', title: `${t('Rinnovo contratto')}: ${d.title}`, dur: 30, color: WORK_COLOR_ID, team: d.team_id, wid: newEventId(), by: me ?? undefined }; useLife.getState().addEvent(day, ev); void pushWorkEvent(day, ev); }
  }
});
export const deleteDeal = (d: Deal) => after(d.team_id, async () => { await q((await db()).from('team_deals').delete().eq('id', d.id)); });

export const createTicket = (n: { team: string; contact: string | null; title: string; text?: string; priority?: Ticket['priority']; assignee?: string | null }) => after(n.team, async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  await q((await db()).from('team_tickets').insert({ id: newEventId(), team_id: n.team, contact: n.contact, title: n.title.trim(), text: n.text ?? '', priority: n.priority ?? 'normal', assignee: n.assignee ?? me, created_by: me }));
});
export const updateTicket = (tk: Ticket, patch: Partial<Pick<Ticket, 'title' | 'text' | 'priority' | 'status' | 'assignee'>>) => after(tk.team_id, async () => { await q((await db()).from('team_tickets').update({ ...patch, ...(patch.status ? { resolved_at: patch.status === 'resolved' ? new Date().toISOString() : null } : {}) }).eq('id', tk.id)); });

export const addReceivable = (c: Contact, label: string, amount: number, currency: Currency, due: string | null) => after(c.team_id, async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  await q((await db()).from('team_receivables').insert({ id: newEventId(), team_id: c.team_id, contact: c.id, label: label.trim(), amount, currency, due, created_by: me }));
  if (due && due >= today()) { const ev = { time: '09:00', title: `${t('Incasso')}: ${label.trim()} (${c.name})`.slice(0, 190), dur: 15, color: WORK_COLOR_ID, team: c.team_id, wid: newEventId(), by: me }; useLife.getState().addEvent(due, ev); void pushWorkEvent(due, ev); }
});
export const markPaid = (r: Receivable, paid: boolean) => after(r.team_id, async () => { await q((await db()).from('team_receivables').update({ paid, paid_at: paid ? new Date().toISOString() : null }).eq('id', r.id)); });

/** Salva il preventivo come pagina condivisa del workspace e porta la trattativa alla fase «Preventivo». */
export const saveQuote = (d: Deal, c: Contact, text: string) => after(d.team_id, async () => {
  const ws = useWorkspace.getState(); const page = ws.addPage(null, 'page', `${t('Preventivo')} · ${c.name} · ${d.title}`.slice(0, 190), d.team_id);
  fillPage(page, text);
  if (d.stage === 'lead' || d.stage === 'contact') await q((await db()).from('team_deals').update({ stage: 'quote' }).eq('id', d.id));
  const me = await myUserId(); if (me) await q((await db()).from('team_interactions').insert({ id: newEventId(), team_id: d.team_id, contact: c.id, kind: 'note', text: `${t('Preventivo preparato')}: ${d.title}`, by: me }));
  return page;
});

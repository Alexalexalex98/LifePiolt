/**
 * Operazioni di dominio dell'app: flussi che toccano piu' store, eseguiti in modo transazionale (snapshot + rollback)
 * con gli effetti collaterali agganciati come handler sugli eventi (vedi handlers.ts).
 *
 * Nessuna schermata deve piu' coordinare a mano bolletta + movimento + calendario + promemoria.
 */
import { removeBillFromCalendar, restoreBillEvents } from '@/lib/bills/calendar';
import { dayKeyOf, hhmm } from '@/lib/when';
import { clubChatId } from '@/store/chat';
import type { PaidToken, PayOpts } from '@/store/finance';
import { useFin } from '@/store/finance';
import { useJobs } from '@/store/jobs';
import { useLife, type CalEvent } from '@/store/life';
import { weekdayShortDate } from '@/lib/format';
import { newId, useNet, type Enrollment, type Provider, type Seminar } from '@/store/network';
import type { Share } from '@/lib/interview';
import { forgetKey, runOperation, type OpResult } from './operation.ts';
import './stores';

type Removed = { day: string; idx: number; ev: CalEvent }[];

// ---------------------------------------------------------------- bollette

export type PaidResult = { ok: true; tok: PaidToken; removed: Removed; fullyPaid: boolean } | { ok: false; error: string };

/** Segna una bolletta (o una rata) come pagata: bolletta + movimento opzionale + scadenza dal calendario; poi 'bill.paid'. */
export function payBill(id: string, o: PayOpts): PaidResult {
  const r = runOperation<{ tok: PaidToken; removed: Removed; fullyPaid: boolean }>('bill.pay', [
    {
      name: 'bolletta', stores: ['fin'],
      run: (c) => {
        const tok = useFin.getState().markInvoicePaid(id, o);
        if (!tok) throw new Error('Bolletta non trovata');
        c.set('tok', tok);
        c.set('fullyPaid', useFin.getState().invoices.find((i) => i.id === id)?.state === 'paid');
      },
    },
    {
      name: 'calendario', stores: ['life'],
      run: (c) => { c.set('removed', c.get('fullyPaid') ? removeBillFromCalendar(id) : []); },
    },
  ], {
    key: `bill.pay:${id}:${o.installment ?? 'all'}:${o.date}:${o.amount}`,
    events: (c) => [['bill.paid', { id, fullyPaid: !!c.get('fullyPaid'), recorded: !!o.record }]],
  });
  if (!r.ok) return { ok: false, error: r.error };
  if (r.skipped) return { ok: false, error: 'Pagamento gia\' registrato' };
  return { ok: true, tok: r.value.tok, removed: r.value.removed, fullyPaid: !!r.value.fullyPaid };
}

/** Annulla un pagamento appena registrato (movimento, bolletta, scadenza nel calendario) e riprogramma i promemoria. */
export function undoPayBill(id: string, r: { tok: PaidToken; removed: Removed }, o: PayOpts): OpResult {
  const res = runOperation('bill.unpay', [
    { name: 'bolletta', stores: ['fin'], run: () => useFin.getState().undoInvoicePaid(r.tok) },
    { name: 'calendario', stores: ['life'], run: () => restoreBillEvents(r.removed) },
  ], { events: () => [['bill.reopened', { id }]] });
  if (res.ok) forgetKey(`bill.pay:${id}:${o.installment ?? 'all'}:${o.date}:${o.amount}`);
  return res;
}

// ---------------------------------------------------------------- prenotazioni (seminari e servizi)

export type BookingPlan = { day: string; time: string; durationMin: number; title: string };
const bump = (id: number, d: number) => useNet.setState((st) => ({ seminars: st.seminars.map((x) => (x.id === id ? { ...x, joined: Math.max(0, (x.joined ?? 0) + d) } : x)) }));
const slotSet = (name: string, slot: string, present: boolean) => useNet.setState((st) => ({ providers: st.providers.map((p) => (p.name === name ? { ...p, slots: present ? (p.slots.includes(slot) ? p.slots : [...p.slots, slot]) : p.slots.filter((x) => x !== slot) } : p)) }));

/** Iscrizione a un seminario: evento nel Plan + iscrizione + posti occupati; poi 'booking.confirmed'. */
export function enrollSeminarOp(s: Seminar, plan: BookingPlan, facts: { startsAt: number; durationMin: number }, id = 'e' + newId()): OpResult {
  return runOperation('booking.seminar', [
    // si paga PRIMA di occupare il posto: se il pagamento non va a buon fine non cambia nulla
    { name: 'pagamento', stores: ['net'], run: () => { if (s.price > 0 && !useNet.getState().spend(s.price, `Seminario "${s.title}" di ${s.host}`, undefined, `enr:${id}`)) throw new Error('LifePoints insufficienti'); } },
    { name: 'plan', stores: ['life'], run: () => useLife.getState().addEvent(plan.day, { time: plan.time, title: plan.title, dur: plan.durationMin, ref: id }) },
    {
      name: 'iscrizione', stores: ['net'],
      run: () => {
        const e: Enrollment = { id, kind: 'seminar', ref: String(s.id), title: s.title, host: s.host, price: s.price, startsAt: facts.startsAt, durationMin: facts.durationMin, status: 'enrolled', createdAt: Date.now(), paid: s.price, held: s.price > 0 };
        useNet.setState((st) => ({ enrollments: [e, ...st.enrollments] }));
        bump(s.id, 1);
      },
    },
  ], { events: () => [['booking.confirmed', { id, kind: 'seminar', title: s.title, host: s.host, price: s.price, startsAt: facts.startsAt }]] });
}

/** Prenotazione di un servizio: evento nel Plan + prenotazione + slot occupato; poi 'booking.confirmed'. */
export function bookServiceOp(p: Provider, slot: string, plan: BookingPlan, startsAt: number, durationMin: number, id = 'e' + newId()): OpResult {
  return runOperation('booking.service', [
    { name: 'pagamento', stores: ['net'], run: () => { if (p.price > 0 && !useNet.getState().spend(p.price, `Sessione "${p.role}" di ${p.name}`, undefined, `enr:${id}`)) throw new Error('LifePoints insufficienti'); } },
    { name: 'plan', stores: ['life'], run: () => useLife.getState().addEvent(plan.day, { time: plan.time, title: plan.title, dur: plan.durationMin, ref: id }) },
    {
      name: 'prenotazione', stores: ['net'],
      run: () => {
        const e: Enrollment = { id, kind: 'service', ref: `${p.name}|${slot}`, title: p.role, host: p.name, price: p.price, startsAt, durationMin, status: 'enrolled', createdAt: Date.now(), slot, paid: p.price, held: p.price > 0 };
        useNet.setState((st) => ({ enrollments: [e, ...st.enrollments] }));
        slotSet(p.name, slot, false);
      },
    },
  ], { events: () => [['booking.confirmed', { id, kind: 'service', title: p.role, host: p.name, price: p.price, startsAt }]] });
}

/** Conferma di partecipazione: addebito LifePoints + accredito al relatore + stato. Se l'addebito fallisce non cambia nulla. */
export function confirmAttendanceOp(id: string): { ok: boolean; reason?: 'missing' | 'points' } {
  const enr = useNet.getState().enrollments.find((e) => e.id === id);
  if (!enr) return { ok: false, reason: 'missing' };
  const r = runOperation('booking.attend', [
    {
      name: 'punti', stores: ['net'],
      run: () => {
        if (enr.paid == null && enr.price > 0 && !useNet.getState().spend(enr.price, `${enr.kind === 'seminar' ? 'Seminario' : 'Sessione'} "${enr.title}" di ${enr.host}`, enr.host)) throw new Error('LifePoints insufficienti');
      },
    },
    {
      name: 'stato', stores: ['net'],
      run: () => {
        useNet.setState((s) => ({ enrollments: s.enrollments.map((e) => (e.id === id ? { ...e, status: 'attended' as const } : e)) }));
        if (enr.kind === 'service' && enr.slot) slotSet(enr.host, enr.slot, true);
      },
    },
  ], { key: `booking.attend:${id}`, events: () => [['booking.attended', { id, kind: enr.kind, title: enr.title, host: enr.host, price: enr.price }]] });
  if (r.ok) return { ok: true };
  return { ok: false, reason: /LifePoints/.test(r.error) ? 'points' : 'missing' };
}

type PlanRemoval = { day: string; idx: number; ev: CalEvent };
function removeEventByRef(ref: string): PlanRemoval | null {
  const st = useLife.getState();
  for (const day of Object.keys(st.events)) {
    const idx = st.events[day].findIndex((e) => e.ref === ref);
    if (idx >= 0) { const ev = st.delEvent(day, idx); if (ev) return { day, idx, ev }; }
  }
  return null;
}

/** Annulla una prenotazione/iscrizione prima dell'inizio: toglie l'evento dal Plan, libera posto/slot; poi 'booking.cancelled'. */
export function cancelEnrollmentOp(id: string): { enr: Enrollment; removal: PlanRemoval | null } | null {
  const enr = useNet.getState().enrollments.find((e) => e.id === id);
  if (!enr || enr.status !== 'enrolled') return null;
  const r = runOperation<{ removal: PlanRemoval | null }>('booking.cancel', [
    { name: 'plan', stores: ['life'], run: (c) => { c.set('removal', removeEventByRef(id)); } },
    {
      name: 'rimborso', stores: ['net'],
      run: () => {
        const paid = enr.paid ?? 0;
        if (paid <= 0) return;
        useNet.setState((st) => ({
          lifePoints: st.lifePoints + paid,
          receivedPayments: enr.held ? st.receivedPayments : { ...st.receivedPayments, [enr.host]: Math.max(0, (st.receivedPayments[enr.host] || 0) - paid) },
          lpMoves: (st.lpMoves ?? []).filter((m) => m.ref !== `enr:${id}`),
          ledger: [{ type: 'topup' as const, desc: `Rimborso: ${enr.title}`, amount: paid, date: weekdayShortDate() }, ...st.ledger],
        }));
      },
    },
    {
      name: 'iscrizione', stores: ['net'],
      run: () => {
        useNet.setState((s) => ({ enrollments: s.enrollments.filter((e) => e.id !== id) }));
        if (enr.kind === 'seminar') bump(Number(enr.ref), -1); else if (enr.slot) slotSet(enr.host, enr.slot, true);
      },
    },
  ], { events: () => [['booking.cancelled', { id, kind: enr.kind, title: enr.title }]] });
  return r.ok ? { enr, removal: r.value.removal } : null;
}

/** Annulla l'annullamento (undo): rimette iscrizione, posto/slot ed evento nel Plan. */
export function restoreEnrollmentOp(enr: Enrollment, removal: PlanRemoval | null): OpResult {
  return runOperation('booking.restore', [
    { name: 'pagamento', stores: ['net'], run: () => { if ((enr.paid ?? 0) > 0 && !useNet.getState().spend(enr.paid!, `${enr.kind === 'seminar' ? 'Seminario' : 'Sessione'} "${enr.title}" di ${enr.host}`, enr.held ? undefined : enr.host, `enr:${enr.id}`)) throw new Error('LifePoints insufficienti'); } },
    {
      name: 'iscrizione', stores: ['net'],
      run: () => {
        useNet.setState((s) => ({ enrollments: [enr, ...s.enrollments] }));
        if (enr.kind === 'seminar') bump(Number(enr.ref), 1); else if (enr.slot) slotSet(enr.host, enr.slot, false);
      },
    },
    { name: 'plan', stores: ['life'], run: () => { if (removal) useLife.getState().restoreEvent(removal.day, removal.idx, removal.ev); } },
  ], { events: () => [['booking.confirmed', { id: enr.id, kind: enr.kind, title: enr.title, host: enr.host, price: enr.price, startsAt: enr.startsAt, restored: true }]] });
}

export const startsOf = (ts: number) => ({ day: dayKeyOf(ts), time: hhmm(ts) });

// ---------------------------------------------------------------- colloquio

/** Il candidato accetta un invito: stato del colloquio (jobs). Plan e notifiche seguono come handler di 'interview.accepted'. */
export function acceptInterviewOp(appId: string, slotIdx: number, share: Share): boolean {
  const r = runOperation('interview.accept', [
    { name: 'colloquio', stores: ['jobs'], run: () => { if (!useJobs.getState().acceptInterview(appId, slotIdx, share)) throw new Error('Invito non valido'); } },
  ], { events: () => [['interview.accepted', { appId }]] });
  return r.ok;
}

// ---------------------------------------------------------------- club

/** Iscrizione/follow a un club: iscrizione + canale chat; poi 'club.subscribed'. `welcome` (messaggio del creatore) e' un passo della chat. */
export function subscribeClubOp(args: { clubId: string; clubName: string; tier: 'follower' | 'free' | 'premium'; join: () => void; chat: () => string; welcome?: (chatId: string) => void }): OpResult {
  return runOperation('club.subscribe', [
    { name: 'iscrizione', stores: ['club'], run: () => args.join() },
    { name: 'canale', stores: ['chat'], run: (c) => { const id = args.chat(); c.set('chatId', id); } },
    { name: 'benvenuto', stores: ['chat'], run: (c) => { args.welcome?.(c.get<string>('chatId') ?? clubChatId(args.clubId)); } },
  ], { events: () => [['club.subscribed', { clubId: args.clubId, clubName: args.clubName, tier: args.tier }]] });
}

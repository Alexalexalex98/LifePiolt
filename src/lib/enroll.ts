import { useEffect, useState } from 'react';

import { dayKeyOf, hhmm, nextOccurrence } from '@/lib/when';
import { bookServiceOp, cancelEnrollmentOp, confirmAttendanceOp, enrollSeminarOp, restoreEnrollmentOp } from '@/domain/operations';
import { checkPlanSlot, placeInPlan, removeFromPlan } from '@/lib/planBooking';
import { bookingPayBlock, canCancel, canReschedule } from '@/lib/booking';
import { SIGNAL } from '@/lib/relevance';
import { newId, useNet, type Provider, type Seminar } from '@/store/network';
import { showUndoToast, toast } from '@/store/toast';
import { t, t as tl } from '@/i18n/core';
import { formatCHF } from '@/lib/format';
import { go } from '@/lib/nav';
import { addParticipant } from '@/lib/participants';
import { useChat, type ChatMessage } from '@/store/chat';

/**
 * Iscrizione a seminari e prenotazione di servizi.
 * Si paga SUBITO, alla prenotazione, e solo dopo il pagamento si occupa il posto. Si può disdire fino a 24 ore prima (rimborso intero)
 * e riprogrammare in qualsiasi momento prima dell'inizio. Dopo la fine si conferma la partecipazione (senza altri addebiti).
 */
export const endOf = (e: { startsAt: number; durationMin: number }) => e.startsAt + e.durationMin * 60000;
export const hasEnded = (e: { startsAt: number; durationMin: number }, now = Date.now()) => endOf(e) <= now;

/** Re-render periodico, cosi' "Conferma partecipazione" compare appena finisce l'orario. */
export function useNow(ms = 20000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(i); }, [ms]);
  return now;
}

export function seminarFacts(s: Seminar) {
  const durationMin = s.durationMin ?? 60;
  const seats = s.seats ?? 0;
  const joined = s.joined ?? 0;
  return { startsAt: s.startsAt ?? null, durationMin, mode: s.mode ?? null, place: s.place ?? '', seats, joined, seatsLeft: seats ? Math.max(0, seats - joined) : null };
}

const setSlot = (name: string, slot: string, present: boolean) =>
  useNet.setState((st) => ({ providers: st.providers.map((p) => (p.name === name ? { ...p, slots: present ? (p.slots.includes(slot) ? p.slots : [...p.slots, slot]) : p.slots.filter((x) => x !== slot) } : p)) }));

/** Iscrizione a un seminario: si paga subito. Controlla saldo e conflitti col Plan prima di confermare. */
export function enrollSeminar(s: Seminar, me: string): void {
  const f = seminarFacts(s);
  if (!f.startsAt) { toast('Questo seminario non ha ancora una data: non e\' possibile iscriversi'); return; }
  if (f.startsAt <= Date.now()) { toast('Il seminario e\' gia\' iniziato'); return; }
  if (s.host === me) { toast('Sei il relatore di questo seminario'); return; }
  if (f.seatsLeft === 0) { toast('Posti esauriti'); return; }
  if (useNet.getState().enrollments.some((e) => e.kind === 'seminar' && e.ref === String(s.id) && e.status === 'enrolled')) return;
  const block = bookingPayBlock(s.price, useNet.getState().lifePoints);
  if (block) { toast(block); return; }
  const id = 'e' + newId();
  const req = { day: dayKeyOf(f.startsAt), time: hhmm(f.startsAt), durationMin: f.durationMin, title: 'Seminario: ' + s.title, ref: id, verb: 'Iscriviti' };
  // operazione di dominio: evento nel Plan + iscrizione + posti, tutto o niente; notifica e promemoria arrivano dagli handler di 'booking.confirmed'
  checkPlanSlot(req, () => {
    const r = enrollSeminarOp(s, req, { startsAt: f.startsAt!, durationMin: f.durationMin }, id);
    if (!r.ok) { toast('Non sono riuscito a completare l\'iscrizione: non è stato salvato nulla'); return; }
    addParticipant(`seminar:${s.id}`, me, s.price);
    useNet.getState().signal(s.title + ' ' + (s.desc ?? ''), SIGNAL.buy);
    toast(s.price ? t('Iscrizione confermata: {0} LP bloccati fino alla fine. Aggiunto al Plan.', formatCHF(s.price)) : 'Iscrizione confermata (gratuito). Aggiunto al Plan.');
    if (s.price) go('invoice', { id: `enr:${id}` });
  });
}

/** Prenotazione di una sessione con un professionista: si paga subito, poi lo slot è tuo. */
export function bookService(p: Provider, slot: string, durationMin: number, me: string): void {
  const startsAt = nextOccurrence(slot);
  if (!startsAt) { toast('Slot non valido'); return; }
  if (p.name === me) { toast('Questo e\' il tuo servizio'); return; }
  const block = bookingPayBlock(p.price, useNet.getState().lifePoints);
  if (block) { toast(block); return; }
  const id = 'e' + newId();
  const req = { day: dayKeyOf(startsAt), time: hhmm(startsAt), durationMin, title: `${p.role} con ${p.name}`, ref: id, verb: 'Prenota' };
  checkPlanSlot(req, () => {
    const r = bookServiceOp(p, slot, req, startsAt, durationMin, id);
    if (!r.ok) { toast('Non sono riuscito a completare la prenotazione: non è stato salvato nulla'); return; }
    addParticipant(`service:${p.name}`, me, p.price);
    useNet.getState().signal(p.role + ' ' + p.name, SIGNAL.buy);
    toast(t('Prenotato con {0}: {1} LP bloccati fino alla fine. Aggiunto al Plan.', p.name, formatCHF(p.price)));
    if (p.price) go('invoice', { id: `enr:${id}` });
  });
}

/** Prenotazione di un servizio proposto in chat: stessi passaggi di una prenotazione normale (LP bloccati fino alla fine, Plan, fattura). */
export function bookOffer(chatId: string, m: ChatMessage, me: string): void {
  const o = m.offer;
  if (!o || o.booked) return;
  if (m.from === me) { toast('Questa è la tua proposta'); return; }
  if (o.startsAt <= Date.now()) { toast('Questa proposta è scaduta'); return; }
  const block = bookingPayBlock(o.price, useNet.getState().lifePoints);
  if (block) { toast(block); return; }
  const id = 'e' + newId();
  const req = { day: dayKeyOf(o.startsAt), time: hhmm(o.startsAt), durationMin: o.durationMin, title: `${o.title} con ${m.from}`, ref: id, verb: 'Prenota' };
  const p: Provider = { name: m.from, role: o.title, price: o.price, rating: 0, tag: '', media: null, slots: [] };
  checkPlanSlot(req, () => {
    const r = bookServiceOp(p, '', req, o.startsAt, o.durationMin, id);
    if (!r.ok) { toast('Non sono riuscito a completare la prenotazione: non è stato salvato nulla'); return; }
    addParticipant(`service:${m.from}`, me, o.price);
    useChat.getState().patchMsg(chatId, m.id, { offer: { ...o, booked: { by: me, enrId: id } } });
    toast(o.price ? t('Prenotato con {0}: {1} LP bloccati fino alla fine. Aggiunto al Plan.', m.from, formatCHF(o.price)) : 'Prenotato. Aggiunto al Plan.');
    if (o.price) go('invoice', { id: `enr:${id}` });
  });
}

/** Disiscrizione / annullamento prima dell'inizio: toglie l'evento dal Plan, con undo. */
export function cancelEnrollment(id: string): void {
  const cur = useNet.getState().enrollments.find((e) => e.id === id);
  if (cur && !canCancel(cur.startsAt, Date.now())) { toast('Si può disdire al massimo 24 ore prima. Puoi comunque riprogrammare.'); return; }
  const done = cancelEnrollmentOp(id);
  if (!done) return;
  const { enr, removal } = done;
  showUndoToast(enr.paid ? tl('Annullata: ti abbiamo rimborsato {0} LP', enr.paid) : enr.kind === 'seminar' ? 'Iscrizione annullata e rimossa dal Plan' : 'Prenotazione annullata e rimossa dal Plan', () => { restoreEnrollmentOp(enr, removal); });
}

/** Conferma di partecipazione dopo la fine: addebita l'utente e accredita il relatore/professionista (se a pagamento). */
export function confirmAttendance(id: string): boolean {
  const net = useNet.getState();
  const enr = net.enrollments.find((e) => e.id === id);
  if (!enr || enr.status !== 'enrolled' || !hasEnded(enr)) return false;
  const r = confirmAttendanceOp(id); // addebito + accredito + stato: tutto o niente
  if (!r.ok) {
    if (r.reason === 'points') toast('LifePoints insufficienti: ricarica il saldo per confermare la partecipazione');
    return false;
  }
  return true;
}

/** "Non ho partecipato": nessun addebito. */
export function declineAttendance(id: string): void {
  const enr = useNet.getState().enrollments.find((e) => e.id === id);
  if (!enr || enr.status !== 'enrolled') return;
  useNet.setState((s) => ({ enrollments: s.enrollments.map((e) => (e.id === id ? { ...e, status: 'declined' } : e)) }));
  if (enr.kind === 'service' && enr.slot) setSlot(enr.host, enr.slot, true);
  toast('Segnato come non partecipato');
}

/** Solo demo: sposta la sessione nel passato per provare la conferma. */
export function demoFinish(id: string): void {
  const enr = useNet.getState().enrollments.find((e) => e.id === id);
  if (!enr || enr.status !== 'enrolled') return;
  const startsAt = Date.now() - enr.durationMin * 60000 - 60000;
  const removal = removeFromPlan(id);
  useNet.setState((s) => ({ enrollments: s.enrollments.map((e) => (e.id === id ? { ...e, startsAt } : e)) }));
  if (removal) placeInPlan({ day: dayKeyOf(startsAt), time: hhmm(startsAt), durationMin: enr.durationMin, title: removal.ev.title, ref: id });
  toast('Demo: sessione segnata come conclusa');
}

/** Riprogramma una sessione con un professionista su un altro slot libero: nessun nuovo pagamento. */
export function rescheduleService(id: string, newSlot: string): boolean {
  const st = useNet.getState();
  const enr = st.enrollments.find((e) => e.id === id);
  if (!enr || enr.kind !== 'service' || !canReschedule(enr, Date.now())) return false;
  const prov = st.providers.find((p) => p.name === enr.host);
  const startsAt = nextOccurrence(newSlot);
  if (!prov || !startsAt || !prov.slots.includes(newSlot)) { toast('Questo orario non è più disponibile'); return false; }
  const req = { day: dayKeyOf(startsAt), time: hhmm(startsAt), durationMin: enr.durationMin, title: `${enr.title} con ${enr.host}`, ref: id, verb: 'Riprogramma' };
  checkPlanSlot(req, () => {
    removeFromPlan(id);
    if (enr.slot) setSlot(enr.host, enr.slot, true);
    setSlot(enr.host, newSlot, false);
    useNet.setState((s) => ({ enrollments: s.enrollments.map((e) => (e.id === id ? { ...e, startsAt, slot: newSlot, ref: `${enr.host}|${newSlot}` } : e)) }));
    placeInPlan(req);
    toast('Sessione riprogrammata: nessun nuovo pagamento');
  });
  return true;
}

/** Altre date dello stesso seminario (stesso relatore e titolo) a cui spostarsi. */
export function otherSeminarDates(id: string): Seminar[] {
  const st = useNet.getState();
  const enr = st.enrollments.find((e) => e.id === id);
  if (!enr || enr.kind !== 'seminar') return [];
  return st.seminars.filter((x) => x.host === enr.host && x.title === enr.title && String(x.id) !== enr.ref && (x.startsAt ?? 0) > Date.now() && seminarFacts(x).seatsLeft !== 0);
}
/** Riprogramma l'iscrizione a un'altra data dello stesso seminario: nessun nuovo pagamento. */
export function rescheduleSeminar(id: string, targetId: number): boolean {
  const st = useNet.getState();
  const enr = st.enrollments.find((e) => e.id === id);
  const target = st.seminars.find((x) => x.id === targetId);
  if (!enr || !target || enr.kind !== 'seminar' || !canReschedule(enr, Date.now()) || !target.startsAt) return false;
  if (!otherSeminarDates(id).some((x) => x.id === targetId)) { toast('Questa data non è disponibile'); return false; }
  const f = seminarFacts(target);
  const req = { day: dayKeyOf(target.startsAt), time: hhmm(target.startsAt), durationMin: f.durationMin, title: 'Seminario: ' + target.title, ref: id, verb: 'Riprogramma' };
  checkPlanSlot(req, () => {
    removeFromPlan(id);
    useNet.setState((s) => ({
      seminars: s.seminars.map((x) => (x.id === Number(enr.ref) ? { ...x, joined: Math.max(0, (x.joined ?? 0) - 1) } : x.id === targetId ? { ...x, joined: (x.joined ?? 0) + 1 } : x)),
      enrollments: s.enrollments.map((e) => (e.id === id ? { ...e, ref: String(targetId), startsAt: target.startsAt!, durationMin: f.durationMin } : e)),
    }));
    placeInPlan(req);
    toast('Iscrizione spostata alla nuova data: nessun nuovo pagamento');
  });
  return true;
}

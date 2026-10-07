import { useEffect, useState } from 'react';

import { dayKeyOf, hhmm, nextOccurrence } from '@/lib/when';
import { addToPlanWithCheck, placeInPlan, removeFromPlan, restoreToPlan } from '@/lib/planBooking';
import { newId, useNet, type Enrollment, type Provider, type Seminar } from '@/store/network';
import { showUndoToast, toast } from '@/store/toast';
import { formatCHF } from '@/lib/format';

/**
 * Iscrizione a seminari e prenotazione di servizi.
 * Ci si iscrive/prenota SENZA pagare: i LifePoints si addebitano (e il relatore/professionista li riceve)
 * solo dopo la fine della sessione, quando l'utente conferma la partecipazione.
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

const bumpJoined = (id: number, d: number) =>
  useNet.setState((st) => ({ seminars: st.seminars.map((x) => (x.id === id ? { ...x, joined: Math.max(0, (x.joined ?? 0) + d) } : x)) }));
const setSlot = (name: string, slot: string, present: boolean) =>
  useNet.setState((st) => ({ providers: st.providers.map((p) => (p.name === name ? { ...p, slots: present ? (p.slots.includes(slot) ? p.slots : [...p.slots, slot]) : p.slots.filter((x) => x !== slot) } : p)) }));

/** Iscrizione a un seminario (nessun pagamento ora). Controlla i conflitti col Plan prima di confermare. */
export function enrollSeminar(s: Seminar, me: string): void {
  const f = seminarFacts(s);
  if (!f.startsAt) { toast('Questo seminario non ha ancora una data: non e\' possibile iscriversi'); return; }
  if (f.startsAt <= Date.now()) { toast('Il seminario e\' gia\' iniziato'); return; }
  if (s.host === me) { toast('Sei il relatore di questo seminario'); return; }
  if (f.seatsLeft === 0) { toast('Posti esauriti'); return; }
  if (useNet.getState().enrollments.some((e) => e.kind === 'seminar' && e.ref === String(s.id) && e.status === 'enrolled')) return;
  const id = 'e' + newId();
  addToPlanWithCheck(
    { day: dayKeyOf(f.startsAt), time: hhmm(f.startsAt), durationMin: f.durationMin, title: 'Seminario: ' + s.title, ref: id, verb: 'Iscriviti' },
    () => {
      useNet.setState((st) => ({ enrollments: [{ id, kind: 'seminar', ref: String(s.id), title: s.title, host: s.host, price: s.price, startsAt: f.startsAt!, durationMin: f.durationMin, status: 'enrolled', createdAt: Date.now() }, ...st.enrollments] }));
      bumpJoined(s.id, 1);
      toast(s.price ? `Iscrizione confermata. Pagherai ${formatCHF(s.price)} LP solo dopo il seminario. Aggiunto al Plan.` : 'Iscrizione confermata (gratuito). Aggiunto al Plan.');
    },
  );
}

/** Prenotazione di una sessione con un professionista (nessun pagamento ora). */
export function bookService(p: Provider, slot: string, durationMin: number, me: string): void {
  const startsAt = nextOccurrence(slot);
  if (!startsAt) { toast('Slot non valido'); return; }
  if (p.name === me) { toast('Questo e\' il tuo servizio'); return; }
  const id = 'e' + newId();
  addToPlanWithCheck(
    { day: dayKeyOf(startsAt), time: hhmm(startsAt), durationMin, title: `${p.role} con ${p.name}`, ref: id, verb: 'Prenota' },
    () => {
      useNet.setState((st) => ({ enrollments: [{ id, kind: 'service', ref: `${p.name}|${slot}`, title: p.role, host: p.name, price: p.price, startsAt, durationMin, status: 'enrolled', createdAt: Date.now(), slot }, ...st.enrollments] }));
      setSlot(p.name, slot, false);
      toast(`Prenotato con ${p.name}. Pagherai ${formatCHF(p.price)} LP solo dopo la sessione. Aggiunto al Plan.`);
    },
  );
}

/** Disiscrizione / annullamento prima dell'inizio: toglie l'evento dal Plan, con undo. */
export function cancelEnrollment(id: string): void {
  const st = useNet.getState();
  const enr = st.enrollments.find((e) => e.id === id);
  if (!enr || enr.status !== 'enrolled') return;
  const removal = removeFromPlan(id);
  useNet.setState((s) => ({ enrollments: s.enrollments.filter((e) => e.id !== id) }));
  if (enr.kind === 'seminar') bumpJoined(Number(enr.ref), -1);
  else if (enr.slot) setSlot(enr.host, enr.slot, true);
  showUndoToast(enr.kind === 'seminar' ? 'Iscrizione annullata e rimossa dal Plan' : 'Prenotazione annullata e rimossa dal Plan', () => {
    useNet.setState((s) => ({ enrollments: [enr, ...s.enrollments] }));
    if (enr.kind === 'seminar') bumpJoined(Number(enr.ref), 1);
    else if (enr.slot) setSlot(enr.host, enr.slot, false);
    restoreToPlan(removal);
  });
}

/** Conferma di partecipazione dopo la fine: addebita l'utente e accredita il relatore/professionista (se a pagamento). */
export function confirmAttendance(id: string): boolean {
  const net = useNet.getState();
  const enr = net.enrollments.find((e) => e.id === id);
  if (!enr || enr.status !== 'enrolled' || !hasEnded(enr)) return false;
  if (enr.price > 0 && !net.spend(enr.price, `${enr.kind === 'seminar' ? 'Seminario' : 'Sessione'} "${enr.title}" di ${enr.host}`, enr.host)) {
    toast('LifePoints insufficienti: ricarica il saldo per confermare la partecipazione');
    return false;
  }
  useNet.setState((s) => ({ enrollments: s.enrollments.map((e) => (e.id === id ? { ...e, status: 'attended' } : e)) }));
  if (enr.kind === 'service' && enr.slot) setSlot(enr.host, enr.slot, true); // lo slot settimanale torna disponibile
  return true;
}

/** "Non ho partecipato": nessun addebito. */
export function declineAttendance(id: string): void {
  const enr = useNet.getState().enrollments.find((e) => e.id === id);
  if (!enr || enr.status !== 'enrolled') return;
  useNet.setState((s) => ({ enrollments: s.enrollments.map((e) => (e.id === id ? { ...e, status: 'declined' } : e)) }));
  if (enr.kind === 'service' && enr.slot) setSlot(enr.host, enr.slot, true);
  toast('Segnato come non partecipato: nessun addebito');
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

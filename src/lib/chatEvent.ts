import { planTitleFor } from '@/lib/chatList';
import { addToPlanWithCheck, removeFromPlan } from '@/lib/planBooking';
import { useChat, type ChatMessage, type RsvpAnswer } from '@/store/chat';
import { useLife } from '@/store/life';

/** Riferimento con cui l'evento dell'invito sta nel Plan di chi risponde. */
export const eventRef = (mid: string) => `inv:${mid}`;

/** Dove sta nel Plan l'evento dell'invito (se c'è). */
export function findPlanned(mid: string) {
  const ref = eventRef(mid);
  const ev = useLife.getState().events;
  for (const day of Object.keys(ev)) {
    const idx = ev[day].findIndex((e) => e.ref === ref);
    if (idx >= 0) return { day, idx };
  }
  return null;
}

/**
 * Risposta a un invito. 'yes' aggiunge al Plan (con avviso di sovrapposizione), 'maybe' lo aggiunge con "(forse)" nel titolo,
 * 'no' lo toglie. Cambiare risposta aggiorna il Plan; se l'utente rinuncia davanti al conflitto la risposta non cambia.
 * onDone riceve un messaggio per il toast.
 */
export function respondToEvent(chatId: string, m: ChatMessage, me: string, answer: RsvpAnswer, onDone?: (msg: string) => void) {
  const ev = m.event;
  if (!ev) return;
  const chat = useChat.getState();
  const ref = eventRef(m.id);
  const record = (msg: string) => { chat.rsvpEvent(chatId, m.id, me, answer); onDone?.(msg); };
  if (answer === 'no') { removeFromPlan(ref); record('Risposta: non partecipi'); return; }
  const title = planTitleFor(ev.title, answer);
  const here = findPlanned(m.id);
  if (here) {
    // già nel Plan: aggiorno solo il titolo (sì <-> forse), senza nuovi controlli
    useLife.getState().patchEvent(here.day, here.idx, { title });
    record(answer === 'yes' ? 'Partecipi: confermato nel tuo piano' : 'Forse: segnato come provvisorio nel piano');
    return;
  }
  addToPlanWithCheck({ day: ev.day, time: ev.time, durationMin: ev.durationMin, title, ref, verb: answer === 'yes' ? 'Partecipa' : 'Aggiungi come forse' },
    () => record(answer === 'yes' ? 'Partecipi: aggiunto al tuo piano' : 'Forse: aggiunto al piano come provvisorio'));
}

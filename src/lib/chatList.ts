/**
 * Lista chat: ultimo messaggio, anteprima, ordinamento e non lette. Modulo PURO e testabile
 * (nessun import con alias): i tipi sono strutturali, ChatMessage di '@/store/chat' li soddisfa.
 */
export type LMsg = {
  id?: string;
  from: string;
  kind: string;
  text?: string;
  ts: number;
  hiddenFor?: string[];
  deletedForAll?: boolean;
  media?: { name?: string; durationMs?: number };
  location?: { label?: string };
  contact?: { name: string };
  poll?: { q: string; options?: { t: string }[] };
  agenda?: { title?: string; mode?: string };
  taskList?: { title?: string };
  noteShare?: { title?: string; text?: string };
  slots?: { title?: string };
  event?: { title: string; place?: string; description?: string };
};
export type LChat = { id: string; pinned?: boolean; createdAt: number; lastRead: number; markedUnread?: boolean };

export function fmtDur(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Icona (nome in '@/lib/icons') e testo breve di un messaggio, per lista chat, citazioni e ricerche. */
export function previewParts(m: LMsg): { icon?: string; text: string } {
  if (m.deletedForAll) return { icon: 'block', text: 'Questo messaggio è stato eliminato' };
  switch (m.kind) {
    case 'image': return { icon: 'image', text: m.text || 'Foto' };
    case 'video': return { icon: 'video', text: m.text || 'Video' };
    case 'audio': return { icon: 'mic', text: 'Vocale ' + fmtDur(m.media?.durationMs ?? 0) };
    case 'file': return { icon: 'file', text: m.media?.name ?? 'Documento' };
    case 'location': return { icon: 'location', text: m.location?.label ? 'Posizione: ' + m.location.label : 'Posizione' };
    case 'contact': return { icon: 'contact', text: m.contact?.name ? 'Contatto: ' + m.contact.name : 'Contatto' };
    case 'poll': return { icon: 'poll', text: m.poll?.q ? 'Sondaggio: ' + m.poll.q : 'Sondaggio' };
    case 'agenda': return { icon: 'calendar', text: m.agenda?.mode === 'liberi' ? 'Disponibilità: slot liberi' : m.agenda?.mode === 'occupato' ? 'Disponibilità: occupato/libero' : 'Agenda condivisa' };
    case 'tasks': return { icon: 'tasks', text: m.taskList?.title ? 'Lista task: ' + m.taskList.title : 'Lista task' };
    case 'note': return { icon: 'note', text: m.noteShare?.title ? 'Nota: ' + m.noteShare.title : 'Nota' };
    case 'slots': return { icon: 'clock', text: 'Proposta orari: ' + (m.slots?.title ?? '') };
    case 'event': return { icon: 'calendar', text: 'Invito: ' + (m.event?.title ?? 'evento') };
    default: return { text: m.text ?? '' };
  }
}
export const previewText = (m: LMsg) => previewParts(m).text;

/** Testo su cui cercare: anteprima più i dettagli delle schede (opzioni di sondaggio, luogo, descrizione, testo nota...). */
export function searchText(m: LMsg): string {
  if (m.deletedForAll) return '';
  return [previewText(m), m.text, m.poll?.options?.map((o) => o.t).join(' '), m.noteShare?.text, m.event?.place, m.event?.description, m.location?.label].filter(Boolean).join(' ').toLowerCase();
}

/** Messaggi visibili a `me`. */
export const visibleTo = <M extends LMsg>(msgs: M[] | undefined, me: string): M[] => (msgs ?? []).filter((m) => !m.hiddenFor?.includes(me));

/** L'ultimo messaggio per data (non per posizione nell'array: a parità vince il più tardi inserito). */
export function lastMessage<M extends LMsg>(msgs: M[]): M | undefined {
  let best: M | undefined;
  for (const m of msgs) if (!best || m.ts >= best.ts) best = m;
  return best;
}

export function unreadOf(chat: LChat, msgs: LMsg[], me: string): number {
  return msgs.filter((m) => m.from !== me && m.kind !== 'system' && m.ts > chat.lastRead && !m.hiddenFor?.includes(me)).length;
}

export type ChatRow<C extends LChat, M extends LMsg> = { c: C; last?: M; u: number; ts: number; unread: boolean };

export function buildRows<C extends LChat, M extends LMsg>(chats: C[], messages: Record<string, M[] | undefined>, me: string): ChatRow<C, M>[] {
  return chats.map((c) => {
    const msgs = visibleTo(messages[c.id], me);
    const last = lastMessage(msgs);
    const u = unreadOf(c, msgs, me);
    return { c, last, u, ts: last?.ts ?? c.createdAt, unread: u > 0 || !!c.markedUnread };
  });
}

/** Fissate in alto, poi dalla più recente. A parità di data l'ordine resta stabile (per nome non serve: usa createdAt). */
export function sortRows<R extends { c: { pinned?: boolean; createdAt: number }; ts: number }>(rows: R[]): R[] {
  return [...rows].sort((a, b) => Number(!!b.c.pinned) - Number(!!a.c.pinned) || b.ts - a.ts || b.c.createdAt - a.c.createdAt);
}

/** Riepilogo delle risposte a un invito: chi partecipa, chi forse, chi no. */
export function rsvpSummary(rsvp: Record<string, 'yes' | 'maybe' | 'no'> | undefined) {
  const out = { yes: [] as string[], maybe: [] as string[], no: [] as string[] };
  Object.entries(rsvp ?? {}).forEach(([who, a]) => { if (a in out) out[a].push(who); });
  return out;
}

/** Titolo con cui un evento entra nel Plan: se la risposta è "forse" è segnato come provvisorio. */
export const planTitleFor = (title: string, answer: 'yes' | 'maybe') => (answer === 'maybe' ? `${title} (forse)` : title);

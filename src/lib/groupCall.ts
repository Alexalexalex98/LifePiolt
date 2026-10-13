/**
 * Chiamate di gruppo programmate e istantanee nelle chat (modulo PURO, nessun alias '@/').
 * Programmata: qualcuno la fissa per un'ora; chi conferma la vede fissata in alto nella chat fino all'ora; all'ora si apre la stanza
 * e può entrare chi ha confermato o è stato invitato; chi non entra riceve un promemoria; da dentro, chi è presente può invitare altri
 * (solo persone del gruppo). Istantanea (come su WhatsApp): parte subito e si può aggiungere chiunque.
 */
export type CallRsvp = 'yes' | 'no';
export type CallShare = {
  title: string; kind: 'scheduled' | 'instant'; video: boolean; startsAt: number; durationMin: number; by: string;
  rsvp: Record<string, CallRsvp>; invited: string[]; joined: string[]; endedAt?: number;
  /** chi ha già ricevuto il promemoria «la call è iniziata» */ reminded?: string[];
  /** true = si possono invitare solo persone del gruppo (call programmate); false = chiunque (chiamate istantanee) */ restrictToGroup: boolean;
};
export type CallPhase = 'upcoming' | 'open' | 'ended';

/** Oltre la durata prevista la stanza resta aperta per altri 120 minuti, poi si chiude da sola. */
export const OVERRUN_MIN = 120;
/** Dopo quanti minuti dall'apertura chi non è entrato riceve il promemoria. */
export const REMIND_AFTER_MIN = 3;
export const MIN = 60000;

export function makeScheduled(o: { title: string; startsAt: number; durationMin?: number; video: boolean; by: string }): CallShare {
  return { title: o.title.trim() || 'Call di gruppo', kind: 'scheduled', video: o.video, startsAt: o.startsAt, durationMin: o.durationMin ?? 60, by: o.by, rsvp: { [o.by]: 'yes' }, invited: [], joined: [], restrictToGroup: true };
}
export function makeInstant(o: { title?: string; video: boolean; by: string; now: number; invited?: string[] }): CallShare {
  return { title: o.title?.trim() || (o.video ? 'Videochiamata' : 'Chiamata'), kind: 'instant', video: o.video, startsAt: o.now, durationMin: 60, by: o.by, rsvp: { [o.by]: 'yes' }, invited: [...new Set(o.invited ?? [])].filter((n) => n !== o.by), joined: [o.by], restrictToGroup: false };
}

export function phase(c: CallShare, now: number): CallPhase {
  if (c.endedAt != null) return 'ended';
  if (now < c.startsAt) return 'upcoming';
  return now < c.startsAt + (c.durationMin + OVERRUN_MIN) * MIN ? 'open' : 'ended';
}
/** Ha confermato o è stato invitato (o l'ha fissata lui). */
export const isInvolved = (c: CallShare, user: string): boolean => user === c.by || c.rsvp[user] === 'yes' || c.invited.includes(user);
export const confirmedList = (c: CallShare): string[] => [...new Set([c.by, ...Object.entries(c.rsvp).filter(([, a]) => a === 'yes').map(([n]) => n), ...c.invited])];
export const declinedList = (c: CallShare): string[] => Object.entries(c.rsvp).filter(([, a]) => a === 'no').map(([n]) => n);

/** Entra: la stanza è aperta e si è confermato o invitati. */
export function canEnter(c: CallShare, user: string, now: number): boolean { return phase(c, now) === 'open' && isInvolved(c, user); }

export type CallMsgLike = { id: string; from: string; kind: string; call?: CallShare; deletedForAll?: boolean };
/** Le call da tenere fissate in alto per `user`: fino all'ora (e poi mentre è aperta), solo se ha confermato o è invitato. */
export function pinnedFor<M extends CallMsgLike>(msgs: M[], user: string, now: number): M[] {
  return msgs.filter((m) => m.kind === 'call' && m.call && !m.deletedForAll && phase(m.call, now) !== 'ended' && isInvolved(m.call, user)).sort((a, b) => a.call!.startsAt - b.call!.startsAt);
}

export function applyRsvp(c: CallShare, user: string, ans: CallRsvp): CallShare {
  if (user === c.by && ans === 'no') return c; // chi la fissa c'è sempre (può annullarla)
  const rsvp = { ...c.rsvp, [user]: ans };
  return { ...c, rsvp, invited: ans === 'no' ? c.invited.filter((n) => n !== user) : c.invited };
}
export function applyJoin(c: CallShare, user: string): CallShare { return c.joined.includes(user) ? c : { ...c, joined: [...c.joined, user] }; }
export function applyLeave(c: CallShare, user: string, now: number): CallShare {
  const joined = c.joined.filter((n) => n !== user);
  return joined.length === 0 && phase(c, now) === 'open' && c.kind === 'instant' ? { ...c, joined, endedAt: now } : { ...c, joined };
}
export const applyEnd = (c: CallShare, now: number): CallShare => ({ ...c, joined: [], endedAt: now });

export type InviteCtx = { groupMembers: string[]; now: number };
/** Chi si può invitare da dentro la chiamata: solo chi è presente può invitare; nelle call programmate solo persone del gruppo. */
export function inviteError(c: CallShare, inviter: string, target: string, ctx: InviteCtx): string | null {
  if (phase(c, ctx.now) !== 'open') return 'La stanza non è aperta.';
  if (!c.joined.includes(inviter)) return 'Solo chi è nella chiamata può invitare altre persone.';
  if (isInvolved(c, target)) return 'Questa persona è già invitata.';
  if (c.restrictToGroup && !ctx.groupMembers.includes(target)) return 'Puoi invitare solo le persone di questo gruppo.';
  return null;
}
export function applyInvite(c: CallShare, inviter: string, target: string, ctx: InviteCtx): { call: CallShare; error?: string } {
  const error = inviteError(c, inviter, target, ctx);
  return error ? { call: c, error } : { call: { ...c, invited: [...c.invited, target] } };
}
/** Le persone che l'invitante può aggiungere (da mostrare nell'elenco). */
export function inviteCandidates(c: CallShare, groupMembers: string[], everyone: string[]): string[] {
  const pool = c.restrictToGroup ? groupMembers : [...new Set([...groupMembers, ...everyone])];
  return pool.filter((n) => !isInvolved(c, n));
}

/** Chi è confermato/invitato ma non è ancora entrato, a stanza aperta da almeno REMIND_AFTER_MIN minuti e non ancora avvisato. */
export function toRemind(c: CallShare, now: number): string[] {
  if (phase(c, now) !== 'open' || c.kind !== 'scheduled' || now < c.startsAt + REMIND_AFTER_MIN * MIN) return [];
  return confirmedList(c).filter((n) => !c.joined.includes(n) && !(c.reminded ?? []).includes(n));
}
/** Gli istanti dei promemoria per chi ha confermato: poco prima, all'apertura, e poco dopo se non è entrato. */
export const reminderTimes = (c: CallShare): { at: number; kind: 'soon' | 'open' | 'late' }[] => [
  { at: c.startsAt - 10 * MIN, kind: 'soon' }, { at: c.startsAt, kind: 'open' }, { at: c.startsAt + REMIND_AFTER_MIN * MIN, kind: 'late' },
];

/** Quanto manca (o è passato) in minuti arrotondati, per le etichette. */
export const minutesTo = (c: CallShare, now: number): number => Math.round((c.startsAt - now) / MIN);

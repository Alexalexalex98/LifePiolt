import { go } from '@/lib/nav';
import { useIncomingCall } from '@/store/incomingCall';
import { peoplePool } from '@/lib/network';
import { buildRef, pushData } from '@/lib/notifyLinks';
import { cancelByPrefix, scheduleAt } from '@/lib/notify';
import { applyEnd, applyHand, applyInvite, applyJoin, applyLeave, applyMute, applyRemove, applyRsvp, makeInstant, makeScheduled, reminderTimes, type CallRsvp, type CallShare } from '@/lib/groupCall';
import { t as tl } from '@/i18n/core';
import { useApp } from '@/store/app';
import { useChat, type ChatMessage } from '@/store/chat';
import { fmtDate, fmtTime } from '@/i18n/format';
import { toast } from '@/store/toast';

const st = () => useChat.getState();
const callOf = (chatId: string, mid: string): { msg: ChatMessage; call: CallShare } | null => {
  const msg = st().messages[chatId]?.find((m) => m.id === mid);
  return msg?.call ? { msg, call: msg.call } : null;
};
const say = (chatId: string, text: string) => { st().receive(chatId, 'system', { kind: 'system', text }); };
export const whenLabel = (ts: number) => `${fmtDate(ts, { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtTime(ts)}`;

/** Promemoria sul telefono di chi ha confermato: poco prima, all'apertura e se non è ancora entrato. */
export async function scheduleReminders(chatId: string, mid: string, call: CallShare): Promise<void> {
  const ref = buildRef('call', chatId, mid);
  const title = call.title;
  const texts = { soon: tl('Tra 10 minuti: {0}', title), open: tl('La call «{0}» è iniziata: entra', title), late: tl('{0} ti aspetta nella call «{1}»', call.by, title) };
  for (const r of reminderTimes(call)) await scheduleAt(`call:${mid}:${r.kind}`, new Date(r.at), tl('Call di gruppo'), texts[r.kind], pushData(ref, 'promemoria'), 'promemoria');
}
export const cancelReminders = (mid: string) => cancelByPrefix(`call:${mid}:`);

/** Fissa una call in un gruppo: la vedono tutti, chi conferma la ritrova fissata in alto fino all'ora. */
export function scheduleCall(chatId: string, me: string, o: { title: string; startsAt: number; durationMin: number; video: boolean; theia: boolean }): string {
  const call = makeScheduled({ ...o, by: me });
  const mid = st().send(chatId, me, { kind: 'call', text: call.title, call, callRecord: { theia: o.theia, transcript: [] } });
  void scheduleReminders(chatId, mid, call);
  // demo: qualcuno del gruppo risponde dopo qualche secondo
  if (useApp.getState().demo) {
    const others = (st().chats[chatId]?.members ?? []).filter((n) => n !== me).slice(0, 3);
    others.forEach((who, i) => setTimeout(() => respondAs(chatId, mid, who, i === 2 ? 'no' : 'yes'), 4000 + i * 3000));
  }
  return mid;
}

function patchCall(chatId: string, mid: string, fn: (c: CallShare) => CallShare): CallShare | null {
  const cur = callOf(chatId, mid);
  if (!cur) return null;
  const next = fn(cur.call);
  if (next !== cur.call) st().patchMsg(chatId, mid, { call: next });
  return next;
}
const respondAs = (chatId: string, mid: string, who: string, ans: CallRsvp) => { patchCall(chatId, mid, (c) => applyRsvp(c, who, ans)); };

/** Conferma o declina. Se conferma si programmano i promemoria, se declina si tolgono. */
export function respond(chatId: string, mid: string, me: string, ans: CallRsvp): void {
  const next = patchCall(chatId, mid, (c) => applyRsvp(c, me, ans));
  if (!next) return;
  if (ans === 'yes') { void scheduleReminders(chatId, mid, next); toast('Confermato: la call resta fissata in alto fino all\'ora'); }
  else { void cancelReminders(mid); toast('Hai detto che non ci sei'); }
}

/** Entra nella stanza (solo se aperta e se hai confermato o sei stato invitato: lo controlla chi chiama). */
export function enter(chatId: string, mid: string, me: string): void {
  patchCall(chatId, mid, (c) => applyJoin(c, me));
  void cancelReminders(mid);
  go('groupCall', { chat: chatId, mid });
}

/** Chiamata o videochiamata subito, come su WhatsApp: in un gruppo chiama tutti, in una chat a due l'altra persona; poi si può aggiungere chiunque. */
export function startCall(chatId: string, me: string, video: boolean): string | null {
  const chat = st().chats[chatId];
  if (!chat) return null;
  const invited = chat.members.filter((n) => n !== me);
  const call = makeInstant({ video, by: me, now: Date.now(), invited });
  const mid = st().send(chatId, me, { kind: 'call', text: call.title, call, callRecord: { theia: false, transcript: [] } });
  go('groupCall', { chat: chatId, mid });
  return mid;
}

/** Da dentro la chiamata: invita una persona (nelle call programmate solo del gruppo). */
export function invite(chatId: string, mid: string, inviter: string, target: string): string | null {
  const cur = callOf(chatId, mid);
  if (!cur) return 'Chiamata non trovata.';
  const groupMembers = st().chats[chatId]?.members ?? [];
  const r = applyInvite(cur.call, inviter, target, { groupMembers, now: Date.now() });
  if (r.error) return r.error;
  st().patchMsg(chatId, mid, { call: r.call });
  // chi non è già nella chat con la chiamata la riceve: si crea la chat a due con l'invito
  if (!groupMembers.includes(target)) {
    const dm = st().ensureDm(target, inviter);
    st().send(dm, inviter, { kind: 'text', text: tl('Ti ho aggiunto alla chiamata «{0}»', cur.call.title) });
  }
  say(chatId, tl('{0} ha invitato {1} alla chiamata', inviter, target));
  return null;
}

export function leave(chatId: string, mid: string, me: string): void {
  patchCall(chatId, mid, (c) => applyLeave(c, me, Date.now()));
}
export function endForAll(chatId: string, mid: string): void {
  patchCall(chatId, mid, (c) => applyEnd(c, Date.now()));
}
export const everyone = (me: string): string[] => peoplePool(me);

/** Segna una persona come presente nella stanza (all'ingresso; in demo anche gli altri che «arrivano»). */
export function applyJoinPresence(chatId: string, mid: string, who: string): void {
  patchCall(chatId, mid, (c) => applyJoin(c, who));
}

/** Demo: qualcuno ti chiama (voce o video): compare la schermata «Chiamata in arrivo» con Rispondi e Rifiuta. */
export function simulateIncoming(video: boolean, from?: string): void {
  const me = useApp.getState().account.name;
  const who = from ?? Object.values(st().chats).find((c) => c.type === 'dm')?.name ?? 'Marco T.';
  const chatId = st().ensureDm(who, me);
  const call = makeInstant({ video, by: who, now: Date.now(), invited: [me] });
  const mid = st().receive(chatId, who, { kind: 'call', text: call.title, call, callRecord: { theia: false, transcript: [] } });
  useIncomingCall.getState().ring({ chatId, mid, from: who, video });
}
/** Rispondi: entra nella stanza. Rifiuta: lo scrive nella chat. */
export function answerIncoming(): void {
  const cur = useIncomingCall.getState().current;
  if (!cur) return;
  const me = useApp.getState().account.name;
  useIncomingCall.getState().clear();
  enter(cur.chatId, cur.mid, me);
}
export function declineIncoming(): void {
  const cur = useIncomingCall.getState().current;
  if (!cur) return;
  const me = useApp.getState().account.name;
  useIncomingCall.getState().clear();
  patchCall(cur.chatId, cur.mid, (c) => applyEnd({ ...c, rsvp: { ...c.rsvp, [me]: 'no' } }, Date.now()));
  say(cur.chatId, tl('Chiamata rifiutata'));
}

/* ---------- come nelle dirette dei seminari ---------- */
export const raiseHand = (chatId: string, mid: string, me: string, up: boolean): void => { patchCall(chatId, mid, (c) => applyHand(c, me, up)); };
export const muteBy = (chatId: string, mid: string, by: string, target: string, on: boolean): void => { patchCall(chatId, mid, (c) => applyMute(c, by, target, on)); };
export function removeBy(chatId: string, mid: string, by: string, target: string): void {
  patchCall(chatId, mid, (c) => applyRemove(c, by, target));
  say(chatId, tl('{0} è stato rimosso dalla chiamata', target));
}
/** Un messaggio scritto durante la call (resta nella call, non nella chat). */
export function sendCallChat(chatId: string, mid: string, from: string, text: string): void {
  const cur = callOf(chatId, mid);
  const t = text.trim();
  if (!cur || !t) return;
  const rec = cur.msg.callRecord ?? { theia: false, transcript: [] };
  st().patchMsg(chatId, mid, { callRecord: { ...rec, chat: [...(rec.chat ?? []), { id: `${Date.now()}${Math.random().toString(36).slice(2, 5)}`, from, text: t.slice(0, 300), ts: Date.now() }].slice(-200) } });
}

import { anchorLabel, canWriteChat, questionLabel, slowWait, sortedLessons, type Anchor, type BillingPlan, type Club, type ClubComment, type Course, type Lesson } from '@/lib/club';
import { buildRef } from '@/lib/notifyLinks';
import { t } from '@/i18n/core';
import { useApp } from './app';
import { clubChatId, useChat, type ChatMessage, type ClubMsgMeta } from './chat';
import { memberCounts, mkey, useClub, viewerOf } from './club';
import { useNet } from './network';
import { toast } from './toast';

/**
 * Orchestrazione LifeClub <-> chat <-> notifiche. Tutto locale: con il server queste funzioni diventano chiamate di rete
 * (vedi docs/lifeclub.md). In modalita' demo il creatore "risponde" da solo per far vedere il flusso.
 */

const me = () => useApp.getState().account.name;
const isDemo = () => useApp.getState().demo;

export const lessonNumber = (course: Course, lessonId: string) => sortedLessons(course).findIndex((l) => l.id === lessonId) + 1;

export function findLesson(club: Club | undefined, lessonId: string): { course: Course; lesson: Lesson } | null {
  if (!club) return null;
  for (const course of club.courses) {
    const lesson = course.lessons.find((l) => l.id === lessonId);
    if (lesson) return { course, lesson };
  }
  return null;
}

/** Il canale del club compare nelle chat di chi e' iscritto/segue e nel proprio, se sono il creatore. */
export function ensureChat(club: Club): string {
  const user = me();
  return useChat.getState().ensureClubChat(club.id, club.name, club.owner, user, club.tagline || undefined);
}

function welcome(club: Club, chatId: string) {
  const chat = useChat.getState();
  if (club.owner === me() || chat.messages[chatId]?.some((m) => m.from === club.owner)) return;
  const text = club.chat.write === 'creator'
    ? `Benvenuto in «${club.name}». Qui scrivo io: aggiornamenti e novità. Le domande sulle lezioni si fanno nei commenti sotto ogni video.`
    : `Benvenuto in «${club.name}». Qui puoi scrivermi e fare domande, anche direttamente dalle lezioni.`;
  const id = chat.receive(chatId, club.owner, { kind: 'text', text, club: { kind: 'announce' } });
  chat.patchMsg(chatId, id, { pinned: true });
}

/** Segui: contenuti free, nessuna iscrizione. */
export function followClub(club: Club) {
  useClub.getState().follow(me(), club.id);
  ensureChat(club);
  toast(t('Segui «{0}»', club.name));
}

export function joinFreeClub(club: Club) {
  useClub.getState().joinFree(me(), club.id);
  welcome(club, ensureChat(club));
  toast(t('Ti sei iscritto a «{0}»', club.name));
}

/** DEMO: nessun addebito reale. */
export function joinPremiumClub(club: Club, plan: BillingPlan) {
  useClub.getState().joinPremium(me(), club.id, plan);
  welcome(club, ensureChat(club));
  toast(t('Premium attivato in anteprima: nessun addebito reale'));
}

/** Disiscrizione: free = subito (il canale sparisce dalle chat); premium = a fine periodo pagato. */
export function leaveClub(club: Club): { immediate: boolean; endsAt?: number } {
  const r = useClub.getState().cancel(me(), club.id);
  if (r.immediate) useChat.getState().deleteChat(clubChatId(club.id));
  return r;
}

export function resumeClub(club: Club) { useClub.getState().resume(me(), club.id); }

/** Notifica per l'utente di questo telefono, rispettando il silenziamento del club. */
export function clubNotify(club: Club, text: string, ref: string, kind: 'messaggio' | 'seminario' = 'messaggio') {
  const m = useClub.getState().memberships[mkey(club.id, me())];
  if (m?.mutedUntil && m.mutedUntil > Date.now()) return;
  const chat = useChat.getState().chats[clubChatId(club.id)];
  if (chat?.mutedUntil && chat.mutedUntil > Date.now()) return;
  useNet.getState().notify(kind === 'seminario' ? 'seminar' : 'message', text, false, { kind, ref });
}

/** Nuovo contenuto pubblicato dal creatore: annuncio nel canale + notifica agli iscritti (sul telefono: solo se non sono io l'autore). */
export function announceContent(club: Club, lesson: Lesson, course: Course) {
  const chat = useChat.getState();
  const cid = clubChatId(club.id);
  if (!chat.chats[cid]) return;
  const n = lessonNumber(course, lesson.id);
  chat.send(cid, club.owner, { kind: 'text', text: t('Nuova lezione: {0}', lesson.title), club: { kind: 'content', courseId: course.id, lessonId: lesson.id, lessonTitle: lesson.title, label: t('Lezione {0}', n) } });
  if (club.owner !== me()) clubNotify(club, t('{0}: nuova lezione «{1}»', club.name, lesson.title), buildRef('clubcontent', club.id, lesson.id), 'seminario');
}

/* ---------- domande e commenti ---------- */
export type AskInput = { club: Club; course: Course; lesson: Lesson; text: string; anchor?: Anchor; isQuestion: boolean; parentId?: string };

/**
 * Pubblica un commento/domanda sulla lezione. Se l'utente puo' scrivere nella chat del club, la domanda viene instradata ANCHE li'
 * (con il collegamento che riapre la lezione al punto giusto). Altrimenti resta nei commenti, se il creatore li abilita.
 */
export function postLessonComment(i: AskInput): { ok: boolean; reason?: string; commentId?: string; chatMsgId?: string } {
  const user = me();
  const st = useClub.getState();
  const v = viewerOf(st, i.club, user);
  const canChat = canWriteChat(i.club.chat, v).ok;
  const canCmt = user === i.club.owner || v.tier !== 'none';
  if (!canCmt) return { ok: false, reason: 'Iscriviti per commentare' };
  if (!canChat && !i.club.chat.commentsWhenReadOnly && user !== i.club.owner) return { ok: false, reason: 'Il creatore ha disattivato i commenti per il tuo livello' };
  const text = i.text.trim();
  if (!text) return { ok: false, reason: 'Scrivi qualcosa' };
  const commentId = st.addComment({ clubId: i.club.id, courseId: i.course.id, lessonId: i.lesson.id, author: user, text, anchor: i.anchor, parentId: i.parentId, isQuestion: i.isQuestion && !i.parentId });
  let chatMsgId: string | undefined;
  if (canChat && !i.parentId && (i.isQuestion || user === i.club.owner)) {
    const cid = ensureChat(i.club);
    const n = lessonNumber(i.course, i.lesson.id);
    const label = questionLabel(t('Lezione {0}', n), i.anchor);
    const meta: ClubMsgMeta = { kind: i.isQuestion ? 'question' : 'announce', courseId: i.course.id, lessonId: i.lesson.id, lessonTitle: i.lesson.title, label, commentId, ...(i.anchor?.kind === 'time' ? { sec: i.anchor.sec } : i.anchor?.kind === 'page' ? { page: i.anchor.page } : i.anchor?.kind === 'para' ? { para: i.anchor.para } : {}) };
    chatMsgId = useChat.getState().send(cid, user, { kind: 'text', text, club: meta });
    st.linkChatMsg(commentId, chatMsgId);
  }
  if (isDemo() && user !== i.club.owner && i.isQuestion && !i.parentId) simulateCreatorReply(i.club, commentId, chatMsgId);
  return { ok: true, commentId, chatMsgId };
}

/** Risposta nel thread di una domanda. Se la domanda ha un messaggio gemello in chat, la risposta compare anche li'. */
export function replyToComment(club: Club, parent: ClubComment, text: string): { ok: boolean; reason?: string; commentId?: string } {
  const user = me();
  const st = useClub.getState();
  const v = viewerOf(st, club, user);
  if (user !== club.owner && v.tier === 'none') return { ok: false, reason: 'Iscriviti per rispondere' };
  if (!text.trim()) return { ok: false, reason: 'Scrivi qualcosa' };
  const commentId = st.addComment({ clubId: club.id, courseId: parent.courseId, lessonId: parent.lessonId, author: user, text: text.trim(), anchor: parent.anchor, parentId: parent.id, isQuestion: false });
  if (parent.chatMsgId && useChat.getState().messages[clubChatId(club.id)]?.some((m) => m.id === parent.chatMsgId)) {
    const found = findLesson(club, parent.lessonId);
    useChat.getState().send(clubChatId(club.id), user, { kind: 'text', text: text.trim(), replyTo: parent.chatMsgId, club: { kind: 'answer', commentId, courseId: parent.courseId, lessonId: parent.lessonId, lessonTitle: found?.lesson.title, label: found ? questionLabel(t('Lezione {0}', lessonNumber(found.course, found.lesson.id)), parent.anchor) : undefined } });
  }
  return { ok: true, commentId };
}

const CANNED: Record<string, string[]> = {
  'club-cucina': ['Ottima domanda. Fai così: tieni il fuoco medio e aggiungi un mestolo d\'acqua se si asciuga troppo. Nella prossima lezione lo vediamo passo passo.', 'Sì, funziona benissimo anche con quello che hai in casa. Dimmi se ti viene bene!'],
  'club-corsa': ['Ascolta il corpo: se senti dolore, fermati e cammina. Meglio un giorno di riposo in più che una settimana ferma.', 'Va benissimo andare piano: se riesci a parlare mentre corri, il ritmo è quello giusto.'],
  'club-spagnolo': ['Bella domanda! La «j» si pronuncia come una «h» aspirata, dal fondo della gola. Ripeti con me nel prossimo audio.', 'In viaggio ti capiranno anche se sbagli: l\'importante è provare.'],
};

/** SOLO DEMO: dopo qualche secondo il creatore risponde (la risposta e' scritta dall'app, non da una persona). */
export function simulateCreatorReply(club: Club, commentId: string, chatMsgId?: string) {
  const list = CANNED[club.id] ?? ['Grazie per la domanda, ti rispondo con calma appena possibile.'];
  setTimeout(() => {
    const st = useClub.getState();
    const q = st.comments.find((c) => c.id === commentId);
    if (!q) return;
    const text = list[Math.floor(Math.random() * list.length)];
    const rid = st.addComment({ clubId: club.id, courseId: q.courseId, lessonId: q.lessonId, author: club.owner, text, anchor: q.anchor, parentId: q.id, isQuestion: false });
    const found = findLesson(club, q.lessonId);
    const cid = clubChatId(club.id);
    const chat = useChat.getState();
    if (chatMsgId && chat.messages[cid]?.some((m) => m.id === chatMsgId)) {
      chat.receive(cid, club.owner, { kind: 'text', text, replyTo: chatMsgId, club: { kind: 'answer', commentId: rid, courseId: q.courseId, lessonId: q.lessonId, lessonTitle: found?.lesson.title, label: found ? questionLabel(t('Lezione {0}', lessonNumber(found.course, found.lesson.id)), q.anchor) : undefined } });
    }
    clubNotify(club, t('{0} ha risposto alla tua domanda', club.owner), buildRef('clubcontent', club.id, q.lessonId, q.anchor?.kind === 'time' ? Math.floor(q.anchor.sec) : undefined));
  }, 5000);
}

/* ---------- chat ---------- */
export type SendResult = { ok: boolean; reason?: string };

export function canSendInClub(club: Club, chatMsgs: ChatMessage[] | undefined): { ok: boolean; reason?: string; wait?: number } {
  const user = me();
  const v = viewerOf(useClub.getState(), club, user);
  const d = canWriteChat(club.chat, v);
  if (!d.ok) return d;
  const last = [...(chatMsgs ?? [])].reverse().find((m) => m.from === user && m.kind !== 'system');
  const wait = slowWait(club.chat, user === club.owner, last?.ts);
  return wait > 0 ? { ok: false, wait, reason: t('Modalità lenta: puoi riscrivere tra {0} s', wait) } : { ok: true };
}

export { memberCounts, anchorLabel };

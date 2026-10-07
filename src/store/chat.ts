import { create } from 'zustand';

import { uid } from '@/lib/format';
import { persisted } from './persist';

export type MsgKind = 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'contact' | 'poll' | 'system';
export type MsgStatus = 'sending' | 'sent' | 'delivered' | 'read';

export type Media = { uri: string; w?: number; h?: number; mime?: string; name?: string; size?: number; durationMs?: number; waveform?: number[] };
export type Poll = { q: string; multi: boolean; options: { id: string; t: string; votes: string[] }[] };

export type ChatMessage = {
  id: string;
  chatId: string;
  from: string;
  kind: MsgKind;
  text?: string;
  ts: number;
  status: MsgStatus;
  replyTo?: string;
  reactions?: Record<string, string>; // persona -> emoji
  starredBy?: string[];
  edited?: boolean;
  deletedForAll?: boolean;
  hiddenFor?: string[];
  forwarded?: boolean;
  media?: Media;
  location?: { lat: number; lng: number; label?: string };
  contact?: { name: string; phone?: string };
  poll?: Poll;
  expiresAt?: number;
  viewOnce?: boolean;
  played?: boolean;
};

export type Chat = {
  id: string; // dm:<nome> oppure g:<id>
  type: 'dm' | 'group';
  name: string;
  members: string[];
  admins: string[];
  description?: string;
  pinned?: boolean;
  archived?: boolean;
  mutedUntil?: number;
  markedUnread?: boolean;
  disappearingSec?: number; // 0/undefined = off
  wallpaper?: string;
  draft?: string;
  lastRead: number; // timestamp dell'ultimo messaggio visto
  blocked?: boolean;
  createdAt: number;
};

export type ChatSettings = {
  readReceipts: boolean;
  enterSends: boolean;
  fontSize: 'S' | 'M' | 'L';
  mediaAutoDownload: boolean;
  defaultDisappearingSec: number;
  wallpaper: string;
};

export const DAY = 86400000;
export const EDIT_WINDOW = 15 * 60 * 1000;
export const DELETE_ALL_WINDOW = 2 * 24 * 3600 * 1000;
export const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export const dmId = (name: string) => `dm:${name}`;
export const groupChatId = (id: string | number) => `g:${id}`;

type ChatState = {
  chats: Record<string, Chat>;
  messages: Record<string, ChatMessage[]>;
  settings: ChatSettings;
  blocked: string[];

  ensureDm: (name: string, me: string) => string;
  createGroup: (name: string, members: string[], me: string, description?: string) => string;
  patchChat: (id: string, p: Partial<Chat>) => void;
  deleteChat: (id: string) => void;
  clearChat: (id: string, keepStarred?: boolean) => void;
  markRead: (id: string, me: string) => void;
  setSettings: (p: Partial<ChatSettings>) => void;

  send: (id: string, me: string, m: Partial<ChatMessage> & { kind: MsgKind }) => string;
  receive: (id: string, from: string, m: Partial<ChatMessage> & { kind: MsgKind }) => string;
  patchMsg: (id: string, mid: string, p: Partial<ChatMessage>) => void;
  deleteForMe: (id: string, mids: string[], me: string) => void;
  deleteForAll: (id: string, mid: string) => void;
  editMsg: (id: string, mid: string, text: string) => void;
  react: (id: string, mid: string, me: string, emoji: string | null) => void;
  toggleStar: (id: string, mids: string[], me: string) => boolean;
  forward: (toIds: string[], msgs: ChatMessage[], me: string) => void;
  votePoll: (id: string, mid: string, optId: string, me: string) => void;
  addMembers: (id: string, names: string[], me: string) => void;
  removeMember: (id: string, name: string, me: string) => void;
  leaveGroup: (id: string, me: string) => void;
  setAdmin: (id: string, name: string, on: boolean) => void;
  setDisappearing: (id: string, sec: number, me: string) => void;
  block: (name: string, on: boolean) => void;
  purgeExpired: () => void;
  reset: () => void;
};

const defaultSettings: ChatSettings = { readReceipts: true, enterSends: false, fontSize: 'M', mediaAutoDownload: true, defaultDisappearingSec: 0, wallpaper: 'default' };

const initial = { chats: {} as Record<string, Chat>, messages: {} as Record<string, ChatMessage[]>, settings: defaultSettings, blocked: [] as string[] };

const sys = (chatId: string, text: string): ChatMessage => ({ id: uid(), chatId, from: 'system', kind: 'system', text, ts: Date.now(), status: 'read' });

export const useChat = create<ChatState>()(
  persisted<ChatState>('chat', (set, get) => ({
    ...initial,

    ensureDm: (name, me) => {
      const id = dmId(name);
      if (!get().chats[id]) set((s) => ({ chats: { ...s.chats, [id]: { id, type: 'dm', name, members: [me, name], admins: [], lastRead: Date.now(), createdAt: Date.now(), disappearingSec: s.settings.defaultDisappearingSec || undefined } } }));
      return id;
    },
    createGroup: (name, members, me, description) => {
      const gid = `g:${uid()}`;
      const chat: Chat = { id: gid, type: 'group', name, members: [me, ...members.filter((m) => m !== me)], admins: [me], description, lastRead: Date.now(), createdAt: Date.now() };
      set((s) => ({ chats: { ...s.chats, [gid]: chat }, messages: { ...s.messages, [gid]: [sys(gid, `${me} ha creato il gruppo "${name}"`)] } }));
      return gid;
    },
    patchChat: (id, p) => set((s) => (s.chats[id] ? { chats: { ...s.chats, [id]: { ...s.chats[id], ...p } } } : s)),
    deleteChat: (id) => set((s) => { const chats = { ...s.chats }; const messages = { ...s.messages }; delete chats[id]; delete messages[id]; return { chats, messages }; }),
    clearChat: (id, keepStarred) => set((s) => ({ messages: { ...s.messages, [id]: (s.messages[id] ?? []).filter((m) => keepStarred && m.starredBy?.length) } })),
    markRead: (id, me) => {
      const msgs = get().messages[id] ?? [];
      const last = msgs[msgs.length - 1];
      const chat = get().chats[id];
      if (!chat) return;
      const lastTs = last?.ts ?? Date.now();
      if (chat.lastRead >= lastTs && !chat.markedUnread) return;
      set((s) => ({
        chats: { ...s.chats, [id]: { ...s.chats[id], lastRead: Math.max(lastTs, Date.now()), markedUnread: false } },
        // ho letto i messaggi altrui: niente da cambiare; (i miei restano come sono)
        messages: s.messages,
      }));
      void me;
    },
    setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),

    send: (id, me, m) => {
      const chat = get().chats[id];
      const mid = uid();
      const sec = chat?.disappearingSec;
      const msg: ChatMessage = { ...m, id: mid, chatId: id, from: me, kind: m.kind, ts: Date.now(), status: 'sent', expiresAt: sec ? Date.now() + sec * 1000 : undefined };
      set((s) => ({
        messages: { ...s.messages, [id]: [...(s.messages[id] ?? []), msg] },
        chats: s.chats[id] ? { ...s.chats, [id]: { ...s.chats[id], draft: '', lastRead: Date.now(), archived: false } } : s.chats,
      }));
      return mid;
    },
    receive: (id, from, m) => {
      const mid = uid();
      const sec = get().chats[id]?.disappearingSec;
      const msg: ChatMessage = { ...m, id: mid, chatId: id, from, kind: m.kind, ts: m.ts ?? Date.now(), status: 'read', expiresAt: sec ? Date.now() + sec * 1000 : undefined };
      set((s) => ({ messages: { ...s.messages, [id]: [...(s.messages[id] ?? []), msg] } }));
      return mid;
    },
    patchMsg: (id, mid, p) => set((s) => ({ messages: { ...s.messages, [id]: (s.messages[id] ?? []).map((m) => (m.id === mid ? { ...m, ...p } : m)) } })),
    deleteForMe: (id, mids, me) => set((s) => ({ messages: { ...s.messages, [id]: (s.messages[id] ?? []).map((m) => (mids.includes(m.id) ? { ...m, hiddenFor: [...(m.hiddenFor ?? []), me] } : m)) } })),
    deleteForAll: (id, mid) => set((s) => ({ messages: { ...s.messages, [id]: (s.messages[id] ?? []).map((m) => (m.id === mid ? { ...m, deletedForAll: true, text: undefined, media: undefined, location: undefined, contact: undefined, poll: undefined, reactions: undefined, starredBy: undefined } : m)) } })),
    editMsg: (id, mid, text) => set((s) => ({ messages: { ...s.messages, [id]: (s.messages[id] ?? []).map((m) => (m.id === mid ? { ...m, text, edited: true } : m)) } })),
    react: (id, mid, me, emoji) => set((s) => ({
      messages: {
        ...s.messages,
        [id]: (s.messages[id] ?? []).map((m) => {
          if (m.id !== mid) return m;
          const r = { ...(m.reactions ?? {}) };
          if (!emoji || r[me] === emoji) delete r[me]; else r[me] = emoji;
          return { ...m, reactions: r };
        }),
      },
    })),
    toggleStar: (id, mids, me) => {
      const msgs = get().messages[id] ?? [];
      const allStarred = mids.every((x) => msgs.find((m) => m.id === x)?.starredBy?.includes(me));
      set((s) => ({
        messages: {
          ...s.messages,
          [id]: (s.messages[id] ?? []).map((m) => {
            if (!mids.includes(m.id)) return m;
            const cur = m.starredBy ?? [];
            return { ...m, starredBy: allStarred ? cur.filter((x) => x !== me) : cur.includes(me) ? cur : [...cur, me] };
          }),
        },
      }));
      return !allStarred;
    },
    forward: (toIds, msgs, me) => {
      toIds.forEach((to) => {
        msgs.forEach((m) => {
          get().send(to, me, { kind: m.kind, text: m.text, media: m.media, location: m.location, contact: m.contact, poll: m.poll ? { ...m.poll, options: m.poll.options.map((o) => ({ ...o, votes: [] })) } : undefined, forwarded: true });
        });
      });
    },
    votePoll: (id, mid, optId, me) => set((s) => ({
      messages: {
        ...s.messages,
        [id]: (s.messages[id] ?? []).map((m) => {
          if (m.id !== mid || !m.poll) return m;
          const options = m.poll.options.map((o) => {
            const has = o.votes.includes(me);
            if (o.id === optId) return { ...o, votes: has ? o.votes.filter((v) => v !== me) : [...o.votes, me] };
            return m.poll!.multi ? o : { ...o, votes: o.votes.filter((v) => v !== me) };
          });
          return { ...m, poll: { ...m.poll, options } };
        }),
      },
    })),
    addMembers: (id, names, me) => set((s) => {
      const c = s.chats[id]; if (!c) return s;
      const add = names.filter((n) => !c.members.includes(n));
      if (!add.length) return s;
      return { chats: { ...s.chats, [id]: { ...c, members: [...c.members, ...add] } }, messages: { ...s.messages, [id]: [...(s.messages[id] ?? []), sys(id, `${me} ha aggiunto ${add.join(', ')}`)] } };
    }),
    removeMember: (id, name, me) => set((s) => {
      const c = s.chats[id]; if (!c) return s;
      return { chats: { ...s.chats, [id]: { ...c, members: c.members.filter((m) => m !== name), admins: c.admins.filter((m) => m !== name) } }, messages: { ...s.messages, [id]: [...(s.messages[id] ?? []), sys(id, `${me} ha rimosso ${name}`)] } };
    }),
    leaveGroup: (id, me) => set((s) => {
      const c = s.chats[id]; if (!c) return s;
      const members = c.members.filter((m) => m !== me);
      const admins = c.admins.filter((m) => m !== me);
      if (members.length && !admins.length) admins.push(members[0]);
      return { chats: { ...s.chats, [id]: { ...c, members, admins, archived: false } }, messages: { ...s.messages, [id]: [...(s.messages[id] ?? []), sys(id, `${me} ha lasciato il gruppo`)] } };
    }),
    setAdmin: (id, name, on) => set((s) => {
      const c = s.chats[id]; if (!c) return s;
      return { chats: { ...s.chats, [id]: { ...c, admins: on ? [...new Set([...c.admins, name])] : c.admins.filter((a) => a !== name) } } };
    }),
    setDisappearing: (id, sec, me) => set((s) => {
      const c = s.chats[id]; if (!c) return s;
      const label = sec === 0 ? 'ha disattivato i messaggi a tempo' : `ha attivato i messaggi a tempo (${sec >= DAY / 1000 * 30 ? '90 giorni' : sec >= DAY / 1000 * 7 ? '7 giorni' : sec >= DAY / 1000 ? '24 ore' : `${sec} s`})`;
      return { chats: { ...s.chats, [id]: { ...c, disappearingSec: sec || undefined } }, messages: { ...s.messages, [id]: [...(s.messages[id] ?? []), sys(id, `${me} ${label}`)] } };
    }),
    block: (name, on) => set((s) => ({ blocked: on ? [...new Set([...s.blocked, name])] : s.blocked.filter((b) => b !== name) })),
    purgeExpired: () => {
      const now = Date.now();
      const s = get();
      let changed = false;
      const messages: Record<string, ChatMessage[]> = {};
      Object.keys(s.messages).forEach((k) => {
        const kept = s.messages[k].filter((m) => !m.expiresAt || m.expiresAt > now);
        if (kept.length !== s.messages[k].length) changed = true;
        messages[k] = kept;
      });
      if (changed) set({ messages });
    },
    reset: () => set({ ...initial }),
  })),
);

/* ---------- selettori ---------- */
export const visibleMsgs = (msgs: ChatMessage[] | undefined, me: string) => (msgs ?? []).filter((m) => !m.hiddenFor?.includes(me));

export const isMuted = (c: Chat) => !!c.mutedUntil && c.mutedUntil > Date.now();

export function unreadCount(chat: Chat, msgs: ChatMessage[] | undefined, me: string) {
  return (msgs ?? []).filter((m) => m.from !== me && m.kind !== 'system' && m.ts > chat.lastRead && !m.hiddenFor?.includes(me)).length;
}

export function totalUnread(me: string): number {
  const s = useChat.getState();
  let n = 0;
  Object.values(s.chats).forEach((c) => {
    if (c.archived && isMuted(c)) return;
    const u = unreadCount(c, s.messages[c.id], me);
    if (u > 0 || c.markedUnread) n++;
  });
  return n;
}

/** Testo breve per anteprima in lista e per le risposte citate. */
export function previewOf(m: ChatMessage): string {
  if (m.deletedForAll) return 'Questo messaggio è stato eliminato';
  switch (m.kind) {
    case 'image': return '📷 ' + (m.text || 'Foto');
    case 'video': return '🎥 ' + (m.text || 'Video');
    case 'audio': return '🎤 Messaggio vocale ' + fmtDur(m.media?.durationMs ?? 0);
    case 'file': return '📄 ' + (m.media?.name ?? 'Documento');
    case 'location': return '📍 Posizione';
    case 'contact': return '👤 ' + (m.contact?.name ?? 'Contatto');
    case 'poll': return '📊 ' + (m.poll?.q ?? 'Sondaggio');
    default: return m.text ?? '';
  }
}

export function fmtDur(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtClock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const wd = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export function dayLabel(ts: number): string {
  const d = new Date(ts), now = new Date();
  if (sameDay(d, now)) return 'Oggi';
  const y = new Date(now.getTime() - DAY);
  if (sameDay(d, y)) return 'Ieri';
  if (now.getTime() - ts < 6 * DAY) return wd[d.getDay()];
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Ora per la lista chat: orario oggi, "Ieri", poi data. */
export function listTime(ts: number): string {
  const d = new Date(ts), now = new Date();
  if (sameDay(d, now)) return fmtClock(ts);
  if (sameDay(d, new Date(now.getTime() - DAY))) return 'Ieri';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
}

export const urlRe = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

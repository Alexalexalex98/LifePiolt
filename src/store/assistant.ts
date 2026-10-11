import { create } from 'zustand';

import { uid } from '@/lib/format';
import { t } from '@/i18n/core';
import { norm, topicOf } from '@/lib/assistant/nlp';
import { useLife } from './life';
import type { TheiaExt } from '@/lib/assistant/theiaExt';
import { persisted } from './persist';

export const GENERALE = 'Generale';
export type AMsg = { id: string; who: 'me' | 'ai'; text: string; ts: number; topic: string; chips?: string[]; source?: 'chat' | 'theia'; image?: string;
  /** immagini allegate, provider della risposta, azioni (riprova, conferma...): vedi theiaExt.ts */
  ext?: TheiaExt };

type AState = {
  /** UN'unica conversazione con tutto quello che ci si è detti; le sezioni mostrano solo i pezzi con lo stesso argomento. */
  log: AMsg[];
  /** argomento attivo (continua finché non si parla d'altro) */
  current: string;
  push: (m: Omit<AMsg, 'id' | 'ts' | 'topic'> & { topic?: string }) => AMsg;
  setChips: (id: string, chips: string[] | undefined) => void;
  patchMsg: (id: string, p: Partial<AMsg>) => void;
  delMsg: (id: string) => void;
  clearTopic: (topic: string) => void;
  reset: () => void;
};

/** Nome mostrato di una cartella/argomento (le chiavi interne restano italiane). */
export function topicLabel(topic: string): string {
  switch (topic) {
    case 'Generale': return t('Generale');
    case 'Finanze': return t('Finanze');
    case 'Salute': return t('Salute');
    case 'Fitness': return t('Fitness');
    case 'Mente': return t('Mente');
    case 'Lavoro': return t('Lavoro');
    case 'Studio': return t('Studio');
    case 'Viaggi': return t('Viaggi');
    case 'Casa': return t('Casa');
    case 'Legale': return t('Legale');
    case 'Musica': return t('Musica');
    case 'Arte': return t('Arte');
    case 'Cucina': return t('Cucina');
    case 'Cinema': return t('Cinema');
    case 'Tecnologia': return t('Tecnologia');
    case 'Piano': return t('Piano');
    default: return topic;
  }
}

/** Argomento di un nuovo messaggio dell'utente: quello che riconosce, altrimenti continua il discorso se è recente. */
export function topicFor(text: string, last: AMsg | undefined): string {
  const t = topicOf(text);
  if (t) return t;
  if (last && last.topic !== GENERALE && Date.now() - last.ts < 10 * 60000) return last.topic;
  return GENERALE;
}

export const useAssistant = create<AState>()(
  persisted<AState>('assistant', (set, get) => ({
    log: [],
    current: GENERALE,
    push: (m) => {
      const st = get();
      const last = st.log[st.log.length - 1];
      const topic = m.topic ?? (m.who === 'me' ? topicFor(m.text, last) : st.current);
      const msg: AMsg = { ...m, id: uid(), ts: Date.now(), topic };
      set({ log: [...st.log.slice(-1999), msg], current: topic });
      return msg;
    },
    patchMsg: (id, p) => set((s) => ({ log: s.log.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
    setChips: (id, chips) => set((s) => ({ log: s.log.map((x) => (x.id === id ? { ...x, chips } : x)) })),
    delMsg: (id) => set((s) => ({ log: s.log.filter((x) => x.id !== id) })),
    clearTopic: (topic) => set((s) => ({ log: s.log.filter((x) => x.topic !== topic) })),
    reset: () => set({ log: [], current: GENERALE }),
  })),
);

/** Cartelle create da sole: una per ogni argomento di cui si è parlato, ordinate per ultimo messaggio. */
export function foldersOf(log: AMsg[]): { topic: string; count: number; last: AMsg }[] {
  const m = new Map<string, { topic: string; count: number; last: AMsg }>();
  log.forEach((x) => {
    if (x.topic === GENERALE) return;
    const e = m.get(x.topic);
    m.set(x.topic, { topic: x.topic, count: (e?.count ?? 0) + 1, last: x });
  });
  return [...m.values()].sort((a, b) => b.last.ts - a.last.ts);
}

/** Ricerca nei messaggi (domande e risposte), come nelle app di chat AI. */
export function searchLog(log: AMsg[], q: string): AMsg[] {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return log.filter((x) => { const n = norm(x.text); return words.every((w) => n.includes(w)); }).reverse();
}

/** Porta nella nuova chat quello che era nel vecchio archivio per argomento (una sola volta). */
export function migrateOldChat() {
  const st = useAssistant.getState();
  if (st.log.length) return;
  const old = (useLife.getState() as unknown as { chat?: Record<string, { who: 'me' | 'ai'; text: string }[]> }).chat;
  if (!old) return;
  const map: Record<string, string> = { Finance: 'Finanze', Health: 'Salute', Fitness: 'Fitness', Study: 'Studio', Mind: 'Mente', Casa: 'Casa', Viaggi: 'Viaggi', Legal: 'Legale', Business: 'Lavoro' };
  Object.entries(old).forEach(([cat, msgs]) => msgs.forEach((m, i) => { if (i === 0 && m.who === 'ai' && !msgs.some((x) => x.who === 'me')) return; st.push({ who: m.who, text: m.text, topic: map[cat] ?? GENERALE }); }));
}

import { create } from 'zustand';

import { dayKey, type JEntry } from '@/lib/journalCore';

import { persisted } from './persist';

/** Il diario personale: una pagina per giorno, cifrato sul telefono, mai sincronizzato né dato a Theia nelle chat. */
export type JReport = { id: string; ts: number; from: string; to: string; text: string };
type State = {
  entries: Record<string, JEntry>;
  reports: JReport[];
  /** scrive (o sostituisce) il testo della pagina del giorno */
  setText: (day: string, text: string, via?: 'typed' | 'voice') => void;
  /** aggiunge un pezzo dettato in fondo alla pagina */
  append: (day: string, text: string, via: 'typed' | 'voice') => void;
  removeDay: (day: string) => void;
  addReport: (r: Omit<JReport, 'id' | 'ts'>) => void;
  removeReport: (id: string) => void;
  clear: () => void;
};
const uid = () => Math.random().toString(36).slice(2, 9);
const withText = (cur: JEntry | undefined, day: string, text: string, via: 'typed' | 'voice'): JEntry => ({ day, updated: Date.now(), segs: [{ id: cur?.segs[0]?.id ?? uid(), ts: cur?.segs[0]?.ts ?? Date.now(), text, via: cur?.segs[0]?.via === 'voice' ? 'voice' : via }] });

export const useJournal = create<State>()(
  persisted<State>('journal', (set) => ({
    entries: {}, reports: [],
    setText: (day, text, via = 'typed') => set((s) => { const next = { ...s.entries }; if (!text.trim()) delete next[day]; else next[day] = withText(s.entries[day], day, text, via); return { entries: next }; }),
    append: (day, text, via) => set((s) => { const cur = s.entries[day]; const old = (cur?.segs ?? []).map((x) => x.text).join('\n\n').trim(); const merged = old ? `${old}\n\n${text.trim()}` : text.trim(); return { entries: { ...s.entries, [day]: withText(cur, day, merged, via) } }; }),
    removeDay: (day) => set((s) => { const next = { ...s.entries }; delete next[day]; return { entries: next }; }),
    addReport: (r) => set((s) => ({ reports: [{ ...r, id: uid(), ts: Date.now() }, ...s.reports].slice(0, 30) })),
    removeReport: (id) => set((s) => ({ reports: s.reports.filter((r) => r.id !== id) })),
    clear: () => set({ entries: {}, reports: [] }),
  }), (s) => ({ entries: s.entries, reports: s.reports }), { sensitive: true }),
);
export const todayKey = (): string => dayKey();

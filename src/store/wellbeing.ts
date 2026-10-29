import { create } from 'zustand';

import type { QKind } from '@/lib/wellbeing/questionnaires';
import { persisted } from './persist';

export type WbNoteKind = 'evento' | 'conflitto' | 'salute' | 'farmaco' | 'storia' | 'trauma' | 'valore' | 'personalita' | 'persona_fiducia' | 'adhd' | 'ansia';
export const NOTE_LABEL: Record<WbNoteKind, string> = { evento: 'Evento recente', conflitto: 'Conflitto o ingiustizia', salute: 'Salute o dolore', farmaco: 'Farmaci', storia: 'Storia personale', trauma: 'Vissuto difficile', valore: 'Valori e senso di scopo', personalita: 'Come sei fatto/a', persona_fiducia: 'Persona di fiducia', adhd: 'ADHD (dichiarato da te)', ansia: 'Ansia e pensieri' };
/** Qualcosa che l'utente ha scelto di raccontare in chat: una riga breve, sul telefono, cancellabile. */
export type WbNote = { id: string; ts: number; kind: WbNoteKind; note: string };
export type WbResult = { id: string; ts: number; kind: QKind; score: number; max: number; label: string };
type State = {
  /** consenso esplicito al monitoraggio del benessere (dati sanitari): senza, nessun calcolo e nessun questionario */
  consent: boolean;
  consentAt: number;
  results: WbResult[];
  notes: WbNote[];
  /** questionario in corso (risposte date finora) */
  progress: { kind: QKind; answers: number[] } | null;
  /** ultima volta che Theia ha proposto un questionario / segnalato un cambiamento (per non insistere) */
  lastOffer: number;
  lastNotice: number;
  setConsent: (v: boolean) => void;
  addNote: (kind: WbNoteKind, note: string) => WbNote;
  removeNote: (id: string) => void;
  start: (kind: QKind) => void;
  answer: (v: number) => { kind: QKind; answers: number[] } | null;
  finish: (r: Omit<WbResult, 'id' | 'ts'>) => void;
  cancel: () => void;
  mark: (patch: Partial<Pick<State, 'lastOffer' | 'lastNotice'>>) => void;
  /** cancella tutto ciò che riguarda il benessere (risultati, progresso, consenso) */
  clearAll: () => void;
};

const empty = { consent: false, consentAt: 0, results: [] as WbResult[], notes: [] as WbNote[], progress: null as State['progress'], lastOffer: 0, lastNotice: 0 };

export const useWellbeing = create<State>()(
  persisted<State>('wellbeing', (set, get) => ({
    ...empty,
    setConsent: (v) => set(v ? { consent: true, consentAt: Date.now() } : { consent: false }),
    addNote: (kind, note) => { const n: WbNote = { id: Math.random().toString(36).slice(2), ts: Date.now(), kind, note: note.trim().slice(0, 160) }; set((s) => ({ notes: [n, ...s.notes].slice(0, 80) })); return n; },
    removeNote: (id) => set((s) => ({ notes: s.notes.filter((x) => x.id !== id) })),
    start: (kind) => set({ progress: { kind, answers: [] } }),
    answer: (v) => { const p = get().progress; if (!p) return null; const next = { kind: p.kind, answers: [...p.answers, v] }; set({ progress: next }); return next; },
    finish: (r) => set((s) => ({ progress: null, results: [{ id: Math.random().toString(36).slice(2), ts: Date.now(), ...r }, ...s.results].slice(0, 60) })),
    cancel: () => set({ progress: null }),
    mark: (patch) => set(patch),
    clearAll: () => set({ ...empty }),
  }), (s) => ({ consent: s.consent, consentAt: s.consentAt, results: s.results, notes: s.notes, progress: s.progress, lastOffer: s.lastOffer, lastNotice: s.lastNotice }), { sensitive: true }),
);

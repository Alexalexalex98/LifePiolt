import { create } from 'zustand';

import { uid } from '@/lib/format';
import type { BodySlot } from '@/lib/fitness/bodyCheck';

import { persisted } from './persist';

/** Foto del corpo e analisi: dati molto personali, restano SOLO sul telefono (archivio protetto). Mai in LifeDrive, mai sul server. */
export type BodyReport = { id: string; ts: number; text: string; /** le 4 foto di quel giorno (per vedere i progressi) */ photos?: Partial<Record<BodySlot, string>> };
type State = {
  photos: Partial<Record<BodySlot, string>>;
  reports: BodyReport[];
  /** l'utente ha scelto di non fare le foto del corpo: niente schede e niente promemoria */
  skip: boolean;
  setSkip: (v: boolean) => void;
  setPhoto: (slot: BodySlot, uri: string | undefined) => void;
  addReport: (text: string, photos?: Partial<Record<BodySlot, string>>) => string;
  delReport: (id: string) => void;
  clearPhotos: () => void;
  reset: () => void;
};
export const useBodyCheck = create<State>()(persisted<State>('body-check', (set) => ({
  photos: {},
  reports: [],
  skip: false,
  setSkip: (v) => set({ skip: v }),
  setPhoto: (slot, uri) => set((s) => ({ photos: { ...s.photos, [slot]: uri } })),
  addReport: (text, photos) => { const id = uid(); set((s) => ({ reports: [{ id, ts: Date.now(), text, ...(photos ? { photos } : {}) }, ...s.reports].slice(0, 30), photos: photos ? {} : s.photos })); return id; },
  delReport: (id) => set((s) => ({ reports: s.reports.filter((r) => r.id !== id) })),
  clearPhotos: () => set({ photos: {} }),
  reset: () => set({ photos: {}, reports: [] }),
}), undefined, { sensitive: true }));

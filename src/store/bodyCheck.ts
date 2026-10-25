import { create } from 'zustand';

import { uid } from '@/lib/format';
import type { BodySlot } from '@/lib/fitness/bodyCheck';

import { persisted } from './persist';

/** Foto del corpo e analisi: dati molto personali, restano SOLO sul telefono (archivio protetto). Mai in LifeDrive, mai sul server. */
export type BodyReport = { id: string; ts: number; text: string };
type State = {
  photos: Partial<Record<BodySlot, string>>;
  reports: BodyReport[];
  setPhoto: (slot: BodySlot, uri: string | undefined) => void;
  addReport: (text: string) => string;
  delReport: (id: string) => void;
  clearPhotos: () => void;
  reset: () => void;
};
export const useBodyCheck = create<State>()(persisted<State>('body-check', (set) => ({
  photos: {},
  reports: [],
  setPhoto: (slot, uri) => set((s) => ({ photos: { ...s.photos, [slot]: uri } })),
  addReport: (text) => { const id = uid(); set((s) => ({ reports: [{ id, ts: Date.now(), text }, ...s.reports].slice(0, 30) })); return id; },
  delReport: (id) => set((s) => ({ reports: s.reports.filter((r) => r.id !== id) })),
  clearPhotos: () => set({ photos: {} }),
  reset: () => set({ photos: {}, reports: [] }),
}), undefined, { sensitive: true }));

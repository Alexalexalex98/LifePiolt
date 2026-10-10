import { create } from 'zustand';

import { persisted } from './persist';

/** Interessi scelti dall'utente: servono a personalizzare proposte (attese prima di un incontro, viaggi, idee). */
export const INTEREST_CATALOG = [
  { id: 'caffe', label: 'Bar e caffetterie', osm: ['amenity=cafe', 'amenity=bar'] },
  { id: 'architettura', label: 'Architettura', osm: ['building=cathedral', 'building=palace', 'tourism=attraction', 'historic=building'] },
  { id: 'storia', label: 'Storia e monumenti', osm: ['historic=monument', 'historic=castle', 'historic=memorial', 'historic=building'] },
  { id: 'musei', label: 'Musei e arte', osm: ['tourism=museum', 'tourism=gallery', 'tourism=artwork'] },
  { id: 'citta', label: 'Passeggiare e vedere la città', osm: ['tourism=viewpoint', 'tourism=attraction', 'leisure=park'] },
  { id: 'natura', label: 'Natura e parchi', osm: ['leisure=park', 'natural=beach', 'leisure=garden'] },
  { id: 'cucina', label: 'Cucina locale', osm: ['amenity=restaurant', 'amenity=ice_cream', 'shop=bakery'] },
  { id: 'shopping', label: 'Shopping', osm: ['shop=mall', 'shop=clothes', 'shop=books'] },
  { id: 'libri', label: 'Libri e librerie', osm: ['shop=books', 'amenity=library'] },
  { id: 'sport', label: 'Sport e movimento', osm: ['leisure=fitness_centre', 'leisure=sports_centre', 'leisure=park'] },
  { id: 'musica', label: 'Musica e concerti', osm: ['amenity=music_venue', 'amenity=theatre', 'amenity=arts_centre'] },
  { id: 'relax', label: 'Relax e benessere', osm: ['leisure=spa', 'leisure=park', 'amenity=cafe'] },
] as const;
export type InterestId = (typeof INTEREST_CATALOG)[number]['id'];

type State = {
  selected: InterestId[];
  /** ricerche recenti (persone, viaggi, luoghi): utili per capire cosa interessa */
  recent: { q: string; kind: 'viaggio' | 'luogo' | 'altro'; ts: number }[];
  /** luogo d'origine/posizione abituale (città) usato per i calcoli di viaggio */
  homeCity: string;
  /** interessi scritti a mano (quelli che non corrispondono al catalogo) */
  custom: { id: string; label: string }[];
  /** voci dedotte (ricerche, viaggi, obiettivi...) che l'utente ha tolto: non ricompaiono */
  dismissed: string[];
  addCustom: (label: string) => void;
  renameCustom: (id: string, label: string) => void;
  removeCustom: (id: string) => void;
  dismiss: (key: string) => void;
  undismiss: (key: string) => void;
  toggle: (id: InterestId) => void;
  addRecent: (q: string, kind?: 'viaggio' | 'luogo' | 'altro') => void;
  setHomeCity: (c: string) => void;
  reset: () => void;
};

export const useInterests = create<State>()(
  persisted<State>('interests', (set) => ({
    selected: [],
    recent: [],
    homeCity: '',
    custom: [],
    dismissed: [],
    addCustom: (label) => set((s) => { const l = label.trim().slice(0, 60); return !l || s.custom.some((c) => c.label.toLowerCase() === l.toLowerCase()) ? s : { custom: [...s.custom, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), label: l }] }; }),
    renameCustom: (id, label) => set((s) => ({ custom: s.custom.map((c) => (c.id === id ? { ...c, label: label.trim().slice(0, 60) || c.label } : c)) })),
    removeCustom: (id) => set((s) => ({ custom: s.custom.filter((c) => c.id !== id) })),
    dismiss: (key) => set((s) => (s.dismissed.includes(key) ? s : { dismissed: [...s.dismissed, key] })),
    undismiss: (key) => set((s) => ({ dismissed: s.dismissed.filter((k) => k !== key) })),
    toggle: (id) => set((s) => ({ selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id] })),
    addRecent: (q, kind = 'altro') => set((s) => ({ recent: [{ q: q.trim(), kind, ts: Date.now() }, ...s.recent.filter((r) => r.q.toLowerCase() !== q.trim().toLowerCase())].slice(0, 40) })),
    setHomeCity: (homeCity) => set({ homeCity }),
    reset: () => set({ selected: [], recent: [], homeCity: '', custom: [], dismissed: [] }),
  })),
);

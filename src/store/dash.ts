import { create } from 'zustand';

import { addItem, moveItem, removeItem, resizeItem, type Placed, type Shape } from '@/lib/dash/grid';
import { uid } from '@/lib/format';
import { persisted } from './persist';

export type DashItem = Placed & { cfg?: Record<string, string> };

type State = {
  items: DashItem[];
  /** foto dello sfondo: restano sul telefono; più foto fanno un mosaico lungo la pagina */
  photos: string[];
  /** quanto scurire le foto (0-0.8) per tenere leggibili i widget */
  dim: number;
  add: (type: string, s: Shape, cfg?: Record<string, string>) => string;
  move: (id: string, x: number, y: number) => void;
  resize: (id: string, s: Shape) => void;
  remove: (id: string) => void;
  setCfg: (id: string, patch: Record<string, string>) => void;
  addPhotos: (uris: string[]) => void;
  delPhoto: (i: number) => void;
  setDim: (d: number) => void;
  reset: () => void;
};

/** La Dashboard a widget: dove sta ogni widget, le foto di sfondo. Resta sul telefono. */
export const useDash = create<State>()(
  persisted<State>('dash', (set, get) => ({
    items: [], photos: [], dim: 0.45,
    add: (type, s, cfg) => {
      const id = uid();
      set({ items: addItem(get().items, id, type, s).map((i) => (i.id === id && cfg ? { ...i, cfg } : i)) });
      return id;
    },
    move: (id, x, y) => set({ items: moveItem(get().items, id, x, y) }),
    resize: (id, s) => set({ items: resizeItem(get().items, id, s) }),
    remove: (id) => set({ items: removeItem(get().items, id) }),
    setCfg: (id, patch) => set({ items: get().items.map((i) => (i.id === id ? { ...i, cfg: { ...(i.cfg ?? {}), ...patch } } : i)) }),
    addPhotos: (uris) => set({ photos: [...get().photos, ...uris].slice(0, 12) }),
    delPhoto: (i) => set({ photos: get().photos.filter((_, j) => j !== i) }),
    setDim: (dim) => set({ dim: Math.max(0, Math.min(0.8, dim)) }),
    reset: () => set({ items: [] }),
  })),
);

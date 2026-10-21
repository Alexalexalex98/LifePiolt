import { create } from 'zustand';

import type { Bg } from '@/lib/dash/backgrounds';
import { addItem, moveItem, removeItem, resizeItem, type Placed, type Shape } from '@/lib/dash/grid';
import { uid } from '@/lib/format';
import { persisted } from './persist';

export type DashItem = Placed & { cfg?: Record<string, string> };

type State = {
  items: DashItem[];
  /** lo sfondo: una sola foto (resta sul telefono) oppure un modello di colore */
  bg: Bg;
  /** vecchio elenco di foto (prima era un mosaico): se c'è, vale la prima */
  photos?: string[];
  /** quanto scurire le foto (0-0.8) per tenere leggibili i widget */
  dim: number;
  add: (type: string, s: Shape, cfg?: Record<string, string>) => string;
  move: (id: string, x: number, y: number) => void;
  resize: (id: string, s: Shape) => void;
  remove: (id: string) => void;
  setCfg: (id: string, patch: Record<string, string>) => void;
  setBg: (bg: Bg) => void;
  setDim: (d: number) => void;
  reset: () => void;
};

/** La Dashboard a widget: dove sta ogni widget, le foto di sfondo. Resta sul telefono. */
export const useDash = create<State>()(
  persisted<State>('dash', (set, get) => ({
    items: [], bg: { kind: 'none' }, dim: 0.45,
    add: (type, s, cfg) => {
      const id = uid();
      set({ items: addItem(get().items, id, type, s).map((i) => (i.id === id && cfg ? { ...i, cfg } : i)) });
      return id;
    },
    move: (id, x, y) => set({ items: moveItem(get().items, id, x, y) }),
    resize: (id, s) => set({ items: resizeItem(get().items, id, s) }),
    remove: (id) => set({ items: removeItem(get().items, id) }),
    setCfg: (id, patch) => set({ items: get().items.map((i) => (i.id === id ? { ...i, cfg: { ...(i.cfg ?? {}), ...patch } } : i)) }),
    setBg: (bg) => set({ bg, photos: [] }),
    setDim: (dim) => set({ dim: Math.max(0, Math.min(0.8, dim)) }),
    reset: () => set({ items: [] }),
  })),
);

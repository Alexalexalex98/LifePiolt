import { create } from 'zustand';

import type { Expression } from '@/lib/mascot';
import { uid } from '@/lib/format';
import { persisted } from './persist';

export type MySticker = { id: string; expr: Expression; color: string; label?: string };
type State = { mine: MySticker[]; add: (s: Omit<MySticker, 'id'>) => MySticker; remove: (id: string) => void };

/** Gli adesivi di Theia che hai creato tu (restano sul telefono). */
export const useStickers = create<State>()(persisted<State>('stickers', (set) => ({
  mine: [],
  add: (s) => { const x = { ...s, id: uid() }; set((st) => ({ mine: [x, ...st.mine].slice(0, 60) })); return x; },
  remove: (id) => set((st) => ({ mine: st.mine.filter((x) => x.id !== id) })),
})));

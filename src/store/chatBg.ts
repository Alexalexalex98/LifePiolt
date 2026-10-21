import { create } from 'zustand';

import { persisted } from './persist';

type State = {
  /** sfondo della chat con Theia (stesso formato degli sfondi delle altre chat) */
  ai: string;
  /** quanto scurire le foto di sfondo, per tenere leggibili i messaggi (0-0.8) */
  dim: number;
  setAi: (k: string) => void;
  setDim: (d: number) => void;
};

export const useChatBg = create<State>()(
  persisted<State>('chatbg', (set) => ({
    ai: 'default', dim: 0.4,
    setAi: (ai) => set({ ai }),
    setDim: (d) => set({ dim: Math.max(0, Math.min(0.8, d)) }),
  })),
);

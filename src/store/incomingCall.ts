import { create } from 'zustand';

/** Chiamata in arrivo da mostrare a tutto schermo (non si salva: vale finché squilla). */
export type Incoming = { chatId: string; mid: string; from: string; video: boolean };
type State = { current: Incoming | null; ring: (i: Incoming) => void; clear: () => void };
export const useIncomingCall = create<State>((set) => ({ current: null, ring: (current) => set({ current }), clear: () => set({ current: null }) }));

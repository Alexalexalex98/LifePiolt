import { create } from 'zustand';

/** La modalità voce di Theia: aperta con una pressione lunga sulla sua icona. Non si salva. */
type State = { open: boolean; show: () => void; hide: () => void };
export const useVoiceMode = create<State>()((set) => ({ open: false, show: () => set({ open: true }), hide: () => set({ open: false }) }));

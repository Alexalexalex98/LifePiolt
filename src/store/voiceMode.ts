import { create } from 'zustand';

/** La modalità voce di Theia: aperta con una pressione lunga sulla sua icona. Può essere ridotta a una bolla e continuare mentre usi l'app. Non si salva. */
type State = { open: boolean; minimized: boolean; show: () => void; hide: () => void; minimize: () => void; expand: () => void };
export const useVoiceMode = create<State>()((set) => ({
  open: false, minimized: false,
  show: () => set({ open: true, minimized: false }),
  hide: () => set({ open: false, minimized: false }),
  minimize: () => set({ minimized: true }),
  expand: () => set({ minimized: false }),
}));

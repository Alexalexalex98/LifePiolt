/** Stato del fattore "testo più grande". Nessun import di react-native: sicuro anche sul telefono (Expo Go). */
let factor = 1;
const listeners = new Set<() => void>();
export const subscribeTextScale = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const snapshotTextScale = () => factor;
export function setTextScaleFactor(k: number) {
  if (k === factor) return;
  factor = k;
  listeners.forEach((l) => l());
}
export const getTextScaleFactor = () => factor;

/** Cambio di scheda della Home con un gesto: Per te, Swipe, Seguiti (stesso ordine dell'interruttore). */
export type HomeTab = 'Per te' | 'Swipe' | 'Seguiti';
const ORDER: HomeTab[] = ['Per te', 'Swipe', 'Seguiti'];

/** dir = +1 con il dito verso sinistra (scheda successiva), -1 verso destra (precedente). Ai bordi resta ferma. */
export function nextHomeTab(cur: HomeTab, dir: 1 | -1): HomeTab {
  const i = ORDER.indexOf(cur) + dir;
  return ORDER[Math.max(0, Math.min(ORDER.length - 1, i))];
}

/** Il gesto è orizzontale e abbastanza lungo (o veloce) da contare come cambio scheda. */
export function isTabSwipe(dx: number, dy: number, vx = 0): 1 | -1 | 0 {
  if (Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  if (Math.abs(dx) < 60 && Math.abs(vx) < 0.6) return 0;
  return dx < 0 ? 1 : -1;
}

/** Un carosello di foto: l'ultima foto + un altro gesto verso sinistra (o la prima verso destra) passa alla scheda vicina. */
export function carouselEdge(page: number, count: number, dir: 1 | -1): boolean {
  return count > 1 && (dir === 1 ? page >= count - 1 : page <= 0);
}

type L = (dir: 1 | -1) => void;
const listeners = new Set<L>();
export const onEdgeSwipe = (l: L) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const emitEdgeSwipe = (dir: 1 | -1) => listeners.forEach((l) => l(dir));

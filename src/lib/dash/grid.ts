/** Griglia della Dashboard a widget (modulo PURO): 4 colonne, righe quanto serve, posizioni libere senza sovrapposizioni. */
export const COLS = 4;
export type Shape = { w: number; h: number };
export type Placed = { id: string; type: string; x: number; y: number; w: number; h: number };

/** Le forme possibili, in quadratini: 1, 2, 3, 4 in orizzontale e in verticale, il quadrato da 4, e le grandi da 8 e 12. */
export const SHAPES: Shape[] = [
  { w: 1, h: 1 },
  { w: 2, h: 1 }, { w: 1, h: 2 },
  { w: 3, h: 1 }, { w: 1, h: 3 },
  { w: 4, h: 1 }, { w: 1, h: 4 },
  { w: 2, h: 2 },
  { w: 4, h: 2 }, { w: 2, h: 4 },
  { w: 4, h: 3 }, { w: 3, h: 4 },
];
export const shapeKey = (s: Shape) => `${s.w}x${s.h}`;
export const parseShape = (k: string): Shape => { const [w, h] = k.split('x').map(Number); return { w, h }; };
export const sameShape = (a: Shape, b: Shape) => a.w === b.w && a.h === b.h;
export const area = (s: Shape) => s.w * s.h;

type Rect = { x: number; y: number; w: number; h: number };
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Il rettangolo sta nella griglia e non tocca nessun altro widget (tranne `ignore`)? */
export function fits(items: Placed[], r: Rect, ignore?: string): boolean {
  if (r.x < 0 || r.y < 0 || r.w < 1 || r.h < 1 || r.x + r.w > COLS) return false;
  return !items.some((i) => i.id !== ignore && overlap(i, r));
}

/** Il primo posto libero (dall'alto, da sinistra) per una forma. */
export function findFree(items: Placed[], s: Shape, ignore?: string): { x: number; y: number } {
  const maxY = items.reduce((m, i) => Math.max(m, i.y + i.h), 0);
  for (let y = 0; y <= maxY; y++) for (let x = 0; x + s.w <= COLS; x++) if (fits(items, { x, y, w: s.w, h: s.h }, ignore)) return { x, y };
  return { x: 0, y: maxY };
}

/** Il posto libero più vicino al punto voluto (per quando lasci un widget su uno spazio occupato). null se la forma non ci sta in griglia. */
export function nearestFree(items: Placed[], s: Shape, x: number, y: number, ignore?: string): { x: number; y: number } | null {
  if (s.w > COLS) return null;
  const tx = Math.max(0, Math.min(COLS - s.w, Math.round(x))), ty = Math.max(0, Math.round(y));
  const maxY = Math.max(ty, items.reduce((m, i) => Math.max(m, i.y + i.h), 0)) + 1;
  let best: { x: number; y: number; d: number } | null = null;
  for (let yy = 0; yy <= maxY; yy++) for (let xx = 0; xx + s.w <= COLS; xx++) {
    if (!fits(items, { x: xx, y: yy, w: s.w, h: s.h }, ignore)) continue;
    const d = (xx - tx) ** 2 + (yy - ty) ** 2 * 1.2;
    if (!best || d < best.d) best = { x: xx, y: yy, d };
  }
  return best ? { x: best.x, y: best.y } : null;
}

/** Aggiunge un widget nel primo posto libero. */
export function addItem(items: Placed[], id: string, type: string, s: Shape): Placed[] {
  return [...items, { id, type, ...findFree(items, s), ...s }];
}
export const removeItem = (items: Placed[], id: string): Placed[] => items.filter((i) => i.id !== id);

/** Sposta: se il punto è occupato va nel posto libero più vicino. */
export function moveItem(items: Placed[], id: string, x: number, y: number): Placed[] {
  const it = items.find((i) => i.id === id);
  if (!it) return items;
  const p = nearestFree(items, it, x, y, id);
  return p ? items.map((i) => (i.id === id ? { ...i, ...p } : i)) : items;
}

/** Cambia forma: resta dov'è se c'è spazio, altrimenti va nel posto libero più vicino. */
export function resizeItem(items: Placed[], id: string, s: Shape): Placed[] {
  const it = items.find((i) => i.id === id);
  if (!it) return items;
  const p = nearestFree(items, s, it.x, it.y, id);
  return p ? items.map((i) => (i.id === id ? { ...i, x: p.x, y: p.y, w: s.w, h: s.h } : i)) : items;
}

export const rowCount = (items: Placed[]) => items.reduce((m, i) => Math.max(m, i.y + i.h), 0);

/** Righe da mostrare: quelle occupate più una libera in fondo (e almeno `min`). */
export const visibleRows = (items: Placed[], min = 4) => Math.max(min, rowCount(items) + 1);

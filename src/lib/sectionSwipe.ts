/** Passaggio tra le sezioni della barra di navigazione con un gesto orizzontale. */
export function adjacentSection(items: string[], current: string, dir: 1 | -1): string | null {
  const i = items.indexOf(current);
  if (i < 0) return null;
  const j = i + dir;
  return j >= 0 && j < items.length ? items[j] : null;
}
/** Il gesto è orizzontale e abbastanza lungo (o veloce): +1 = dito verso sinistra (sezione successiva). */
export function sectionDirection(dx: number, dy: number, vx = 0): 1 | -1 | 0 {
  if (Math.abs(dx) < Math.abs(dy) * 1.8) return 0;
  if (Math.abs(dx) < 80 && Math.abs(vx) < 0.7) return 0;
  return dx < 0 ? 1 : -1;
}

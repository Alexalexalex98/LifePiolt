/** Filigrana (modulo PURO, nessun alias '@/'): cosa scrivere e dove metterlo. */
/** Nome e cognome di chi guarda; se mancano, il nome dell'account. */
export function watermarkLabel(first: string | undefined, last: string | undefined, fallback: string | undefined): string {
  const full = `${(first ?? '').trim()} ${(last ?? '').trim()}`.trim();
  return (full || (fallback ?? '').trim()).slice(0, 40);
}
export type Tile = { key: string; x: number; y: number };
/** Posizioni delle scritte: griglia sfalsata che copre tutta l'area (anche ritagliata ne resta almeno una), con uno scostamento diverso per sessione. */
export function watermarkTiles(w: number, h: number, seed = 0, stepX = 150, stepY = 84): Tile[] {
  if (!(w > 0) || !(h > 0)) return [];
  const ox = (seed * 37) % stepX, oy = (seed * 53) % stepY; const out: Tile[] = [];
  for (let r = -1, y = -stepY + oy; y < h + stepY; r++, y += stepY) {
    const shift = (r & 1) * (stepX / 2);
    for (let c = 0, x = -stepX + ox + shift; x < w + stepX; c++, x += stepX) out.push({ key: `${r}:${c}`, x, y });
  }
  return out;
}

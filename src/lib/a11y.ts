/** Contrasto WCAG (puro, nessuna dipendenza): usato dai test del tema e dagli helper di accessibilità. */

/** Accetta #rgb, #rrggbb, #rrggbbaa (l'alpha viene ignorata: va composta prima con `over`). */
export function parseHex(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '');
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 && h.length !== 8) throw new Error(`colore non valido: ${hex}`);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function alphaOf(hex: string): number {
  let h = hex.trim().replace('#', '');
  if (h.length === 4) h = h.split('').map((c) => c + c).join('');
  return h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
}

const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };

export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Rapporto di contrasto WCAG tra due colori opachi (1..21). */
export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Colora `fg` (con alpha) sopra `bg` opaco e restituisce #rrggbb. */
export function over(fg: string, bg: string): string {
  const a = alphaOf(fg), f = parseHex(fg), b = parseHex(bg);
  const m = f.map((v, i) => Math.round(v * a + b[i] * (1 - a)));
  return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export const AA_TEXT = 4.5;
export const AA_LARGE = 3;

/** Coppie (testo, sfondo) che il tema deve garantire a 4.5:1. */
export const themePairs: [fg: string, bg: string][] = [
  ['text', 'bg'], ['text', 'card'], ['text', 'sheet'], ['text', 'input'], ['text', 'chip'], ['text', 'item'],
  ['muted', 'bg'], ['muted', 'card'], ['muted', 'sheet'], ['muted', 'input'], ['muted', 'tile'],
  ['accent', 'bg'], ['accent', 'card'],
  ['onText', 'text'], ['onAccent', 'accent'],
  ['positive', 'bg'], ['positive', 'card'], ['positive', 'positiveBg'],
  ['danger', 'bg'], ['danger', 'card'], ['danger', 'dangerBg'],
  ['warn', 'bg'], ['warn', 'card'],
  ['toastText', 'toastBg'], ['navInactive', 'nav'], ['text', 'nav'],
];

/** Restituisce le coppie di una palette sotto soglia (vuoto = tutto a norma). */
export function failingPairs(p: Record<string, string>, min = AA_TEXT) {
  const out: { fg: string; bg: string; ratio: number }[] = [];
  for (const [fg, bg] of themePairs) {
    const ratio = contrast(over(p[fg], p[bg]), p[bg]);
    if (ratio < min) out.push({ fg, bg, ratio: Math.round(ratio * 100) / 100 });
  }
  return out;
}

/**
 * Colori della "carta tipografica" (post senza foto) e dei segnaposto: PURO, nessun import con alias
 * (usato anche dai test: tests/feedColors.test.mjs). Ogni palette garantisce testo/sfondo >= 4.5:1 su ENTRAMBI i capi
 * del gradiente. Scelta deterministica dal seme (id/autore): lo stesso post ha sempre gli stessi colori.
 */
export type FeedTone = 'dark' | 'light';
export type FeedPalette = { name: string; from: string; to: string; text: string; sub: string };

/** Hash stabile (FNV-1a 32 bit), indipendente da lib/format. */
export function seedHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Tema scuro: gradienti profondi e ricchi, testo bianco. */
export const DARK_PALETTES: FeedPalette[] = [
  { name: 'indaco', from: '#3b3f9e', to: '#1a1d52', text: '#ffffff', sub: '#e1e4ff' },
  { name: 'viola', from: '#5b3a9e', to: '#2a1760', text: '#ffffff', sub: '#e9e0ff' },
  { name: 'prugna', from: '#8a2f5e', to: '#3f1534', text: '#ffffff', sub: '#ffe1ee' },
  { name: 'oceano', from: '#1f6f86', to: '#0e3446', text: '#ffffff', sub: '#d8f2fa' },
  { name: 'cobalto', from: '#2f56b8', to: '#16275e', text: '#ffffff', sub: '#dde6ff' },
  { name: 'rame', from: '#9a4f1e', to: '#4a230c', text: '#ffffff', sub: '#ffe8d6' },
  { name: 'pino', from: '#1f6a57', to: '#0f3a35', text: '#ffffff', sub: '#d9f5ec' },
  { name: 'ardesia', from: '#4a4f7a', to: '#22243f', text: '#ffffff', sub: '#e4e6fa' },
];

/** Tema chiaro: pastelli morbidi, testo quasi nero. */
export const LIGHT_PALETTES: FeedPalette[] = [
  { name: 'indaco', from: '#dfe5ff', to: '#c4cffd', text: '#10151d', sub: '#2b3342' },
  { name: 'viola', from: '#e8defb', to: '#d3c3f5', text: '#10151d', sub: '#2b3342' },
  { name: 'rosa', from: '#ffdfe8', to: '#f8c3d4', text: '#10151d', sub: '#2b3342' },
  { name: 'cielo', from: '#d4ecf7', to: '#b8dcef', text: '#10151d', sub: '#2b3342' },
  { name: 'pesca', from: '#ffe5d0', to: '#fbcba5', text: '#10151d', sub: '#2b3342' },
  { name: 'sabbia', from: '#f5ecc9', to: '#ebdca0', text: '#10151d', sub: '#2b3342' },
  { name: 'menta', from: '#d5efe6', to: '#b6e0d1', text: '#10151d', sub: '#2b3342' },
  { name: 'lilla', from: '#e4e6f3', to: '#cdd1ea', text: '#10151d', sub: '#2b3342' },
];

const mixHex = (a: string, b: string, k: number) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - k) + parseInt(b.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');

/** Palette di un post: stesso seme, stessi colori. Alto contrasto: testo puro bianco/nero e sfondo spinto verso nero/bianco (>= 7:1). */
export function paletteFor(seed: string, tone: FeedTone, highContrast = false): FeedPalette {
  const list = tone === 'light' ? LIGHT_PALETTES : DARK_PALETTES;
  const p = list[seedHash(seed) % list.length];
  if (!highContrast) return p;
  const pure = tone === 'light' ? '#000000' : '#ffffff';
  const toward = tone === 'light' ? '#ffffff' : '#000000';
  return { ...p, from: mixHex(p.from, toward, 0.45), to: mixHex(p.to, toward, 0.45), text: pure, sub: pure };
}

/** Palette "cinematografica" delle carte speciali (idee, seminari): sempre profonda, in entrambi i temi. */
export const heroPaletteFor = (seed: string): FeedPalette => paletteFor(seed, 'dark');

/** Grandezza del testo grande della carta tipografica in base alla lunghezza (px prima dello scaling di sistema). */
export function textCardFontSize(len: number): number {
  if (len <= 40) return 32;
  if (len <= 80) return 27;
  if (len <= 140) return 23;
  if (len <= 220) return 20;
  return 17;
}

/** Forme morbide (cerchi traslucidi) per i segnaposto foto: deterministiche, in coordinate 0..1. */
export function artShapes(seed: string): { cx: number; cy: number; r: number; o: number }[] {
  let h = seedHash(seed + 'art');
  const next = () => { h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0; h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0; return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };
  return [0, 1, 2].map((i) => ({ cx: 0.15 + next() * 0.7, cy: 0.15 + next() * 0.7, r: 0.22 + next() * 0.3 - i * 0.03, o: 0.1 + next() * 0.12 }));
}

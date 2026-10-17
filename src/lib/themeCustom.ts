/**
 * Colori scelti dall'utente (modulo PURO): un colore d'accento e un «tono» dello sfondo.
 * Il testo resta sempre leggibile: l'accento viene schiarito o scurito finché il contrasto è a norma.
 */
import { contrast, parseHex, readable } from './a11y.ts';

export type CustomTheme = { /** #rrggbb */ accent?: string; /** id di un tono di sfondo */ tone?: string; /** colori delle sezioni: i loro (predefinito) o quello principale */ sections?: 'original' | 'accent'; /** dimensione dei testi (1 = normale) */ textScale?: number };
export const ACCENTS: { id: string; label: string; hex: string }[] = [
  { id: 'indaco', label: 'Indaco', hex: '#8fa4ff' }, { id: 'azzurro', label: 'Azzurro', hex: '#4aa8ff' }, { id: 'turchese', label: 'Turchese', hex: '#2fd0c4' },
  { id: 'verde', label: 'Verde', hex: '#4cd18a' }, { id: 'lime', label: 'Lime', hex: '#b4e04a' }, { id: 'oro', label: 'Oro', hex: '#f0c040' },
  { id: 'arancio', label: 'Arancio', hex: '#ff9a4a' }, { id: 'corallo', label: 'Corallo', hex: '#ff6f61' }, { id: 'rosa', label: 'Rosa', hex: '#ff6fa5' },
  { id: 'viola', label: 'Viola', hex: '#b07cff' }, { id: 'grafite', label: 'Grafite', hex: '#a8b2c0' },
];
export const TONES: { id: string; label: string; hue: number | null; sat: number }[] = [
  { id: 'standard', label: 'Standard', hue: null, sat: 0 }, { id: 'notte', label: 'Notte blu', hue: 222, sat: 0.34 }, { id: 'bosco', label: 'Bosco', hue: 150, sat: 0.26 },
  { id: 'prugna', label: 'Prugna', hue: 285, sat: 0.28 }, { id: 'vino', label: 'Vino', hue: 345, sat: 0.28 }, { id: 'sabbia', label: 'Sabbia', hue: 36, sat: 0.24 }, { id: 'grafite', label: 'Grafite', hue: 220, sat: 0.04 },
];

export const isHex = (s: string) => /^#?[0-9a-f]{6}$/i.test(s.trim());
export const normHex = (s: string) => `#${s.trim().replace('#', '').toLowerCase()}`;

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h / 30) % 12; const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(v * 255).toString(16).padStart(2, '0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
}
/** Luminosità (0..1) di ogni superficie, scuro e chiaro. */
const DARK_L: Record<string, number> = { bg: 0.04, card: 0.1, cardAlt: 0.065, border: 0.17, input: 0.055, inputBorder: 0.19, nav: 0.055, navBorder: 0.16, sheet: 0.085, sheetBorder: 0.18, item: 0.15, aiMsg: 0.11, aiMsgBorder: 0.16, chip: 0.14, tile: 0.105 };
const LIGHT_L: Record<string, number> = { bg: 0.95, card: 1, cardAlt: 0.965, border: 0.84, input: 1, inputBorder: 0.79, nav: 1, navBorder: 0.84, sheet: 1, sheetBorder: 0.84, item: 0.9, aiMsg: 0.93, aiMsgBorder: 0.84, chip: 0.9, tile: 0.965 };

type Base = Record<string, string> & { mode: string; bg: string; accent: string };
/** Applica la scelta dell'utente a una tavolozza. L'alto contrasto non cambia sfondo: resta com'è. */
export function customize<P extends Base>(p: P, c: CustomTheme | undefined, highContrast = false): P {
  if (!c || (!c.accent && !c.tone)) return p;
  const out: Record<string, string> = { ...p };
  const tone = TONES.find((t) => t.id === c.tone);
  if (tone && tone.hue !== null && !highContrast) {
    const L = p.mode === 'light' ? LIGHT_L : DARK_L;
    for (const k of Object.keys(L)) out[k] = hslToHex(tone.hue, tone.sat * (p.mode === 'light' ? 0.8 : 1), L[k]);
  }
  if (c.accent && isHex(c.accent)) {
    const bg = out.bg;
    const accent = readable(normHex(c.accent), bg);
    out.accent = accent;
    const onAcc = contrast('#07090d', accent) >= contrast('#ffffff', accent) ? '#07090d' : '#ffffff';
    out.onText = onAcc; out.onAccent = onAcc;
  }
  return out as P;
}
export const brightness = (hex: string) => { const [r, g, b] = parseHex(hex); return (r * 299 + g * 587 + b * 114) / 1000; };

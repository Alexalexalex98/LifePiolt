/**
 * Colori degli impegni nel calendario. Modulo PURO (nessun import '@/'), testato in tests/calendarColors.test.mjs.
 * Ogni impegno ha un colore: scelto dall'utente (campo `color`: id della tavolozza) oppure di default per urgenza/tipo.
 * Ogni colore ha due varianti (scuro/chiaro) con contrasto >= 3:1 sullo sfondo delle card, anche in alto contrasto.
 */
import { over } from './a11y.ts';

export type ColorMode = 'dark' | 'light';
export type PaletteColor = { id: string; name: string; dark: string; light: string };

/** Tavolozza di 8 colori tra cui l'utente può scegliere per ogni impegno. */
export const PALETTE: PaletteColor[] = [
  { id: 'red', name: 'Rosso', dark: '#ff7b7b', light: '#c02f2f' },
  { id: 'orange', name: 'Arancio', dark: '#ffa05c', light: '#b4530a' },
  { id: 'amber', name: 'Ambra', dark: '#f0c24b', light: '#8a6200' },
  { id: 'green', name: 'Verde', dark: '#6fd88f', light: '#1a7a3e' },
  { id: 'teal', name: 'Verde acqua', dark: '#4fd1c5', light: '#0f766e' },
  { id: 'blue', name: 'Blu', dark: '#7ba7ff', light: '#2f55d4' },
  { id: 'violet', name: 'Viola', dark: '#b99aff', light: '#6d3fd1' },
  { id: 'grey', name: 'Grigio', dark: '#a3adbb', light: '#566070' },
];

/** Fascia delle vacanze (non fa parte della tavolozza utente). */
export const VACATION_COLOR = { dark: '#4fb3e8', light: '#0b6a99' };

export type EvLike = { title: string; important?: boolean; ref?: string; color?: string };

export type ColorKind = 'important' | 'normal' | 'work' | 'tax' | 'shared';

/** Tipo di impegno ricavato dai suoi dati (serve alla legenda e al colore di default). */
export function kindOf(ev: EvLike): ColorKind {
  const ref = ev.ref ?? '';
  if (ref.startsWith('tax:')) return 'tax';
  if (/^lavoro su:/i.test(ev.title.trim())) return 'work';
  if (ev.important) return 'important';
  if (ref || /^seminario:/i.test(ev.title.trim())) return 'shared';
  return 'normal';
}

/** Colore di default (id della tavolozza) per tipo: importante = rosso, normale = blu, lavoro = viola, fisco = ambra, inviti/slot = verde acqua. */
export const DEFAULT_COLOR_OF_KIND: Record<ColorKind, string> = { important: 'red', normal: 'blue', work: 'violet', tax: 'amber', shared: 'teal' };

export const KIND_LABEL: Record<ColorKind, string> = {
  important: 'Importante o urgente',
  normal: 'Impegno normale',
  work: 'Sessioni di lavoro e abitudini',
  tax: 'Scadenze fiscali',
  shared: 'Inviti e slot condivisi',
};

export const paletteById = (id: string | undefined) => PALETTE.find((p) => p.id === id);

/* ---------- urgenza: Theia sceglie il colore dagli impegni (regole locali, nessuna AI esterna) ---------- */
export type Urgency = 'urgent' | 'soon' | 'normal' | 'light';
export const URGENCY_COLOR: Record<Urgency, string> = { urgent: 'red', soon: 'orange', normal: 'blue', light: 'green' };
export const URGENCY_LABEL: Record<Urgency, string> = { urgent: 'Urgente', soon: 'Presto', normal: 'Normale', light: 'Leggero' };
export const URGENCY_ORDER: Urgency[] = ['urgent', 'soon', 'normal', 'light'];
export type ColorCtx = { today: string; day: string };

const CRITICAL = /\b(medic|dottor|dentist|ospedal|visita|esame|scadenz|tasse|fisco|dichiarazion|volo|aeroporto|colloquio|consegna|rata|bolletta|affitto|udienza|appello)/i;
const LEISURE = /\b(cena|pranzo|caff[eè]|aperitivo|amici|film|cinema|palestra|corsa|yoga|relax|passeggiata|festa|compleanno|hobby|lettura|sport)/i;
const keyDays = (a: string, b: string) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);

/** Quanto è urgente un impegno: importante o critico e vicino = urgente; importante o in arrivo = presto; svago = leggero. */
export function urgencyOf(ev: EvLike, ctx: ColorCtx): Urgency {
  const d = keyDays(ctx.today, ctx.day);
  if (d < 0) return 'light'; // già passato
  const critical = CRITICAL.test(ev.title);
  if ((ev.important && d <= 1) || (critical && d <= 2)) return 'urgent';
  if (ev.important || (critical && d <= 7) || d <= 1) return 'soon';
  if (LEISURE.test(ev.title)) return 'light';
  return 'normal';
}

/** Id del colore effettivo: quello scelto dall'utente se valido; con `ctx` (giorno e oggi) Theia lo sceglie in base all'urgenza; altrimenti il default del tipo. */
export function colorIdOf(ev: EvLike, ctx?: ColorCtx): string {
  if (ev.color && paletteById(ev.color)) return ev.color;
  const kind = kindOf(ev);
  if (ctx && (kind === 'important' || kind === 'normal')) return URGENCY_COLOR[urgencyOf(ev, ctx)];
  return DEFAULT_COLOR_OF_KIND[kind];
}

/** Colore pieno (#rrggbb) dell'impegno per il tema scuro o chiaro. */
export function colorOf(ev: EvLike, mode: ColorMode = 'dark', ctx?: ColorCtx): string {
  const p = paletteById(colorIdOf(ev, ctx)) ?? PALETTE[5];
  return p[mode];
}

export const vacationColor = (mode: ColorMode = 'dark') => VACATION_COLOR[mode];

/** Sfondo tenue del colore sopra lo sfondo della card (il testo resta nel colore normale del tema: sempre leggibile). */
export function tintOf(hex: string, bg: string, strength = 0.22): string {
  const a = Math.round(Math.max(0, Math.min(1, strength)) * 255).toString(16).padStart(2, '0');
  return over(hex + a, bg);
}

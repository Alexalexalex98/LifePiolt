import { foldSource } from './fold.ts';
import type { LexData } from './types.ts';

const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export { EN_DAYS, EN_MONTHS };

type Compiled = { lex: LexData; cache: Map<string, RegExp>; numRe: string; numVal: Map<string, number> };
const compiled = new Map<string, Compiled>();

/** `*` dopo una lettera = qualunque terminazione (ma non `\\s*`, `\\d*`) */
const WILD = /(?<!\\[a-z])(?<=[\p{L}\p{M}])\*/gu;
const WORD = '[\\p{L}\\p{M}\\p{N}]';

function compiledFor(lex: LexData): Compiled {
  let c = compiled.get(lex.code);
  if (c) return c;
  const numVal = new Map<string, number>();
  for (const [w, v] of Object.entries(lex.nums)) numVal.set(foldSource(w, lex.script), v);
  const words = [...numVal.keys()].sort((a, b) => b.length - a.length).map((w) => escapeRe(w).replace(/ /g, '\\s+'));
  c = { lex, cache: new Map(), numRe: `(?:\\d{1,3}${words.length ? '|' + words.join('|') : ''})`, numVal };
  compiled.set(lex.code, c);
  return c;
}

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function groups(prefix: string, list: string[], lex: LexData): string {
  return '(?:' + list.map((alt, i) => `(?<${prefix}${i}>${foldSource(alt, lex.script).replace(WILD, wild(lex)).replace(/ /g, '\\s+')})`).join('|') + ')';
}
const wild = (lex: LexData) => (lex.script === 'devanagari' ? '[\\p{L}\\p{M}]*' : '\\p{L}*');

/** Compila un sorgente del lessico in RegExp (flag `u`), con confini di parola dove le parole sono separate da spazi. */
export function rx(lex: LexData, src: string, bounded = true): RegExp {
  const c = compiledFor(lex);
  const key = (bounded ? 'b:' : 'n:') + src;
  const hit = c.cache.get(key);
  if (hit) return hit;
  // le macro si espandono DOPO aver piegato il sorgente (altrimenti `{WD}` sarebbe minuscolo)
  const marker = src
    .replace(/\\p\{L\}/g, '\u0004').replace(/\{num\}/g, '\u0001').replace(/\{wd\}/g, '\u0002').replace(/\{mo\}/g, '\u0003');
  let out = foldSource(marker, lex.script)
    .replace(WILD, wild(lex))
    .replace(/ /g, '\\s+');
  out = out
    .replace(/\u0004/g, '\\p{L}').replace(/\u0001/g, c.numRe)
    .replace(/\u0002/g, groups('w', lex.weekdays, lex))
    .replace(/\u0003/g, groups('mo', lex.months, lex));
  if (lex.spaced && bounded) out = `(?<!${WORD})(?:${out})(?!${WORD})`;
  const re = new RegExp(out, 'u');
  c.cache.set(key, re);
  return re;
}

/** Valore di un numero scritto in cifre o a parole. */
export function numOf(lex: LexData, s: string | undefined): number | undefined {
  if (s == null || s === '') return undefined;
  if (/^\d+(?:[.,]\d+)?$/.test(s)) return parseFloat(s.replace(',', '.'));
  return compiledFor(lex).numVal.get(foldSource(s, lex.script));
}

/** Indice del gruppo `${prefix}0..N` che ha trovato qualcosa. */
export function groupIndex(m: RegExpExecArray, prefix: string, n: number): number {
  const g = m.groups ?? {};
  for (let i = 0; i < n; i++) if (g[prefix + i] !== undefined) return i;
  return -1;
}

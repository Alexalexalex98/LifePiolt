/**
 * Traduzione a runtime. Nessun import di react-native: puro e testabile.
 * La chiave è il testo italiano originale; per i testi con parti variabili si usa {0}, {1}, ...
 * Cerca prima una corrispondenza esatta, poi un modello (es. "Hai {0} impegni").
 */
import type { LangCode } from './languages';

export type Catalog = Record<string, string>;

const catalogs: Partial<Record<LangCode, Catalog>> = {};
let active: LangCode = 'it';
const cache = new Map<string, string>();
type Pat = { re: RegExp; to: string; n: number };
const patIndex: Partial<Record<LangCode, Map<string, Pat[]>>> = {};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function registerCatalog(lang: LangCode, cat: Catalog) {
  catalogs[lang] = cat;
  cache.clear();
  const idx = new Map<string, Pat[]>();
  for (const [from, to] of Object.entries(cat)) {
    if (!/\{\d+\}/.test(from)) continue;
    const parts = from.split(/\{\d+\}/);
    const n = (from.match(/\{\d+\}/g) ?? []).length;
    const re = new RegExp('^' + parts.map(esc).join('(.+?)') + '$', 's');
    const key = (parts[0] || parts.find((p) => p.length >= 3) || '').slice(0, 3);
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key)!.push({ re, to, n });
  }
  patIndex[lang] = idx;
}

export function setActive(lang: LangCode) { active = lang; cache.clear(); }
export const getActive = () => active;

const fill = (tpl: string, args: (string | number)[]) => tpl.replace(/\{(\d+)\}/g, (_m, i) => (args[+i] !== undefined ? String(args[+i]) : ''));

/** Traduce un testo già composto (es. "Hai 3 impegni"). Se non lo conosce lo restituisce com'è. */
export function translateText(text: string): string {
  if (active === 'it' || !text) return text;
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  const cat = catalogs[active];
  let out = text;
  if (cat) {
    const exact = cat[text];
    if (exact !== undefined) out = exact;
    else {
      const trimmed = text.trim();
      if (trimmed !== text && cat[trimmed] !== undefined) out = text.replace(trimmed, cat[trimmed]);
      else {
        const idx = patIndex[active];
        if (idx) {
          const cands = [...(idx.get(text.slice(0, 3)) ?? []), ...(idx.get('') ?? [])];
          for (const p of cands) {
            const m = p.re.exec(text);
            if (m) { out = fill(p.to, m.slice(1, p.n + 1).map((x) => translateText(x))); break; }
          }
        }
      }
    }
  }
  if (cache.size > 5000) cache.clear();
  cache.set(text, out);
  return out;
}

/** t('Hai {0} impegni', n): chiave italiana con segnaposto, argomenti già pronti. */
export function t(src: string, ...args: (string | number)[]): string {
  if (active === 'it') return fill(src, args);
  const cat = catalogs[active];
  const to = cat?.[src];
  return fill(to !== undefined ? to : src, args);
}

export const hasTranslation = (lang: LangCode, src: string) => !!catalogs[lang] && catalogs[lang]![src] !== undefined;
export const catalogSize = (lang: LangCode) => Object.keys(catalogs[lang] ?? {}).length;

/** Database alimenti e ricette (modulo PURO): ~2000 prodotti generici/tipici con valori per 100 g (medie indicative). */
import { D1 } from './db/d1.ts';
import { D2 } from './db/d2.ts';
import { D3 } from './db/d3.ts';
import { D4 } from './db/d4.ts';
import { D5 } from './db/d5.ts';
import { D6 } from './db/d6.ts';
import { R1 } from './db/r1.ts';

export type DbFood = { id: string; name: string; kcal: number; p: number; c: number; f: number; fib: number; portion: number; tags?: string; cat: string; recipe?: boolean };
export type Recipe = { id: string; name: string; method: string; items: { foodId: string; grams: number }[] };

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’`]/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const slug = (s: string) => norm(s).replace(/ /g, '-');
const n = (s: string | undefined) => { const v = parseFloat((s ?? '').replace(',', '.')); return Number.isFinite(v) ? v : 0; };
const r1 = (x: number) => Math.round(x * 10) / 10;

function parse(): DbFood[] {
  const out: DbFood[] = []; const seen = new Set<string>();
  for (const src of [D1, D2, D3, D4, D5, D6]) {
    let cat = 'Altro';
    for (const raw of src.split('\n')) {
      const line = raw.trim(); if (!line) continue;
      if (line.startsWith('#')) { cat = line.slice(1).trim(); continue; }
      const a = line.split('|'); if (a.length < 7) continue;
      const name = a[0].trim(); let id = slug(name); if (!id || seen.has(id)) continue; seen.add(id);
      const portion = n(a[6]) || 100; const tags = (a[7] ?? '').trim();
      out.push({ id, name, kcal: n(a[1]), p: n(a[2]), c: n(a[3]), f: n(a[4]), fib: n(a[5]), portion, cat, ...(tags ? { tags } : {}) });
    }
  }
  return out;
}
const BASE = parse();
const BY_NAME = new Map(BASE.map((f) => [norm(f.name), f]));

function parseRecipes(): { recipes: Recipe[]; missing: string[] } {
  const recipes: Recipe[] = []; const missing: string[] = []; const seen = new Set<string>();
  for (const raw of R1.split('\n')) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const a = line.split('|'); if (a.length < 3) continue;
    const name = a[0].trim(); const id = 'ric-' + slug(name); if (seen.has(id)) continue; seen.add(id);
    const items: Recipe['items'] = [];
    for (const part of a[2].split(';')) {
      const [nm, g] = part.split(':'); if (!nm) continue;
      const f = BY_NAME.get(norm(nm)); if (!f) { missing.push(`${name}: ${nm.trim()}`); continue; }
      items.push({ foodId: f.id, grams: n(g) });
    }
    recipes.push({ id, name, method: a[1].trim(), items });
  }
  return { recipes, missing };
}
const PR = parseRecipes();
export const RECIPES: Recipe[] = PR.recipes;
export const RECIPES_MISSING: string[] = PR.missing;

const FBASE = new Map(BASE.map((f) => [f.id, f]));
/** Valori per 100 g di una ricetta (somma ingredienti / peso totale). */
export function recipeAsFood(r: Recipe): DbFood {
  let g = 0, k = 0, p = 0, c = 0, f = 0, fib = 0;
  for (const it of r.items) { const x = FBASE.get(it.foodId); if (!x) continue; const m = it.grams / 100; g += it.grams; k += x.kcal * m; p += x.p * m; c += x.c * m; f += x.f * m; fib += x.fib * m; }
  const d = g || 1;
  return { id: r.id, name: r.name, kcal: Math.round((k / d) * 100), p: r1((p / d) * 100), c: r1((c / d) * 100), f: r1((f / d) * 100), fib: r1((fib / d) * 100), portion: Math.round(g), cat: 'Piatti e ricette', recipe: true, tags: 'ricetta piatto' };
}

/** Prodotti composti generati: panini, insalate, pasta con condimento, frullati, yogurt con topping. */
function composed(): DbFood[] {
  const get = (nm: string) => BY_NAME.get(norm(nm));
  const out: DbFood[] = []; const seen = new Set<string>();
  const add = (cat: string, name: string, parts: [string, number][]) => {
    const id = 'mix-' + slug(name); if (seen.has(id)) return;
    let g = 0, k = 0, p = 0, c = 0, f = 0, fib = 0;
    for (const [nm, gr] of parts) { const x = get(nm); if (!x) return; const m = gr / 100; g += gr; k += x.kcal * m; p += x.p * m; c += x.c * m; f += x.f * m; fib += x.fib * m; }
    seen.add(id); const d = g || 1;
    out.push({ id, name, kcal: Math.round((k / d) * 100), p: r1((p / d) * 100), c: r1((c / d) * 100), f: r1((f / d) * 100), fib: r1((fib / d) * 100), portion: Math.round(g), cat, recipe: true, tags: 'composto' });
  };
  const byCat = (c: string) => BASE.filter((f) => f.cat.toLowerCase().includes(c));
  const breads: [string, number][] = [['Pane bianco', 80], ['Pane integrale', 80], ['Pane in cassetta', 60]];
  for (const [b, bg] of breads) {
    for (const f of [...byCat('salum'), ...byCat('formagg')].slice(0, 90)) add('Panini e tramezzini', `Panino con ${f.name.toLowerCase()} (${b.toLowerCase()})`, [[b, bg], [f.name, 50]]);
  }
  for (const pasta of ['Pasta di semola cotta', 'Pasta integrale cotta']) {
    for (const s of byCat('salse').concat(byCat('condiment')).slice(0, 60)) add('Primi composti', `${pasta.replace(' cotta', '')} con ${s.name.toLowerCase()}`, [[pasta, 200], [s.name, 40]]);
  }
  for (const veg of byCat('verdur').slice(0, 60)) for (const base of ['Tonno al naturale', 'Petto di pollo alla piastra', 'Uova sode', 'Mozzarella di vacca']) add('Insalate composte', `Insalata di ${veg.name.toLowerCase()} con ${base.toLowerCase()}`, [[veg.name, 150], [base, 80], ["Olio extravergine d'oliva", 8]]);
  for (const fr of byCat('frutta').slice(0, 80)) { add('Frullati e yogurt', `Frullato di ${fr.name.toLowerCase()} e latte`, [[fr.name, 150], ['Latte parzialmente scremato', 200]]); add('Frullati e yogurt', `Yogurt greco con ${fr.name.toLowerCase()}`, [['Yogurt greco intero', 150], [fr.name, 100]]); }
  return out;
}
const COMP = composed();

export const DB_FOODS: DbFood[] = [...BASE, ...RECIPES.map(recipeAsFood), ...COMP];

const STOP = new Set(['ho', 'preparato', 'cucinato', 'fatto', 'mangiato', 'con', 'di', 'del', 'della', 'dei', 'delle', 'e', 'a', 'al', 'alla', 'ai', 'il', 'la', 'lo', 'le', 'un', 'una', 'uno', 'in', 'da', 'per', 'molto', 'poco', 'ricetta', 'oggi', 'stasera', 'pranzo', 'cena', 'ieri']);
const stem = (w: string) => (w.length > 5 ? w.slice(0, w.length - 1) : w);
/** Trova la ricetta più vicina a «ho preparato un risotto con funghi e burro»: nome del piatto + ingredienti citati. */
export function matchRecipes(text: string, max = 3): { recipe: Recipe; score: number }[] {
  const words = norm(text).split(' ').filter((w) => w.length >= 3 && !STOP.has(w)).map(stem);
  if (!words.length) return [];
  const res: { recipe: Recipe; score: number }[] = [];
  for (const r of RECIPES) {
    const nameW = norm(r.name).split(' ').map(stem);
    const ingW = r.items.map((i) => norm(FBASE.get(i.foodId)?.name ?? '')).join(' ').split(' ').map(stem);
    let score = 0;
    for (const w of words) { if (nameW.includes(w)) score += 3; else if (ingW.includes(w)) score += 1; }
    if (score >= 3) res.push({ recipe: r, score: score - nameW.filter((w) => !words.includes(w)).length * 0.1 });
  }
  return res.sort((a, b) => b.score - a.score).slice(0, max);
}
export const foodById = (id: string): DbFood | undefined => FBASE.get(id);

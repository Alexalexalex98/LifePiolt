/**
 * Riconosce in una frase scritta a Theia cosa si vuole fare con le ricette (modulo PURO, senza AI e senza rete):
 * cercare, vedere una ricetta, cucinare passo passo, timer, orario del pasto, lista della spesa, preferiti, diete.
 */
import { norm } from '../fitness/foodDb.ts';
import { CATALOG } from './catalog.ts';
import { DIETS, regionsOf, type Diet, type FullRecipe, type RCat } from './book.ts';

export type RIntent =
  | { k: 'search'; q: string; cat?: RCat; diets: Diet[]; maxMin?: number; diff?: 1 | 2 | 3; region?: string; fridge?: boolean; fav?: boolean; n: number }
  | { k: 'more' }
  | { k: 'show'; id: string; servings?: number }
  | { k: 'pick'; ids: string[] }
  | { k: 'cook'; id?: string; servings?: number }
  | { k: 'timer'; sec: number; label: string }
  | { k: 'timers' }
  | { k: 'timerstop' }
  | { k: 'plan'; id?: string; h: number; m: number }
  | { k: 'shop'; id?: string }
  | { k: 'fav'; id?: string; list?: boolean }
  | { k: 'cooked'; id?: string }
  | { k: 'diet'; diets: Diet[]; off: boolean }
  | { k: 'step'; op: 'next' | 'prev' | 'repeat' | 'ingredients' | 'timer' | 'stop' | 'where' }
  | { k: 'open'; page: string; label: string };
export type RCtx = { cooking: boolean; last?: string };

const STOP = new Set(['alla', 'al', 'allo', 'alle', 'ai', 'agli', 'di', 'del', 'della', 'dello', 'dei', 'delle', 'da', 'in', 'con', 'e', 'a', 'il', 'la', 'lo', 'le', 'i', 'un', 'una', 'uno', 'per', 'su', 'sul', 'sulla', 'col', 'nel', 'nella', 'ricetta', 'ricette']);
const stem = (w: string) => (w.length > 5 ? w.slice(0, -1) : w);
const words = (s: string) => norm(s).split(' ').filter((w) => w.length >= 3 && !STOP.has(w));

/** Le ricette nominate nella frase, dalla più precisa: tutte le parole del nome, poi la metà o più, la più corta vince a parità. */
export function findRecipes(text: string, catalog: FullRecipe[] = CATALOG): { r: FullRecipe; score: number }[] {
  const tw = new Set(words(text).map(stem)); if (!tw.size) return [];
  const full = ` ${norm(text)} `;
  const out: { r: FullRecipe; score: number }[] = [];
  for (const r of catalog) {
    const nw = words(r.name).map(stem); if (!nw.length) continue;
    const m = nw.filter((w) => tw.has(w)).length; if (!m) continue;
    const frac = m / nw.length;
    if (frac < 0.5 && !(nw.length > 3 && m >= 2)) continue;
    let score = frac * 10 + m - nw.length * 0.01;
    if (full.includes(` ${norm(r.name)} `)) score += 5;
    out.push({ r, score });
  }
  return out.sort((a, b) => b.score - a.score);
}
/** Una sola ricetta se la frase ne indica chiaramente una, altrimenti l'elenco delle candidate. */
export function resolveRecipe(text: string, catalog: FullRecipe[] = CATALOG): { one?: FullRecipe; many: FullRecipe[] } {
  const f = findRecipes(text, catalog); if (!f.length) return { many: [] };
  const top = f[0]!;
  if (top.score >= 15 || (f.length === 1 && top.score >= 5.5)) return { one: top.r, many: [top.r] };
  const close = f.filter((x) => x.score >= top.score - 0.6);
  if (close.length === 1) return { one: top.r, many: [top.r] };
  return { many: f.slice(0, 5).map((x) => x.r) };
}

const CATS: [RegExp, RCat][] = [[/\b(primo|primi|pasta|risott\w*)\b/, 'Primi'], [/\b(second\w*)\b/, 'Secondi'], [/\b(dolce|dolci|dessert|torta)\b/, 'Dolci'], [/\b(contorn\w*)\b/, 'Contorni'], [/\b(antipast\w*|aperitivo)\b/, 'Antipasti'], [/\b(zupp\w*|minestr\w*|vellutat\w*)\b/, 'Zuppe'], [/\b(colazione|merenda)\b/, 'Colazione'], [/\b(pizz\w*|focacc\w*|pane)\b/, 'Pane e pizza'], [/\b(salsa|salse|sugo|sughi)\b/, 'Salse'], [/\b(light|leggero|leggera|leggere|dietetic\w*)\b/, 'Light'], [/\b(piatto unico|piatti unici)\b/, 'Piatti unici']];
const DIETRX: [RegExp, Diet][] = [[/\bvegan\w*/, 'vegana'], [/\bvegetarian\w*/, 'vegetariana'], [/\b(senza glutine|celiac\w*|gluten free)\b/, 'senza glutine'], [/\b(senza lattosio|intollerant\w* al lattosio)\b/, 'senza lattosio'], [/\bsenza uova\b/, 'senza uova'], [/\bsenza (frutta a guscio|noci)\b/, 'senza frutta a guscio'], [/\bsenza pesce\b/, 'senza pesce']];
const FILLER = new Set(['ricetta', 'ricette', 'dammi', 'dimmi', 'voglio', 'vorrei', 'cerca', 'cercami', 'trova', 'trovami', 'mostrami', 'fammi', 'vedere', 'qualche', 'alcune', 'idee', 'idea', 'una', 'un', 'uno', 'delle', 'dei', 'di', 'con', 'per', 'che', 'cosa', 'posso', 'cucinare', 'preparare', 'veloce', 'veloci', 'facile', 'facili', 'minuti', 'minuto', 'ora', 'stasera', 'oggi', 'domani', 'cena', 'pranzo', 'mangiare', 'italiane', 'italiana', 'tipica', 'tipiche', 'classica', 'classiche', 'senza', 'glutine', 'lattosio', 'vegetariana', 'vegetariane', 'vegana', 'vegane', 'primo', 'primi', 'secondo', 'secondi', 'dolce', 'dolci', 'contorno', 'contorni', 'piatto', 'piatti', 'light', 'leggera', 'leggere', 'ho', 'frigo', 'quello', 'quanto', 'fammene', 'altre', 'che', 'si', 'puo', 'fare', 'adesso', 'subito', 'mi', 'ti', 'sono', 'tra', 'le', 'la', 'il', 'lo', 'i', 'gli', 'degli', 'delle']);

const timeWord = (s: string): { h: number; m: number } | null => {
  const m = s.match(/\b(?:alle|per le|verso le|entro le)\s+(\d{1,2})(?:\s*[:.e]\s*(\d{2}))?\b/) ?? s.match(/\b(\d{1,2})[:.](\d{2})\b/);
  if (!m) return null; const h = +m[1]!, mi = m[2] ? +m[2] : 0; return h <= 23 && mi <= 59 ? { h, m: mi } : null;
};
const duration = (s: string): number | null => {
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(secondi|sec|s|minuti|minuto|min|m|ore|ora|h)\b/); if (!m) return null;
  const v = parseFloat(m[1]!.replace(',', '.')); const u = m[2]!;
  return Math.round(/^(secondi|sec|s)$/.test(u) ? v : /^(ore|ora|h)$/.test(u) ? v * 3600 : v * 60);
};

/** La frase riguarda le ricette? Restituisce l'intento oppure null (non è per questo modulo). */
export function parseRecipeIntent(text: string, ctx: RCtx): RIntent | null {
  const n = norm(text); if (!n) return null;
  /* durante la cucina guidata: comandi brevi */
  if (ctx.cooking) {
    if (/^(avanti|prossimo|prossimo passaggio|next|vai avanti|continua|ok|fatto|ho fatto|pronto|pronta|andiamo avanti|vai|si|sì)$/.test(n)) return { k: 'step', op: 'next' };
    if (/^(indietro|precedente|passaggio precedente|torna indietro|prima)$/.test(n)) return { k: 'step', op: 'prev' };
    if (/^(ripeti|rileggi|di nuovo|ripetilo|ancora)$/.test(n)) return { k: 'step', op: 'repeat' };
    if (/^(ingredienti|ingredienti per favore|cosa mi serve)$/.test(n)) return { k: 'step', op: 'ingredients' };
    if (/^(timer|avvia il timer|avvia timer|parti|fai partire il timer|metti il timer)$/.test(n)) return { k: 'step', op: 'timer' };
    if (/^(stop|esci|basta|fine|termina|ho finito|chiudi|ferma la ricetta|smetti)$/.test(n)) return { k: 'step', op: 'stop' };
    if (/^(a che punto sono|dove sono|quanto manca)$/.test(n)) return { k: 'step', op: 'where' };
  }
  /* timer */
  if (/\b(timer|sveglia|avvisami tra|ricordami tra)\b/.test(n)) {
    if (/\b(ferma|spegni|annulla|cancella|togli|elimina)\b/.test(n)) return { k: 'timerstop' };
    if (/\b(quanto manca|quanti ne ho|che timer|miei timer|timer attivi)\b/.test(n)) return { k: 'timers' };
    const sec = duration(n); if (sec && sec >= 5 && sec <= 12 * 3600) { const l = n.match(/\bper (?:la |il |lo |l )?([a-z ]{3,20}?)(?: tra| di|$)/); return { k: 'timer', sec, label: l ? l[1]!.trim() : '' }; }
    if (/\b(quanto|attivi|miei)\b/.test(n)) return { k: 'timers' };
  }
  /* diete */
  if (/\b(sono|diventat\w*|ora sono|adesso sono|non sono piu|non sono più|segui|imposta)\b/.test(n) && (DIETRX.some(([re]) => re.test(n)))) {
    const off = /\b(non sono piu|non piu|togli|rimuovi|disattiva)\b/.test(n);
    return { k: 'diet', diets: DIETRX.filter(([re]) => re.test(n)).map(([, d]) => d), off };
  }
  if (/\b(togli|rimuovi|azzera|cancella)\b.*\b(filtri? (della )?dieta|diete|intolleranze)\b/.test(n)) return { k: 'diet', diets: [...DIETS], off: true };
  /* orario del pasto */
  if (/\b(voglio|vorrei|devo|dobbiamo|devo)\b.*\b(mangiare|cenare|pranzare|essere a tavola)\b/.test(n) || /\ba che ora (devo|dovrei) (iniziare|cominciare|cucinare|mettermi)\b/.test(n)) {
    const t = timeWord(text.toLowerCase()); if (t) { const rr = resolveRecipe(text); return { k: 'plan', id: rr.one?.id ?? ctx.last, h: t.h, m: t.m }; }
  }
  /* ho cucinato */
  if (/\bho (cucinato|preparato|fatto|mangiato)\b/.test(n) || /\b(segna|registra)\b.*\b(cucinat\w*|preparat\w*)\b/.test(n)) { const rr = resolveRecipe(text); if (rr.one) return { k: 'cooked', id: rr.one.id }; if (/\b(cucinat\w*|preparat\w*)\b/.test(n) && ctx.last && /\b(l ho|la ho|lo ho|ho cucinato|ho finito)\b/.test(n)) return { k: 'cooked', id: ctx.last }; }
  /* preferiti */
  if (/\bpreferit\w*/.test(n)) {
    const rr = resolveRecipe(text);
    if (/\b(le mie|miei|mostra|vedi|quali|elenco|lista|apri)\b/.test(n) && !rr.one) return { k: 'fav', list: true };
    if (rr.one) return { k: 'fav', id: rr.one.id };
    if (ctx.last && /\b(metti|aggiungi|salva|mettila|aggiungila|salvala|tra i|nei)\b/.test(n)) return { k: 'fav', id: ctx.last };
    return { k: 'fav', list: true };
  }
  /* lista della spesa per una ricetta */
  if ((/\b(spesa|lista)\b/.test(n) && /\b(ingredienti|per|della|di)\b/.test(n) && /\b(metti|aggiungi|segna|prepara|fammi|mettimi)\b/.test(n)) || /\bcosa (mi )?manca (per|a)\b/.test(n) || /\bingredienti (che )?mancano\b/.test(n)) {
    const rr = resolveRecipe(text); if (rr.one) return { k: 'shop', id: rr.one.id }; if (ctx.last) return { k: 'shop', id: ctx.last };
  }
  /* cucinare insieme */
  if (/\b(cuciniamo|cucinare|cucina|prepariamo|prepara|facciamo|iniziamo|inizia|comincia|cominciamo|guidami|aiutami a (cucinare|preparare|fare))\b/.test(n) && /\b(ricetta|cuciniamo|cucinare|prepariamo|guidami|passo passo|insieme|iniziamo|cominciamo)\b|\b(la|il|lo|gli|le|i)\b/.test(n)) {
    const rr = resolveRecipe(text); const sv = n.match(/\bper (\d{1,2}) (persone|porzioni|ospiti|amici)\b/);
    if (rr.one) return { k: 'cook', id: rr.one.id, servings: sv ? +sv[1]! : undefined };
    if (rr.many.length > 1) return { k: 'pick', ids: rr.many.map((x) => x.id) };
    if (ctx.last && /\b(inizia|iniziamo|cominciamo|comincia|cuciniamo|guidami|andiamo|passo passo)\b/.test(n)) return { k: 'cook', id: ctx.last, servings: sv ? +sv[1]! : undefined };
  }
  /* vedere una ricetta */
  if (/\b(ricetta (di|della|del|dello|dei|delle|per)|apri la ricetta|mostrami la ricetta|come si (fa|fanno|prepara|preparano|cucina|cucinano)|come (faccio|preparo|cucino)|ingredienti (di|del|della|dello|dei|delle)|dosi (di|del|della)|quanto ci (vuole|vogliono) per)\b/.test(n)) {
    const rr = resolveRecipe(text); const sv = n.match(/\bper (\d{1,2}) (persone|porzioni|ospiti|amici)\b/);
    if (rr.one) return { k: 'show', id: rr.one.id, servings: sv ? +sv[1]! : undefined };
    if (rr.many.length > 1) return { k: 'pick', ids: rr.many.map((x) => x.id) };
  }
  if (/\b(altre ricette|altre|ancora ricette|fammene vedere altre|mostrane altre|piu ricette)\b/.test(n) && ctx.last !== undefined) return { k: 'more' };
  /* cercare */
  const fridge = /\b(con quello che ho|cosa ho in frigo|in frigo|nel frigo|dalla dispensa|con (gli )?ingredienti che ho|che ho in casa)\b/.test(n);
  const asks = /\bricett\w*\b|\bcosa (posso |potrei |devo |dovrei )?(cucinar\w*|prepar\w*|fare da mangiare|mangiare|faccio|preparo)\b|\bidee (per|di|a) (cena|pranzo|colazione|merenda)\b|\b(un|una|dei|delle|qualche) (primo|primi|secondo|secondi|dolce|dolci|contorno|contorni|antipasto|antipasti|zuppa|zuppe|piatto veloce|piatto light)\b|\bche cucino\b|\bcosa cucino\b/.test(n);
  if (asks || fridge) {
    const cat = CATS.find(([re]) => re.test(n))?.[1];
    const diets = DIETRX.filter(([re]) => re.test(n)).map(([, d]) => d);
    const mm = n.match(/\b(?:in|entro|massimo|max)\s+(\d{1,3})\s*(?:minuti|min)\b/);
    const maxMin = mm ? +mm[1]! : /\b(veloc\w*|rapid\w*|al volo|in fretta)\b/.test(n) ? 25 : undefined;
    const diff = /\b(facil\w*|semplic\w*|principiant\w*)\b/.test(n) ? 1 : undefined;
    const region = regionsOf(CATALOG).find((g) => n.includes(norm(g)));
    const fav = /\bpreferit\w*/.test(n);
    const q = n.split(' ').filter((w) => w.length >= 3 && !FILLER.has(w) && !(region && norm(region).split(' ').includes(w)) && !CATS.some(([re]) => re.test(w))).join(' ');
    const nn = n.match(/\b(\d{1,2})\s+ricette\b/);
    return { k: 'search', q, cat, diets, maxMin, diff: diff as 1 | undefined, region, fridge, fav, n: nn ? Math.min(10, +nn[1]!) : 5 };
  }
  /* aprire sezioni collegate */
  if (/\b(apri|vai|mostrami|portami)\b.*\b(le )?ricette\b|\bapri il libro di ricette\b/.test(n)) return { k: 'open', page: 'recipes', label: 'Ricette' };
  if (/\b(apri|vai|mostrami|portami)\b.*\b(il mio )?diario\b|\b(scrivi|scrivere|voglio scrivere)\b.*\b(nel )?diario\b|\bil mio diario\b/.test(n)) return { k: 'open', page: 'diary', label: 'Diario' };
  if (/\b(scansion\w*|leggi)\b.*\b(codice a barre|prodotto|barcode)\b|\bcontrolla (un )?prodotto\b|\bquanto e sano\b.*\bprodotto\b/.test(n)) return { k: 'open', page: 'foodScan', label: 'Scansiona un prodotto' };
  return null;
}

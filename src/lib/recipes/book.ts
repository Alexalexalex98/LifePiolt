/**
 * Libro di ricette (modulo PURO): ricette con passaggi, tempi, timer e forno; scalatura delle porzioni, filtri,
 * avvisi per diete e intolleranze, valori nutrizionali a porzione e piano «a che ora mangi?».
 * Le ricette sono scritte in un formato di testo (vedi `parseBook`), una per riga.
 */
import { FOOD, macrosFor, sumMacros, type Macros } from '../fitness/nutrition.ts';
import { BASE_NAMES, norm } from '../fitness/foodDb.ts';

export type RCat = 'Antipasti' | 'Primi' | 'Secondi' | 'Contorni' | 'Piatti unici' | 'Zuppe' | 'Pane e pizza' | 'Dolci' | 'Colazione' | 'Salse' | 'Light';
export const RCATS: RCat[] = ['Primi', 'Secondi', 'Antipasti', 'Contorni', 'Piatti unici', 'Zuppe', 'Pane e pizza', 'Dolci', 'Colazione', 'Salse', 'Light'];
export const CAT_COLOR: Record<RCat, string> = { Antipasti: '#e0a36b', Primi: '#e07a5f', Secondi: '#a0525a', Contorni: '#6fbf8a', 'Piatti unici': '#c98f4a', Zuppe: '#d0a24a', 'Pane e pizza': '#d9b36b', Dolci: '#d98fb5', Colazione: '#e6c46a', Salse: '#b25a4a', Light: '#5fc4a8' };
export type Oven = { temp: number; mode: 'statico' | 'ventilato' | 'grill' };
export type Step = { text: string; timer?: { sec: number; label: string }; oven?: Oven };
/** `foodId` vuoto = ingrediente «q.b.» senza valori nutrizionali (aromi, acqua…): si legge da `name`. */
export type Item = { foodId: string; grams: number; note?: string; name?: string };
export const itemName = (i: Item): string => FOOD(i.foodId)?.name ?? i.name ?? '';
export type FullRecipe = {
  id: string; name: string; cat: RCat; diff: 1 | 2 | 3; prep: number; cook: number; servings: number; region?: string; tags: string[];
  items: Item[]; steps: Step[]; tools: string[]; tip?: string;
  /** passaggi ricavati dal metodo breve: meno dettagliati di quelli scritti a mano */ basic?: boolean;
};
export const DIFF_LABEL = ['', 'Facile', 'Media', 'Impegnativa'];
export const totalMin = (r: FullRecipe) => r.prep + r.cook;

/* ---------------- lettura del formato di testo ---------------- */
const n = (s: string | undefined) => { const v = parseFloat((s ?? '').replace(',', '.')); return Number.isFinite(v) ? v : 0; };
export const slug = (s: string) => norm(s).replace(/ /g, '-');

/** Cerca l'alimento: nome esatto, altrimenti il più corto che inizia con quelle parole («Basilico» → «Basilico fresco»). */
export function findFood(nm: string): string | undefined {
  const k = norm(nm); const exact = BASE_NAMES.get(k); if (exact) return exact;
  let best: string | undefined; let bl = 1e9;
  for (const [key, id] of BASE_NAMES) if (key.startsWith(k + ' ') && key.length < bl) { best = id; bl = key.length; }
  return best;
}

/**
 * Un passaggio può contenere: «{10}» o «{10:Pasta}» = timer in minuti (con etichetta); «{forno:200}» o «{forno:180:ventilato}» = forno.
 * Il timer prende come etichetta le prime parole del passaggio se non indicata.
 */
export function parseStep(raw: string): Step {
  let text = raw.trim(); let timer: Step['timer']; let oven: Oven | undefined;
  text = text.replace(/\{forno:(\d+)(?::(statico|ventilato|grill))?\}/g, (_, t, m) => { oven = { temp: +t, mode: (m ?? 'statico') as Oven['mode'] }; return ''; });
  text = text.replace(/\{(\d+)(?::([^}]*))?\}/g, (_, m, l) => { timer = { sec: +m * 60, label: (l ?? '').trim() }; return ''; });
  text = text.replace(/\s+([.,;:!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  if (timer && !timer.label) timer.label = text.split(/[ ,.]/).slice(0, 3).join(' ');
  return { text, ...(timer ? { timer } : {}), ...(oven ? { oven } : {}) };
}

const CAT_ALIAS: Record<string, RCat> = { antipasto: 'Antipasti', antipasti: 'Antipasti', primo: 'Primi', primi: 'Primi', secondo: 'Secondi', secondi: 'Secondi', contorno: 'Contorni', contorni: 'Contorni', unico: 'Piatti unici', 'piatti unici': 'Piatti unici', zuppa: 'Zuppe', zuppe: 'Zuppe', pane: 'Pane e pizza', 'pane e pizza': 'Pane e pizza', dolce: 'Dolci', dolci: 'Dolci', colazione: 'Colazione', salsa: 'Salse', salse: 'Salse', light: 'Light' };

/**
 * Una ricetta per riga: Nome|categoria|difficoltà 1-3|minuti preparazione|minuti cottura|porzioni|regione|tag;tag|ingrediente:grammi;…|passo ## passo ## …|attrezzi;…|consiglio
 * Gli ingredienti sono nomi del database alimenti (anche con «=nota» dopo i grammi: «Cipolla:30=tritata»).
 */
export function parseBook(src: string, prefix = 'rc-'): { recipes: FullRecipe[]; missing: string[]; errors: string[] } {
  const recipes: FullRecipe[] = []; const missing: string[] = []; const errors: string[] = []; const seen = new Set<string>();
  for (const raw of src.split('\n')) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const a = line.split('|');
    if (a.length < 10) { errors.push(`campi insufficienti: ${a[0]}`); continue; }
    const name = a[0]!.trim(); const id = prefix + slug(name); if (seen.has(id)) { errors.push(`doppia: ${name}`); continue; } seen.add(id);
    const cat = CAT_ALIAS[norm(a[1]!)]; if (!cat) { errors.push(`categoria sconosciuta «${a[1]}»: ${name}`); continue; }
    const items: Item[] = [];
    for (const part of a[8]!.split(';')) {
      const [nmRaw, gRaw] = part.split(':'); const nm = (nmRaw ?? '').trim(); if (!nm) continue;
      const [g, note] = (gRaw ?? '').split('=');
      const f = findFood(nm);
      if (!f) { if (n(g) === 0) { items.push({ foodId: '', name: nm, grams: 0, ...(note?.trim() ? { note: note.trim() } : {}) }); continue; } missing.push(`${name}: ${nm}`); continue; }
      items.push({ foodId: f, grams: n(g), ...(note?.trim() ? { note: note.trim() } : {}) });
    }
    const steps = a[9]!.split('##').map((s) => s.trim()).filter(Boolean).map(parseStep);
    if (!steps.length || !items.length) { errors.push(`senza passaggi o ingredienti: ${name}`); continue; }
    const diff = Math.max(1, Math.min(3, Math.round(n(a[2])))) as 1 | 2 | 3;
    recipes.push({ id, name, cat, diff, prep: Math.round(n(a[3])), cook: Math.round(n(a[4])), servings: Math.max(1, Math.round(n(a[5])) || 2), region: a[6]!.trim() || undefined, tags: a[7]!.split(';').map((x) => x.trim().toLowerCase()).filter(Boolean),
      items, steps, tools: (a[10] ?? '').split(';').map((x) => x.trim()).filter(Boolean), ...((a[11] ?? '').trim() ? { tip: a[11]!.trim() } : {}) });
  }
  return { recipes, missing, errors };
}

/* ---------------- ricette vecchie (una riga di metodo) → passaggi ---------------- */
const TIMES: [RegExp, number, string][] = [[/\buova sode|uovo sodo/i, 9, 'Uova sode'], [/\bpatate\b.*\b(lessa|bolli|cuoci)/i, 20, 'Patate'], [/\brisotto|riso\b.*\b(cuoci|tosta)/i, 16, 'Riso'], [/\b(lessa|cuoci|bolli)\b.*\bpasta\b|\bpasta\b.*\b(lessa|cuoci)/i, 10, 'Pasta']];
/** Dal metodo breve crea passaggi: prepara, una azione per frase o virgola, forno e timer dove si capisce, impiatta. */
export function stepsFromMethod(method: string, ingredientNames: string[], servings = 1): { steps: Step[]; prep: number; cook: number } {
  const parts = method.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).flatMap((s) => (s.length > 70 ? s.split(/,\s+(?=[a-zà-ù])/i) : [s])).map((s) => s.trim().replace(/[.,]$/, '')).filter(Boolean);
  const steps: Step[] = [{ text: `Prepara gli ingredienti: ${ingredientNames.slice(0, 6).join(', ')}${ingredientNames.length > 6 ? '…' : ''}. Pesa le quantità e lava, sbuccia o taglia quello che serve.` }];
  let cook = 0;
  for (const p of parts) {
    const text = p.charAt(0).toUpperCase() + p.slice(1) + '.';
    const step: Step = { text };
    const fo = /(?:forno|inforna|al forno|in forno)/i.test(p);
    if (fo) { const m = /(\d{3})\s*°/.exec(p); const t = m ? +m[1]! : /grill/i.test(p) ? 220 : 180; step.oven = { temp: t, mode: /grill/i.test(p) ? 'grill' : 'statico' }; step.timer = { sec: (/pizza|focaccia|pane/i.test(method) ? 20 : 25) * 60, label: 'Forno' }; }
    else {
      for (const [re, min, label] of TIMES) if (re.test(p + ' ' + method) && /(cuoci|lessa|bolli|cuoce|cottura)/i.test(p)) { step.timer = { sec: min * 60, label }; break; }
      if (!step.timer && /riso|risotto/i.test(method) && /brodo/i.test(p)) step.timer = { sec: 16 * 60, label: 'Risotto' };
      if (!step.timer) { const v: [RegExp, number, string][] = [[/soffriggi|imbiondisci/i, 4, 'Soffritto'], [/rosola|rosolare/i, 6, 'Rosolatura'], [/salta|saltare/i, 5, 'Padella'], [/scotta/i, 3, 'Scottatura'], [/griglia|piastra/i, 8, 'Griglia'], [/friggi|frittura/i, 6, 'Frittura'], [/brasa|stufa|spezzatino/i, 45, 'Brasatura'], [/cuoci|cottura/i, 10, 'Cottura']]; for (const [re, m, l] of v) if (re.test(p)) { step.timer = { sec: m * 60, label: l }; break; } }
    }
    if (step.timer) cook += step.timer.sec / 60;
    steps.push(step);
  }
  steps.push({ text: `Assaggia, aggiusta di sale e servi subito${servings > 1 ? ` (${servings} porzioni)` : ''}.` });
  return { steps, prep: Math.max(10, Math.min(40, 8 + ingredientNames.length * 2)), cook: Math.round(cook) || 10 };
}

/* ---------------- porzioni ---------------- */
export const scaleGrams = (grams: number, from: number, to: number): number => (from > 0 ? (grams * to) / from : grams);
const PIECE: [RegExp, number, string, string][] = [[/^uov/i, 55, 'uovo', 'uova'], [/^limone/i, 90, 'limone', 'limoni'], [/^aglio/i, 3, 'spicchio', 'spicchi'], [/^cipolla$/i, 110, 'cipolla', 'cipolle']];
/** Come scrivere un ingrediente: «2 uova (110 g)», «1,2 kg», «350 g». */
export function prettyAmount(foodName: string, grams: number): string {
  const g = Math.round(grams);
  for (const [re, w, one, many] of PIECE) if (re.test(foodName) && g >= w * 0.7) { const k = Math.max(1, Math.round(g / w)); return `${k} ${k === 1 ? one : many} (${g} g)`; }
  if (g >= 1000) return `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 1).replace('.', ',')} kg`;
  return `${g < 10 ? Math.round(grams * 10) / 10 : g} g`.replace('.', ',');
}

/* ---------------- valori nutrizionali ---------------- */
/** Valori di UNA porzione (la ricetta è scritta per `servings` porzioni). */
export function nutritionPer(r: FullRecipe): Macros & { grams: number } {
  const list = r.items.map((i) => { const f = FOOD(i.foodId); return f ? { m: macrosFor(f, i.grams), g: i.grams } : null; }).filter((x): x is { m: Macros; g: number } => !!x);
  const sum = sumMacros(list.map((x) => x.m));
  const per = 1 / Math.max(1, r.servings);
  const o: Macros = { kcal: Math.round(sum.kcal * per), p: Math.round(sum.p * per * 10) / 10, c: Math.round(sum.c * per * 10) / 10, f: Math.round(sum.f * per * 10) / 10 };
  if (sum.sat != null) o.sat = Math.round(sum.sat * per * 10) / 10; if (sum.sug != null) o.sug = Math.round(sum.sug * per * 10) / 10; if (sum.fib != null) o.fib = Math.round(sum.fib * per * 10) / 10; if (sum.salt != null) o.salt = Math.round(sum.salt * per * 100) / 100;
  return { ...o, grams: Math.round(list.reduce((a, x) => a + x.g, 0) * per) };
}
/** Equilibrio nutrizionale 0–100 di una porzione (stima da zuccheri, grassi saturi, sale, calorie, fibre, proteine per 100 g del piatto). */
export function balanceScore(r: FullRecipe): number | undefined {
  const m = nutritionPer(r); if (!m.grams) return undefined;
  const per100 = (x?: number) => (x == null ? undefined : (x / m.grams) * 100);
  let v = 72; const sug = per100(m.sug), sat = per100(m.sat), salt = per100(m.salt), fib = per100(m.fib), pro = per100(m.p), kcal = per100(m.kcal);
  const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
  if (sug != null) v -= clamp((sug - 5) * 1.6, 0, 32);
  if (sat != null) v -= clamp((sat - 2) * 3, 0, 26);
  if (salt != null) v -= clamp((salt - 0.5) * 12, 0, 22);
  if (kcal != null) v -= clamp((kcal - 220) / 12, 0, 18);
  if (fib != null) v += clamp(fib * 3, 0, 14);
  if (pro != null) v += clamp(pro * 0.8, 0, 10);
  return Math.round(clamp(v, 8, 98));
}

/* ---------------- diete e intolleranze ---------------- */
export type Diet = 'vegetariana' | 'vegana' | 'senza glutine' | 'senza lattosio' | 'senza uova' | 'senza frutta a guscio' | 'senza pesce';
export const DIETS: Diet[] = ['vegetariana', 'vegana', 'senza glutine', 'senza lattosio', 'senza uova', 'senza frutta a guscio', 'senza pesce'];
const RX = {
  meat: /\b(manzo|maiale|pollo|tacchino|vitello|agnello|coniglio|prosciutto|salame|pancetta|guanciale|speck|mortadella|bresaola|salsiccia|wurstel|carne|cotechino|lardo|nduja|cinghiale|anatra|fegato|trippa|coda|osso|stinco|polpette|ragu|ragù|brodo di carne|brodo di pollo|pollo|bistecca|braciola|hamburger|capocollo|coppa|porchetta|gallina|oca|salumi|lonza|cotoletta|rosbif|lingua|bollito|brasato)\b/i,
  fish: /\b(tonno|salmone|merluzzo|baccal|acciuga|alice|sarda|sardina|gamber|cozze|vongol|calamar|seppia|polpo|pesce|branzino|orata|spigola|sogliola|trota|aragosta|scampi|frutti di mare|bottarga|cernia|rombo|sgombro|totan|mazzancolle|granchio|cefalo|brodo di pesce|surimi|crostacei|moscardini)\b/i,
  dairy: /\b(latte|burro|panna|formaggio|parmigiano|grana|pecorino|mozzarella|ricotta|mascarpone|gorgonzola|yogurt|provola|scamorza|fontina|taleggio|stracchino|asiago|robiola|caciocavallo|caciotta|emmental|besciamella|gelato|crema pasticcera|fior di latte|burrata|stracciatella|caprino|feta|philadelphia|latticini|crescenza|montasio|bitto|toma|squacquerone|casatella|cacio|paneer|kefir)\b/i,
  egg: /\b(uovo|uova|tuorlo|albume|maionese|frittata|pasta all uovo|pasta fresca|tagliatelle|tortellini|ravioli|pan di spagna|crema pasticcera|zabaione|tiramisu)\b/i,
  gluten: /\b(pasta|spaghetti|penne|fusilli|rigatoni|tagliatelle|lasagne|pane|pangrattato|farina|focaccia|pizza|gnocchi|couscous|bulgur|orzo|farro|seitan|biscott|cracker|grissini|fette biscottate|semola|piadina|tortillas?|panino|pizzoccheri|cornetto|brioche|crostini|crostata|tramezzin|pan di spagna|savoiardi|amaretti|ravioli|tortellini|cappelletti|agnolotti|orecchiette|bucatini|linguine|paccheri|maccheroni|strozzapreti|trofie|cous cous|kamut|segale|avena|muesli|cereali|wafer|biscotti|torta|panettone|pandoro|besciamella|panko|birra|malto)\b/i,
  nuts: /\b(noci|nocciol|mandorl|pistacch|anacardi|pinoli|arachidi|noce|castagn|pesto|nutella|marzapane|torrone|amaretti|granella)\b/i,
};
const GF_OK = /(senza glutine|di mais|di riso|di ceci|di grano saraceno|riso|polenta|patate)/i;
/** Dalle voci degli ingredienti ricava le diete compatibili e gli allergeni presenti (stime dal nome: controlla sempre le etichette). */
export function dietsOf(r: FullRecipe): { diets: Diet[]; contains: string[] } {
  const names = r.items.map(itemName);
  const has = (re: RegExp, skipGf = false) => names.some((x) => re.test(x) && !(skipGf && GF_OK.test(x)));
  const meat = has(RX.meat), fish = has(RX.fish), dairy = has(RX.dairy), egg = has(RX.egg), gluten = has(RX.gluten, true), nuts = has(RX.nuts);
  const diets: Diet[] = []; const contains: string[] = [];
  if (!meat && !fish) diets.push('vegetariana'); if (!meat && !fish && !dairy && !egg) diets.push('vegana');
  if (!gluten) diets.push('senza glutine'); else contains.push('glutine');
  if (!dairy) diets.push('senza lattosio'); else contains.push('latte');
  if (!egg) diets.push('senza uova'); else contains.push('uova');
  if (!nuts) diets.push('senza frutta a guscio'); else contains.push('frutta a guscio');
  if (!fish) diets.push('senza pesce'); else contains.push('pesce');
  return { diets, contains };
}

/* ---------------- ricerca e filtri ---------------- */
export type Filters = { q?: string; cat?: RCat | null; maxMin?: number; diff?: 1 | 2 | 3 | null; diets?: Diet[]; region?: string | null; favs?: string[] | null; ids?: Set<string> | null };
export function filterRecipes(all: FullRecipe[], f: Filters): FullRecipe[] {
  const words = norm(f.q ?? '').split(' ').filter((w) => w.length >= 2);
  const out: { r: FullRecipe; s: number }[] = [];
  for (const r of all) {
    if (f.cat && r.cat !== f.cat) continue;
    if (f.maxMin && totalMin(r) > f.maxMin) continue;
    if (f.diff && r.diff !== f.diff) continue;
    if (f.region && r.region !== f.region) continue;
    if (f.favs && !f.favs.includes(r.id)) continue;
    if (f.ids && !f.ids.has(r.id)) continue;
    if (f.diets?.length) { const d = dietsOf(r).diets; if (!f.diets.every((x) => d.includes(x))) continue; }
    let s = 0;
    if (words.length) {
      const nm = norm(r.name); const ing = r.items.map((i) => norm(itemName(i))).join(' '); const meta = norm(`${r.cat} ${r.region ?? ''} ${r.tags.join(' ')}`);
      for (const w of words) { if (nm.includes(w)) s += nm.startsWith(w) ? 5 : 3; else if (ing.includes(w)) s += 1.5; else if (meta.includes(w)) s += 1; else { s = -1; break; } }
      if (s < 0) continue;
    }
    out.push({ r, s });
  }
  return out.sort((a, b) => b.s - a.s || totalMin(a.r) - totalMin(b.r)).map((x) => x.r);
}
export const regionsOf = (all: FullRecipe[]): string[] => [...new Set(all.map((r) => r.region).filter((x): x is string => !!x))].sort();

/* ---------------- tempi e piano ---------------- */
export const stepSeconds = (s: Step): number => (s.timer ? s.timer.sec : Math.max(45, Math.min(300, s.text.length * 2.2)));
export function fmtMin(min: number): string { if (min < 60) return `${min} min`; const h = Math.floor(min / 60), m = min % 60; return m ? `${h} h ${m} min` : `${h} h`; }
export const fmtClock = (sec: number): string => { const s = Math.max(0, Math.round(sec)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return `${h ? h + ':' + String(m).padStart(2, '0') : m}:${String(x).padStart(2, '0')}`; };
/** Tempo totale stimato dal primo passaggio all'ultimo (i timer contano per intero, gli altri passaggi a stima). */
export const estimateTotalSec = (r: FullRecipe): number => r.steps.reduce((a, s) => a + stepSeconds(s), 0);
/** Se vuoi mangiare alle `eatAt`, a che ora inizi e a che ora parte ogni passaggio (con un margine di 5 minuti). */
export function planBackwards(r: FullRecipe, eatAt: number): { start: number; at: number[] } {
  const total = estimateTotalSec(r) * 1000 + 5 * 60000; const start = eatAt - total;
  const at: number[] = []; let t = start;
  for (const s of r.steps) { at.push(t); t += stepSeconds(s) * 1000; }
  return { start, at };
}
/** Il forno va acceso un po' prima: quanti minuti prima del passaggio che lo richiede (preriscaldamento ~10–15 minuti). */
export function ovenLeadMin(o: Oven): number { return o.mode === 'grill' ? 8 : o.temp >= 220 ? 15 : 12; }

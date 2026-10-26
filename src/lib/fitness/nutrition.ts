/** Calorie e pasti (modulo PURO): tabella di alimenti, calcolo per porzione e fabbisogno giornaliero. */
import { DB_FOODS } from './foodDb.ts';
export type Food = { id: string; name: string; kcal: number; p: number; c: number; f: number; /** caffeina (mg per 100 g) e quota di liquido, solo bevande */ caf?: number; hyd?: number; /** porzione tipica in grammi */ portion: number; tags?: string; fib?: number; /** grassi saturi, zuccheri e sale per 100 g (se noti) */ sat?: number; sug?: number; salt?: number; cat?: string; recipe?: boolean };
const F = (id: string, name: string, kcal: number, p: number, c: number, f: number, portion: number, tags = ''): Food => ({ id, name, kcal, p, c, f, portion, ...(tags ? { tags } : {}) });
/** Valori per 100 g (medie indicative). */
const BASE_FOODS: Food[] = [
  F('pasta', 'Pasta cotta', 158, 5.8, 31, 0.9, 200, 'spaghetti penne fusilli'), F('pasta-sugo', 'Pasta al pomodoro', 150, 5, 28, 2.5, 250, 'sugo'), F('carbonara', 'Pasta alla carbonara', 215, 9, 24, 9, 250),
  F('lasagne', 'Lasagne', 160, 8, 15, 7.5, 300), F('risotto', 'Risotto', 140, 3.5, 25, 3, 250), F('riso', 'Riso bollito', 130, 2.7, 28, 0.3, 180), F('gnocchi', 'Gnocchi di patate', 130, 3, 28, 0.5, 200),
  F('pizza', 'Pizza margherita', 245, 10, 33, 8, 350, 'pizzeria'), F('pizza-salame', 'Pizza con salame', 275, 11, 31, 11, 380), F('focaccia', 'Focaccia', 270, 7, 42, 8, 120), F('pane', 'Pane', 265, 8, 54, 1.5, 60), F('panino', 'Panino con prosciutto', 250, 12, 32, 8, 160),
  F('pollo', 'Petto di pollo alla piastra', 165, 31, 0, 3.6, 150), F('tacchino', 'Fettine di tacchino', 150, 29, 0, 3, 150), F('manzo', 'Bistecca di manzo', 190, 28, 0, 8, 200, 'steak angus'), F('maiale', 'Lonza di maiale', 200, 27, 0, 10, 150),
  F('salmone', 'Salmone', 208, 20, 0, 13, 150), F('merluzzo', 'Merluzzo', 82, 18, 0, 0.7, 180), F('tonno', 'Tonno al naturale', 116, 26, 0, 1, 80), F('uova', 'Uova sode', 155, 13, 1.1, 11, 100), F('frittata', 'Frittata', 190, 12, 1, 15, 150),
  F('formaggio', 'Formaggio stagionato', 380, 28, 1, 30, 40), F('mozzarella', 'Mozzarella', 250, 18, 1, 19, 125), F('yogurt', 'Yogurt greco', 100, 9, 4, 5, 150), F('latte', 'Latte intero', 64, 3.3, 4.8, 3.6, 200),
  F('insalata', 'Insalata mista', 20, 1.4, 3, 0.2, 150), F('verdure', 'Verdure grigliate', 45, 2, 6, 1.5, 200), F('patate', 'Patate al forno', 93, 2.5, 21, 0.1, 200), F('patatine', 'Patatine fritte', 312, 3.4, 41, 15, 130),
  F('legumi', 'Lenticchie cotte', 116, 9, 20, 0.4, 200), F('ceci', 'Ceci cotti', 164, 9, 27, 2.6, 200), F('zuppa', 'Minestrone', 40, 1.8, 6, 1, 300), F('hummus', 'Hummus', 166, 8, 14, 10, 60),
  F('mela', 'Mela', 52, 0.3, 14, 0.2, 180), F('banana', 'Banana', 89, 1.1, 23, 0.3, 120), F('arancia', 'Arancia', 47, 0.9, 12, 0.1, 200), F('frutti', 'Frutti di bosco', 43, 0.7, 10, 0.3, 120), F('uva', 'Uva', 69, 0.7, 18, 0.2, 150),
  F('avocado', 'Avocado', 160, 2, 9, 15, 100), F('noci', 'Noci', 654, 15, 14, 65, 30), F('mandorle', 'Mandorle', 579, 21, 22, 50, 30), F('olio', 'Olio d\'oliva', 884, 0, 0, 100, 10),
  F('cornetto', 'Cornetto', 406, 8, 45, 21, 70), F('biscotti', 'Biscotti secchi', 430, 7, 72, 13, 30), F('cioccolato', 'Cioccolato fondente', 546, 5, 61, 31, 25), F('gelato', 'Gelato', 207, 3.5, 24, 11, 100), F('torta', 'Torta', 380, 5, 52, 17, 100), F('tiramisu', 'Tiramisù', 283, 5, 30, 16, 120),
  F('hamburger', 'Hamburger con panino', 260, 14, 24, 12, 220, 'burger cheeseburger'), F('kebab', 'Kebab', 215, 13, 21, 9, 300), F('sushi', 'Sushi (8 pezzi)', 150, 6, 28, 1.5, 220), F('poke', 'Poke bowl', 140, 8, 18, 4, 350), F('ramen', 'Ramen', 120, 6, 15, 4, 450),
  F('cappuccino', 'Cappuccino', 50, 2.5, 5, 2, 150), F('caffe', 'Caffè', 2, 0.1, 0.3, 0, 30), F('succo', 'Succo di frutta', 46, 0.5, 11, 0.1, 200), F('cola', 'Bibita gassata', 42, 0, 10.6, 0, 330), F('birra', 'Birra', 43, 0.5, 3.6, 0, 330), F('vino', 'Vino rosso', 85, 0.1, 2.6, 0, 150),
  F('barretta', 'Barretta proteica', 370, 30, 35, 12, 50), F('shake', 'Frullato di proteine', 90, 15, 5, 1, 300), F('porridge', 'Porridge di avena', 70, 2.5, 12, 1.4, 250), F('cereali', 'Cereali da colazione', 380, 7, 78, 3, 40), F('marmellata', 'Pane e marmellata', 270, 5, 58, 1, 80),
];
/** Base storica + database esteso (oltre 2000 prodotti e piatti). */
export const FOODS: Food[] = [...BASE_FOODS, ...DB_FOODS.filter((d) => !BASE_FOODS.some((b) => b.id === d.id))];
const BY_ID = new Map(FOODS.map((f) => [f.id, f]));
export const FOOD = (id: string): Food | undefined => BY_ID.get(id);
/** Alimenti stimati dall'AI dalla foto: restano ritrovabili per id (modifica del pasto, diario) senza entrare nella ricerca. */
export const registerFood = (f: Food) => { if (!BY_ID.has(f.id)) BY_ID.set(f.id, f); };
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Cerca per nome o parole collegate («spaghetti» → pasta). */
export function searchFoods(q: string, max = 8): Food[] {
  const words = norm(q).split(/\s+/).filter((w) => w.length >= 2);
  if (!words.length) return [];
  const out: { f: Food; hits: number; bonus: number }[] = [];
  for (const f of FOODS) {
    const hay = norm(`${f.name} ${f.tags ?? ''}`); const hs = hay.split(/[\s-]+/);
    /* conta solo le parole intere o all'inizio di una parola («cola» non trova «cioccolato»); la parte dentro una parola vale solo se non c'è altro */
    const hits = words.filter((w) => hs.some((h) => h === w || h.startsWith(w))).length;
    if (hits) out.push({ f, hits, bonus: norm(f.name).startsWith(words[0]!) ? 1 : 0 });
  }
  if (!out.length) for (const f of FOODS) { const hay = norm(`${f.name} ${f.tags ?? ''}`); const hits = words.filter((w) => hay.includes(w)).length; if (hits) out.push({ f, hits, bonus: 0 }); }
  return out.sort((a, b) => b.hits - a.hits || b.bonus - a.bonus || a.f.name.length - b.f.name.length).slice(0, max).map((x) => x.f);
}

export type Macros = { kcal: number; p: number; c: number; f: number; sat?: number; sug?: number; fib?: number; salt?: number; /** caffeina in mg */ caf?: number };
const OPT = ['sat', 'sug', 'fib', 'salt'] as const;
const r1 = (n: number) => Math.round(n * 10) / 10;
const has = (name: string, re: RegExp) => re.test(name.toLowerCase());
/** Stima di zuccheri, grassi saturi, fibre e sale per 100 g quando il database non li ha: regole per tipo di alimento, solo indicative. */
export function estimateExtras(food: Food): { sat: number; sug: number; fib: number; salt: number } {
  const n = `${food.name} ${food.tags ?? ''}`;
  let sugR = 0.06; // quota dei carboidrati che sono zuccheri
  if (has(n, /(torta|gelato|cioccolat|biscott|brioche|cornetto|dolce|marmellat|miele|succo|cola|bibita|aranciata|tiramis|budino|merend|caramell|nutella|zucchero|sciropp|gassat|energy)/)) sugR = 0.65;
  else if (has(n, /(mela|banana|arancia|frutt|uva|pera|pesca|fragol|anguria|melone|kiwi|ananas|mango|clementin)/)) sugR = 0.8;
  else if (has(n, /(latte|yogurt|cappuccino|latt)/)) sugR = 0.95;
  else if (has(n, /(verdur|insalat|pomodor|carot|zucchin|spinac|legum|lenticch|ceci|fagiol)/)) sugR = 0.3;
  else if (has(n, /(birra|vino|spritz|cocktail)/)) sugR = 0.4;
  let satR = 0.33; // quota dei grassi che sono saturi
  if (has(n, /(olio)/)) satR = 0.15;
  else if (has(n, /(noci|mandorl|nocciol|pistacch|semi|avocado|arachid)/)) satR = 0.12;
  else if (has(n, /(salmone|tonno|pesce|merluzzo|orata|branzino|sushi|gamber)/)) satR = 0.22;
  else if (has(n, /(burro|panna|formaggio|mozzarella|pizza|carbonara|lasagne|gelato|cioccolat|cornetto|torta|salame|pancetta|hamburger|burger|kebab|fritt|patatine|bacon|nutella)/)) satR = 0.45;
  else if (has(n, /(pollo|tacchino|manzo|maiale|bistecca|prosciutto)/)) satR = 0.35;
  let salt = 0.3; // g per 100 g
  if (has(n, /(salame|prosciutto|pancetta|formaggio|olive|acciug|bacon|wurstel|salsiccia|speck|bresaola|hamburger|burger|kebab|pizza|panino|toast|patatine|snack|cracker|salatin)/)) salt = 1.6;
  else if (has(n, /(pasta|riso|pane|focaccia|carbonara|lasagne|zuppa|minestrone|risotto|sugo|salsa|ketchup|maionese)/)) salt = 0.7;
  else if (has(n, /(mela|banana|arancia|frutt|uva|caffe|succo|cola|birra|vino|olio|zucchero|latte|yogurt|cioccolat|gelato|torta)/)) salt = 0.05;
  const fibR = has(n, /(legum|lenticch|ceci|fagiol|integral|avena|porridge|cereali|noci|mandorl)/) ? 7 : has(n, /(verdur|insalat|frutt|mela|pera)/) ? 2.5 : 1.2;
  return { sat: r1(food.f * satR), sug: r1(Math.min(food.c, food.c * sugR)), fib: r1(fibR), salt: r1(salt) };
}
export function macrosFor(food: Food, grams: number): Macros {
  const k = Math.max(0, grams) / 100;
  const m: Macros = { kcal: Math.round(food.kcal * k), p: r1(food.p * k), c: r1(food.c * k), f: r1(food.f * k) };
  const est = estimateExtras(food);
  for (const o of OPT) { const v = o === 'fib' ? food.fib : food[o]; m[o] = r1((typeof v === 'number' ? v : est[o]) * k); }
  if (food.caf) m.caf = Math.round(food.caf * k);
  return m;
}
export const sumMacros = (list: Macros[]): Macros => {
  const out: Macros = list.reduce((a, m) => ({ kcal: a.kcal + m.kcal, p: r1(a.p + m.p), c: r1(a.c + m.c), f: r1(a.f + m.f) }), { kcal: 0, p: 0, c: 0, f: 0 });
  for (const o of OPT) if (list.some((m) => typeof m[o] === 'number')) out[o] = r1(list.reduce((a, m) => a + (m[o] ?? 0), 0));
  if (list.some((m) => m.caf)) out.caf = Math.round(list.reduce((a, m) => a + (m.caf ?? 0), 0));
  return out;
};

export type Body = { sex: 'f' | 'm'; age: number; weightKg: number; heightCm: number; activity: 'bassa' | 'media' | 'alta'; goal: 'dimagrire' | 'mantenere' | 'massa' };
/** Fabbisogno giornaliero indicativo (Mifflin-St Jeor) con correzione per l'obiettivo. Non è un consiglio medico. */
export function dailyTarget(b: Body): number {
  const bmr = 10 * b.weightKg + 6.25 * b.heightCm - 5 * b.age + (b.sex === 'm' ? 5 : -161);
  const act = { bassa: 1.35, media: 1.55, alta: 1.75 }[b.activity];
  const adj = { dimagrire: 0.85, mantenere: 1, massa: 1.1 }[b.goal];
  return Math.max(1200, Math.round((bmr * act * adj) / 10) * 10);
}

/** Obiettivi e limiti GENERALI e indicativi (stile indicazioni OMS/EFSA) a partire dal fabbisogno: non sono un consiglio medico. */
export function dailyTargets(b: Body) {
  const kcal = dailyTarget(b);
  const protein = Math.round(b.weightKg * (b.goal === 'massa' ? 1.8 : b.goal === 'dimagrire' ? 1.6 : 1.2));
  const fat = Math.round((kcal * 0.3) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat, fibre: Math.max(25, Math.round((kcal / 1000) * 14)), sugarMax: Math.round((kcal * 0.1) / 4), satMax: Math.round((kcal * 0.1) / 9), saltMax: 5, waterL: Math.round(b.weightKg * 0.033 * 10) / 10 };
}
export const NUTRITION_DISCLAIMER = 'Questi valori sono indicativi: derivano da formule generali e dalle stime dell’AI e non sono un consiglio medico né dietetico. LifePilot non sostituisce un medico o un dietista: per un parere personale rivolgiti a un professionista.';

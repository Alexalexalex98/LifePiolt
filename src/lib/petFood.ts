/**
 * Cosa mangia e beve Theia (modulo PURO). Si sceglie: la frutta le dà energia, i cibi molto zuccherati o fritti la rallegrano
 * sul momento ma le tolgono energia e salute. Mai punizioni: i valori non scendono sotto la soglia di Theia e si recuperano con cibi freschi, acqua e movimento.
 * Gli alimenti che hai davvero (frigo e diario dei pasti) si riconoscono dal nome e valgono come la loro categoria.
 */
export type Fx = { food?: number; water?: number; energy?: number; health?: number; joy?: number; xp?: number };
export type Quality = 'fresco' | 'neutro' | 'goloso';
export type ArtId = 'apple' | 'banana' | 'carrot' | 'salad' | 'egg' | 'yogurt' | 'nuts' | 'fish' | 'bread' | 'pizza' | 'cheese' | 'fries' | 'burger' | 'donut' | 'candy' | 'icecream' | 'water' | 'tea' | 'milk' | 'juice' | 'soda' | 'energy';
export type FoodDef = { id: string; name: string; kind: 'snack' | 'water'; q: Quality; art: ArtId; fx: Fx };

const f = (id: ArtId, name: string, kind: 'snack' | 'water', q: Quality, fx: Fx): FoodDef => ({ id, name, kind, q, art: id, fx });
export const FOODS: FoodDef[] = [
  f('apple', 'Mela', 'snack', 'fresco', { food: 18, energy: 9, health: 5, joy: 2, xp: 5 }),
  f('banana', 'Banana', 'snack', 'fresco', { food: 22, energy: 12, health: 4, joy: 2, xp: 5 }),
  f('carrot', 'Carota', 'snack', 'fresco', { food: 14, energy: 6, health: 6, joy: 1, xp: 5 }),
  f('salad', 'Insalata', 'snack', 'fresco', { food: 12, energy: 5, health: 7, joy: 0, xp: 5 }),
  f('egg', 'Uova', 'snack', 'fresco', { food: 24, energy: 10, health: 5, joy: 1, xp: 5 }),
  f('yogurt', 'Yogurt', 'snack', 'fresco', { food: 18, energy: 6, health: 5, joy: 2, xp: 5 }),
  f('nuts', 'Frutta secca', 'snack', 'fresco', { food: 20, energy: 12, health: 4, joy: 1, xp: 5 }),
  f('fish', 'Pesce', 'snack', 'fresco', { food: 26, energy: 10, health: 6, joy: 1, xp: 5 }),
  f('bread', 'Pane integrale', 'snack', 'fresco', { food: 22, energy: 10, health: 3, joy: 1, xp: 4 }),
  f('pizza', 'Pizza', 'snack', 'neutro', { food: 30, energy: 2, health: -2, joy: 6, xp: 3 }),
  f('cheese', 'Formaggio', 'snack', 'neutro', { food: 22, energy: 3, health: -1, joy: 3, xp: 3 }),
  f('fries', 'Patatine', 'snack', 'goloso', { food: 22, energy: -6, health: -6, joy: 8, xp: 1 }),
  f('burger', 'Hamburger', 'snack', 'goloso', { food: 32, energy: -5, health: -7, joy: 8, xp: 1 }),
  f('donut', 'Ciambella', 'snack', 'goloso', { food: 20, energy: -7, health: -6, joy: 10, xp: 1 }),
  f('candy', 'Caramelle', 'snack', 'goloso', { food: 8, energy: -4, health: -5, joy: 9, xp: 1 }),
  f('icecream', 'Gelato', 'snack', 'goloso', { food: 14, energy: -3, health: -4, joy: 10, xp: 1 }),
  f('water', 'Acqua', 'water', 'fresco', { water: 30, energy: 4, health: 3, joy: 1, xp: 4 }),
  f('tea', 'Tè senza zucchero', 'water', 'fresco', { water: 22, energy: 3, health: 3, joy: 3, xp: 3 }),
  f('milk', 'Latte', 'water', 'fresco', { water: 18, food: 8, energy: 4, health: 3, joy: 1, xp: 3 }),
  f('juice', 'Succo di frutta', 'water', 'neutro', { water: 18, energy: 6, health: 1, joy: 4, xp: 2 }),
  f('soda', 'Bibita zuccherata', 'water', 'goloso', { water: 10, energy: -6, health: -6, joy: 9, xp: 1 }),
  f('energy', 'Energy drink', 'water', 'goloso', { water: 4, energy: -4, health: -8, joy: 4, xp: 1 }),
];
export const foodOf = (id: string): FoodDef | undefined => FOODS.find((x) => x.id === id);
export const foodsOf = (kind: 'snack' | 'water', q: Quality): FoodDef[] => FOODS.filter((x) => x.kind === kind && x.q === q);

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
/** Regole in ordine: la prima che corrisponde decide la categoria. Alcol, caffè e condimenti non si offrono a Theia. */
const RULES: [RegExp, ArtId | null][] = [
  [/\b(birra|vino|spritz|vodka|whisky|gin|liquor\w*|amaro|prosecco|caffe|espresso|cappuccino|ketchup|maionese|salsa|olio|aceto|sale|spezie|pepe)\b/, null],
  [/\b(energy|red bull|monster)\b/, 'energy'],
  [/\b(coca|cola|aranciata|gassosa|fanta|sprite|chinotto|limonata|bibita|bibite)\b/, 'soda'],
  [/\b(succo|succhi|spremuta|centrifug\w*)\b/, 'juice'],
  [/\b(the|te|tisana|camomilla|infuso)\b/, 'tea'],
  [/\b(latte|bevanda d avena|bevanda di soia|bevanda di mandorla|avena)\b/, 'milk'],
  [/\b(acqua)\b/, 'water'],
  [/\b(patatine|chips|patate fritte|pop corn|popcorn)\b/, 'fries'],
  [/\b(hamburger|kebab|nuggets|wurstel|hot dog|cheeseburger|panino con)\b/, 'burger'],
  [/\b(ciambell\w*|brioche|cornett\w*|merendin\w*|biscott\w*|torta|dolce|dolci|cioccolat\w*|nutella|crostata|muffin|croissant|pasticc\w*)\b/, 'donut'],
  [/\b(caramell\w*|gommos\w*|zucchero|lecca)\b/, 'candy'],
  [/\b(gelat\w*)\b/, 'icecream'],
  [/\b(pizza)\b/, 'pizza'],
  [/\b(formagg\w*|mozzarell\w*|parmigian\w*|grana|ricotta|pecorino|burrata)\b/, 'cheese'],
  [/\b(banan\w*)\b/, 'banana'],
  [/\b(carot\w*)\b/, 'carrot'],
  [/\b(insalata|lattuga|rucola|spinaci|zucchin\w*|pomodor\w*|cetriol\w*|verdur\w*|broccol\w*|cavol\w*|peperon\w*|finocch\w*|melanzan\w*|funghi|sedano|asparag\w*)\b/, 'salad'],
  [/\b(uov\w*)\b/, 'egg'],
  [/\b(yogurt|kefir)\b/, 'yogurt'],
  [/\b(noci|mandorl\w*|nocciol\w*|arachid\w*|frutta secca|pistacchi\w*|anacardi)\b/, 'nuts'],
  [/\b(pesce|salmone|tonno|merluzz\w*|orata|branzino|sgombro|acciug\w*)\b/, 'fish'],
  [/\b(pane|integral\w*|fette biscottate|cracker|grissini|piadina)\b/, 'bread'],
  [/\b(mela|mele|pera|pere|arancia|arance|mandarin\w*|kiwi|fragol\w*|uva|pesca|pesche|albicocc\w*|ananas|anguria|melone|frutta|lampon\w*|mirtill\w*|limon\w*|ciliegi\w*|fico|fichi)\b/, 'apple'],
];
export type Owned = { label: string; def: FoodDef };
/** Dai nomi dei tuoi alimenti (frigo, diario) agli alimenti di Theia: nome vero, effetti della categoria. Senza doppioni. */
export function ownedFoods(names: string[], max = 12): Owned[] {
  const seen = new Set<string>();
  const out: Owned[] = [];
  for (const raw of names) {
    const label = raw.trim();
    const key = norm(label);
    if (!key || seen.has(key)) continue;
    const hit = RULES.find(([re]) => re.test(key));
    if (!hit || !hit[1]) continue;
    const def = foodOf(hit[1]);
    if (!def) continue;
    seen.add(key);
    out.push({ label: label.slice(0, 28), def });
    if (out.length >= max) break;
  }
  return out;
}

/** Una frase gentile su com'è andata, senza giudizi né colpe. */
export function reactionOf(d: FoodDef): { text: string; good: boolean } {
  if (d.q === 'fresco') return { text: d.kind === 'water' ? 'Che freschezza!' : 'Che energia!', good: true };
  if (d.q === 'neutro') return { text: 'Buono, ogni tanto va bene', good: true };
  return { text: 'Che bontà… ma un po\' pesante', good: false };
}

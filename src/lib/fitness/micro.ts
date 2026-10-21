/**
 * Vitamine e minerali, STIMATI per categoria di alimento (modulo PURO). Non vengono dalle etichette: ogni alimento è assegnato a una categoria
 * (verdure a foglia, legumi, pesce grasso, latticini...) con valori tipici per 100 g. Servono a un'indicazione generale, non a un dato medico.
 * Riferimenti giornalieri: valori nutrizionali di riferimento (VNR) del Regolamento UE 1169/2011; per gli omega-3 a catena lunga 250 mg (EFSA).
 */
export const MICRO_KEYS = ['vitA', 'vitC', 'vitD', 'vitE', 'vitK', 'b1', 'b2', 'b3', 'b6', 'b12', 'folate', 'calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'omega3'] as const;
export type MicroKey = (typeof MICRO_KEYS)[number];
export type Micro = Record<MicroKey, number>;

export const MICRO_INFO: Record<MicroKey, { label: string; unit: string; ref: number; sources: string }> = {
  vitA: { label: 'Vitamina A', unit: 'µg', ref: 800, sources: 'carote, zucca, spinaci, uova, formaggi' },
  vitC: { label: 'Vitamina C', unit: 'mg', ref: 80, sources: 'agrumi, kiwi, fragole, peperoni, broccoli' },
  vitD: { label: 'Vitamina D', unit: 'µg', ref: 5, sources: 'pesce grasso (salmone, sgombro), uova, e il sole sulla pelle' },
  vitE: { label: 'Vitamina E', unit: 'mg', ref: 12, sources: 'frutta secca, semi, olio d\'oliva, avocado' },
  vitK: { label: 'Vitamina K', unit: 'µg', ref: 75, sources: 'verdure a foglia verde, broccoli, olio d\'oliva' },
  b1: { label: 'Vitamina B1', unit: 'mg', ref: 1.1, sources: 'cereali integrali, legumi, maiale, semi' },
  b2: { label: 'Vitamina B2', unit: 'mg', ref: 1.4, sources: 'latte, yogurt, uova, formaggi, carne' },
  b3: { label: 'Vitamina B3', unit: 'mg', ref: 16, sources: 'pollo, tonno, carne, cereali integrali' },
  b6: { label: 'Vitamina B6', unit: 'mg', ref: 1.4, sources: 'pollo, pesce, patate, banane, legumi' },
  b12: { label: 'Vitamina B12', unit: 'µg', ref: 2.5, sources: 'pesce, carne, uova, latticini (attenzione se segui una dieta vegana)' },
  folate: { label: 'Folati', unit: 'µg', ref: 200, sources: 'legumi, verdure a foglia, agrumi, cereali integrali' },
  calcium: { label: 'Calcio', unit: 'mg', ref: 800, sources: 'latte, yogurt, formaggi, verdure a foglia, mandorle' },
  iron: { label: 'Ferro', unit: 'mg', ref: 14, sources: 'carne, legumi, spinaci, cereali integrali (con vitamina C si assorbe meglio)' },
  magnesium: { label: 'Magnesio', unit: 'mg', ref: 375, sources: 'frutta secca, semi, legumi, cereali integrali, verdure verdi' },
  potassium: { label: 'Potassio', unit: 'mg', ref: 2000, sources: 'frutta, verdura, legumi, patate' },
  zinc: { label: 'Zinco', unit: 'mg', ref: 10, sources: 'carne, formaggi, legumi, frutta secca, semi' },
  omega3: { label: 'Omega-3', unit: 'mg', ref: 250, sources: 'pesce azzurro e salmone, almeno due volte a settimana' },
};

/** Valori per 100 g nell'ordine di MICRO_KEYS. */
const T = (v: number[]): Micro => Object.fromEntries(MICRO_KEYS.map((k, i) => [k, v[i]])) as Micro;
//                      A    C    D    E    K    B1   B2   B3   B6   B12  Fol  Ca   Fe   Mg   K+   Zn   O3
const CAT: Record<string, { re: RegExp; v: Micro }> = {
  junk: { re: /(patatine|fritt|gelato|torta|biscott|cioccolat|cola|bibita|gassata|aranciata|birra|vino|spritz|cocktail|brioche|cornetto|merend|caramell|nutella|zucchero|snack|chips|caramelle|dolce|krapfen|donut|tiramis|budino|hamburger|burger|kebab|hot dog|nuggets|pizza)/, v: T([10, 0, 0.1, 0.8, 3, 0.1, 0.1, 2, 0.08, 0.3, 10, 40, 0.9, 18, 150, 0.6, 0]) },
  leafy: { re: /(spinac|rucola|insalata|lattuga|bietola|cicoria|broccol|cavol|verza|friarell|valeriana|radicchio|asparag)/, v: T([420, 35, 0, 1.5, 300, 0.1, 0.15, 0.6, 0.15, 0, 130, 90, 1.8, 50, 450, 0.6, 0]) },
  orange: { re: /(carot|zucca|patata dolce|peperon|albicocc)/, v: T([700, 25, 0, 1, 12, 0.07, 0.06, 1, 0.15, 0, 20, 30, 0.4, 14, 320, 0.2, 0]) },
  veg: { re: /(verdur|pomodor|zucchin|melanzan|cetriol|cipoll|fung|finocch|minestron|zuppa|carciof|sedan|ravanell|piselli|fagiolin|ortagg|crudit|sugo)/, v: T([60, 15, 0, 0.6, 12, 0.05, 0.05, 0.7, 0.1, 0, 30, 25, 0.6, 14, 250, 0.3, 0]) },
  citrus: { re: /(aranc|limon|mandarin|clementin|pompelm|kiwi|fragol|frutti di bosco|mirtill|lampon|ananas|mango|papaya|spremuta)/, v: T([10, 55, 0, 0.4, 5, 0.06, 0.04, 0.4, 0.07, 0, 30, 30, 0.4, 12, 170, 0.1, 0]) },
  fruit: { re: /(mela|banana|pera|uva|pesca|melone|anguria|ciliegi|susin|fico|frutta|macedonia|avocado)/, v: T([40, 8, 0, 0.3, 3, 0.04, 0.05, 0.4, 0.1, 0, 10, 8, 0.3, 10, 200, 0.1, 0]) },
  legumes: { re: /(lenticch|ceci|fagiol|legum|soia|tofu|hummus|edamame|fave)/, v: T([5, 2, 0, 0.4, 5, 0.2, 0.1, 1, 0.15, 0, 170, 45, 2.6, 45, 400, 1.5, 0]) },
  fattyfish: { re: /(salmon|tonno|sgombr|sardin|acciug|trota|aringa|pesce spada|alici)/, v: T([30, 0, 8, 1.5, 0, 0.2, 0.15, 8, 0.6, 4, 15, 20, 0.8, 30, 370, 0.6, 1800]) },
  fish: { re: /(merluzz|orata|branzin|gamber|calamar|cozz|polpo|vongol|pesce|sushi|sashimi|baccal|seppi|scampi|crostacei|molluschi)/, v: T([15, 0, 1.5, 0.6, 0, 0.06, 0.08, 3, 0.2, 1.8, 10, 40, 0.7, 30, 300, 1.2, 300]) },
  egg: { re: /(uov|frittata|omelette|carbonara)/, v: T([160, 0, 2, 1, 0, 0.07, 0.45, 0.1, 0.17, 1.1, 47, 50, 1.8, 12, 130, 1.3, 100]) },
  cheese: { re: /(formagg|mozzarell|parmigian|grana|pecorin|ricotta|gorgonzol|provol|feta|scamorz|burrata|mascarpon|lasagne)/, v: T([250, 0, 0.5, 0.3, 2, 0.04, 0.35, 0.1, 0.07, 1.2, 25, 650, 0.3, 25, 100, 2.8, 0]) },
  dairy: { re: /(latte|yogurt|cappuccin|kefir|panna)/, v: T([40, 1, 0.1, 0.1, 0.3, 0.04, 0.18, 0.1, 0.04, 0.5, 5, 120, 0.05, 11, 150, 0.5, 0]) },
  nuts: { re: /(noci|mandorl|nocciol|pistacch|arachid|anacard|semi|frutta secca|pinoli|burro di)/, v: T([1, 1, 0, 12, 5, 0.4, 0.3, 3, 0.3, 0, 60, 150, 3, 200, 600, 3, 100]) },
  oil: { re: /(olio|burro|margarina)/, v: T([0, 0, 0, 14, 60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) },
  cured: { re: /(prosciutt|salam|bresaola|speck|pancetta|mortadell|salsicc|wurstel|bacon|coppa)/, v: T([0, 0, 0.4, 0.2, 0, 0.5, 0.2, 5, 0.3, 0.8, 4, 10, 1, 20, 300, 2.2, 0]) },
  poultry: { re: /(poll|tacchin|petto|anatra|coniglio)/, v: T([10, 0, 0.1, 0.3, 1, 0.07, 0.12, 9, 0.5, 0.3, 5, 12, 0.9, 26, 260, 1, 0]) },
  redmeat: { re: /(manzo|bistecc|maiale|vitello|agnello|lonza|fettina|carne|arrosto|stufato|ragu|polpett|fegato|tagliata|filetto)/, v: T([5, 0, 0.2, 0.3, 1, 0.1, 0.2, 4.5, 0.35, 2, 6, 10, 2.4, 22, 330, 4.5, 0]) },
  potato: { re: /(patat)/, v: T([0, 15, 0, 0.1, 2, 0.08, 0.03, 1.4, 0.3, 0, 15, 10, 0.7, 23, 420, 0.3, 0]) },
  wholegrain: { re: /(integral|avena|porridge|farro|orzo|quinoa|segale|cereali|muesli|grano saraceno)/, v: T([0, 0, 0, 0.6, 2, 0.3, 0.1, 4, 0.2, 0, 30, 30, 2.2, 90, 250, 2, 0]) },
  grain: { re: /(pasta|riso|risott|pane|panino|focaccia|gnocch|cous|polenta|piadina|toast|cracker|grissin|fette|spaghett|penne|tortell|ravioli)/, v: T([0, 0, 0, 0.2, 1, 0.15, 0.07, 2, 0.08, 0, 20, 15, 1.3, 25, 120, 0.8, 0]) },
};
const DEFAULT = T([20, 3, 0, 0.4, 4, 0.06, 0.06, 1, 0.1, 0.2, 15, 30, 0.7, 18, 180, 0.5, 0]);
const ORDER = ['junk', 'cured', 'leafy', 'orange', 'legumes', 'fattyfish', 'fish', 'egg', 'cheese', 'dairy', 'nuts', 'oil', 'potato', 'citrus', 'fruit', 'wholegrain', 'veg', 'poultry', 'redmeat', 'grain'];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const zeroMicro = (): Micro => T(MICRO_KEYS.map(() => 0));
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Categoria stimata di un alimento dal nome (e dalle parole collegate). */
export function microCategory(name: string): string {
  const n = norm(name);
  return ORDER.find((c) => CAT[c].re.test(n)) ?? 'default';
}

/** Vitamine e minerali di `grams` grammi di un alimento, stimati per categoria. */
export function microFor(food: { name: string; tags?: string }, grams: number): Micro {
  const base = CAT[microCategory(`${food.name} ${food.tags ?? ''}`)]?.v ?? DEFAULT;
  const k = Math.max(0, grams) / 100;
  return Object.fromEntries(MICRO_KEYS.map((m) => [m, r2(base[m] * k)])) as Micro;
}

export const sumMicro = (list: (Micro | undefined)[]): Micro => {
  const o = zeroMicro();
  for (const m of list) if (m) for (const k of MICRO_KEYS) o[k] = r2(o[k] + (m[k] ?? 0));
  return o;
};
export const scaleMicro = (m: Micro, f: number): Micro => Object.fromEntries(MICRO_KEYS.map((k) => [k, r2((m[k] ?? 0) * f)])) as Micro;

export type MicroLevel = 'ok' | 'basso' | 'molto-basso';
export type MicroRow = { key: MicroKey; label: string; unit: string; value: number; ref: number; pct: number; level: MicroLevel; sources: string };
/** Ogni valore rispetto al riferimento giornaliero: da 70% in su va bene, 40-70% è basso, sotto 40% molto basso. */
export function microRows(m: Micro): MicroRow[] {
  return MICRO_KEYS.map((key) => {
    const i = MICRO_INFO[key];
    const value = m[key] ?? 0;
    const pct = Math.round((value / i.ref) * 100);
    return { key, label: i.label, unit: i.unit, value: Math.round(value * 10) / 10, ref: i.ref, pct, level: pct >= 70 ? 'ok' : pct >= 40 ? 'basso' : 'molto-basso', sources: i.sources };
  });
}

/** Avviso legale: da mostrare sempre accanto a stime nutrizionali e pareri. */
export const NUTRITION_LEGAL = 'Sono stime, non dati medici: le vitamine e i minerali sono calcolati per categoria di alimento, non dalle etichette, e possono essere anche molto lontani dal reale. Non sostituiscono il parere di un medico, un dietista o un nutrizionista e non servono a diagnosticare carenze né a decidere terapie, diete speciali o integratori. Il fabbisogno cambia con età, sesso, peso, attività, gravidanza, allattamento, malattie e farmaci. Se hai sintomi o dubbi, parlane con il tuo medico.';

/**
 * Scheda completa di un prodotto confezionato (modulo PURO): dettagli da Open Food Facts e voto 0–100 «quanto è sano».
 * Il voto è un NOSTRO indice, spiegato punto per punto: Nutri-Score (quanto è equilibrato), grado di lavorazione NOVA,
 * additivi, provenienza/etichette/impatto ambientale. Non misura residui di pesticidi: l'unico segnale su «com'è coltivato» è l'etichetta bio.
 */
export const OFF_FIELDS = 'code,product_name,brands,quantity,serving_size,serving_quantity,image_front_url,image_front_small_url,categories,categories_tags,labels_tags,ingredients_text,ingredients_text_it,ingredients_analysis_tags,ingredients_n,additives_tags,allergens_tags,traces_tags,origins,origins_tags,countries_tags,manufacturing_places,packaging,packaging_tags,ecoscore_grade,ecoscore_score,nutriscore_grade,nutriscore_score,nova_group,nutrient_levels,nutriments,stores,generic_name';

const num = (v: unknown): number | undefined => { const x = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : typeof v === 'number' ? v : NaN; return Number.isFinite(x) ? x : undefined; };
const r1 = (x: number) => Math.round(x * 10) / 10;
const clean = (t: string) => t.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ').replace(/\b\w/, (c) => c.toUpperCase());
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Additivi: nome e rischio orientativo (0 innocuo · 1 da conoscere · 2 meglio limitare · 3 da evitare/discusso). Fonti: EFSA, IARC, regolamenti UE; è una guida, non un parere medico. */
export const ADDITIVES: Record<string, [string, 0 | 1 | 2 | 3]> = {
  e100: ['Curcumina (colorante)', 0], e101: ['Riboflavina (vitamina B2)', 0], e120: ['Cocciniglia (colorante)', 1], e129: ['Rosso allura (colorante)', 2], e102: ['Tartrazina (colorante)', 2], e104: ['Giallo di chinolina', 2], e110: ['Giallo tramonto', 2], e122: ['Azorubina', 2], e124: ['Rosso cocciniglia A', 2], e133: ['Blu brillante', 1], e150a: ['Caramello', 0], e150c: ['Caramello ammoniacale', 1], e150d: ['Caramello solfito-ammoniacale', 2], e160a: ['Carotene', 0], e160c: ['Estratto di paprica', 0], e162: ['Rosso di barbabietola', 0], e163: ['Antociani', 0], e171: ['Biossido di titanio (vietato nell\'UE negli alimenti)', 3],
  e200: ['Acido sorbico', 1], e202: ['Sorbato di potassio', 1], e211: ['Benzoato di sodio', 2], e220: ['Anidride solforosa', 2], e223: ['Metabisolfito di sodio', 2], e249: ['Nitrito di potassio', 3], e250: ['Nitrito di sodio', 3], e251: ['Nitrato di sodio', 3], e252: ['Nitrato di potassio', 3],
  e270: ['Acido lattico', 0], e282: ['Propionato di calcio', 1], e300: ['Acido ascorbico (vitamina C)', 0], e306: ['Tocoferoli (vitamina E)', 0], e320: ['BHA', 3], e321: ['BHT', 2],
  e322: ['Lecitine', 0], e330: ['Acido citrico', 0], e331: ['Citrato di sodio', 0], e334: ['Acido tartarico', 0], e339: ['Fosfati di sodio', 2], e340: ['Fosfati di potassio', 2], e341: ['Fosfato di calcio', 1], e338: ['Acido fosforico', 2], e375: ['Niacina', 0],
  e401: ['Alginato di sodio', 0], e406: ['Agar', 0], e407: ['Carragenina', 2], e410: ['Farina di semi di carrube', 0], e412: ['Gomma di guar', 0], e415: ['Gomma xantana', 0], e417: ['Gomma tara', 0], e418: ['Gomma gellano', 0], e420: ['Sorbitolo', 1], e421: ['Mannitolo', 1], e440: ['Pectina', 0], e450: ['Difosfati', 2], e451: ['Trifosfati', 2], e452: ['Polifosfati', 2], e460: ['Cellulosa', 0], e466: ['Carbossimetilcellulosa', 1], e471: ['Mono e digliceridi degli acidi grassi', 1], e472e: ['Esteri di mono e digliceridi', 1], e476: ['Poliglicerolo poliricinoleato (PGPR)', 1], e481: ['Stearoil lattilato di sodio', 1], e491: ['Sorbitan monostearato', 1],
  e500: ['Bicarbonato di sodio', 0], e501: ['Carbonato di potassio', 0], e503: ['Carbonato di ammonio', 0], e504: ['Carbonato di magnesio', 0], e509: ['Cloruro di calcio', 0], e516: ['Solfato di calcio', 0],
  e551: ['Biossido di silicio', 1], e553b: ['Talco', 2], e570: ['Acido stearico', 0], e575: ['Glucono delta-lattone', 0],
  e621: ['Glutammato monosodico', 2], e627: ['Guanilato disodico', 2], e631: ['Inosinato disodico', 2], e635: ['Ribonucleotidi disodici', 2],
  e900: ['Dimetilpolisilossano', 1], e903: ['Cera carnauba', 0], e901: ['Cera d\'api', 0], e950: ['Acesulfame K', 2], e951: ['Aspartame', 2], e952: ['Ciclamato', 3], e954: ['Saccarina', 2], e955: ['Sucralosio', 2], e960: ['Glicosidi steviolici (stevia)', 0], e965: ['Maltitolo', 1], e967: ['Xilitolo', 1], e968: ['Eritritolo', 1], e1442: ['Amido modificato', 1], e1422: ['Amido modificato', 1], e1520: ['Glicole propilenico', 2],
};
export type Additive = { code: string; name: string; risk: 0 | 1 | 2 | 3 };
export const RISK_LABEL = ['Nessun problema noto', 'Da conoscere', 'Meglio limitarlo', 'Da evitare o discusso'];

const LABEL_NAMES: Record<string, string> = { 'en:organic': 'Biologico', 'en:eu-organic': 'Biologico UE', 'fr:ab-agriculture-biologique': 'Biologico', 'en:no-palm-oil': 'Senza olio di palma', 'en:palm-oil-free': 'Senza olio di palma', 'en:vegan': 'Vegano', 'en:vegetarian': 'Vegetariano', 'en:gluten-free': 'Senza glutine', 'en:no-gluten': 'Senza glutine', 'en:fair-trade': 'Commercio equo', 'en:fairtrade-international': 'Fairtrade', 'en:pdo': 'DOP', 'en:pgi': 'IGP', 'en:dop': 'DOP', 'en:igp': 'IGP', 'en:stg': 'STG', 'en:no-added-sugar': 'Senza zuccheri aggiunti', 'en:no-added-sugars': 'Senza zuccheri aggiunti', 'en:lactose-free': 'Senza lattosio', 'en:no-lactose': 'Senza lattosio', 'en:non-gmo': 'Senza OGM', 'en:no-gmos': 'Senza OGM', 'en:no-preservatives': 'Senza conservanti', 'en:no-colorings': 'Senza coloranti', 'en:whole-grain': 'Integrale', 'en:made-in-italy': 'Prodotto in Italia', 'en:halal': 'Halal', 'en:kosher': 'Kosher', 'en:rainforest-alliance': 'Rainforest Alliance', 'en:msc': 'Pesca sostenibile MSC', 'en:ascs': 'Acquacoltura ASC', 'en:cruelty-free': 'Non testato su animali', 'en:green-dot': 'Punto verde', 'en:utz-certified': 'UTZ' };
const ALLERGEN_IT: Record<string, string> = { gluten: 'Glutine', milk: 'Latte', eggs: 'Uova', nuts: 'Frutta a guscio', peanuts: 'Arachidi', soybeans: 'Soia', soy: 'Soia', fish: 'Pesce', crustaceans: 'Crostacei', molluscs: 'Molluschi', celery: 'Sedano', mustard: 'Senape', 'sesame-seeds': 'Sesamo', 'sulphur-dioxide-and-sulphites': 'Solfiti', lupin: 'Lupini' };
const CAT_IT: Record<string, string> = { 'en:snacks': 'Snack', 'en:sweet-snacks': 'Snack dolci', 'en:spreads': 'Creme spalmabili', 'en:breakfasts': 'Colazione', 'en:beverages': 'Bevande', 'en:dairies': 'Latticini', 'en:meats': 'Carne', 'en:fishes': 'Pesce', 'en:cereals-and-potatoes': 'Cereali e patate', 'en:plant-based-foods': 'Alimenti vegetali', 'en:fruits': 'Frutta', 'en:vegetables': 'Verdura', 'en:pastas': 'Pasta', 'en:breads': 'Pane', 'en:biscuits': 'Biscotti', 'en:chocolates': 'Cioccolato', 'en:cheeses': 'Formaggi', 'en:yogurts': 'Yogurt', 'en:sauces': 'Salse', 'en:frozen-foods': 'Surgelati', 'en:canned-foods': 'Conserve', 'en:sodas': 'Bibite gassate', 'en:waters': 'Acque', 'en:juices': 'Succhi', 'en:oils': 'Oli' };

export type Level = 'low' | 'moderate' | 'high';
export type ProductDetails = {
  code: string; name: string; brand?: string; quantity?: string; image?: string; categories: string[];
  ingredients?: string; ingredientsCount?: number; palmOil?: boolean; vegan?: boolean; vegetarian?: boolean;
  additives: Additive[]; allergens: string[]; traces: string[]; labels: string[]; organic: boolean;
  origins?: string; places?: string; countries: string[]; packaging?: string; stores?: string;
  nutriscore?: { grade: string; score?: number }; nova?: number; eco?: { grade?: string; score?: number };
  levels: Partial<Record<'fat' | 'saturated-fat' | 'sugars' | 'salt', Level>>;
  per100: { kcal?: number; fat?: number; sat?: number; carbs?: number; sugars?: number; fiber?: number; protein?: number; salt?: number; sodium?: number; mono?: number; poly?: number; chol?: number };
  micros: { name: string; value: number; unit: string }[];
};

const MICRO: [string, string, string, number][] = [['calcium', 'Calcio', 'mg', 1000], ['iron', 'Ferro', 'mg', 1000], ['potassium', 'Potassio', 'mg', 1000], ['magnesium', 'Magnesio', 'mg', 1000], ['zinc', 'Zinco', 'mg', 1000], ['phosphorus', 'Fosforo', 'mg', 1000], ['vitamin-c', 'Vitamina C', 'mg', 1000], ['vitamin-a', 'Vitamina A', 'µg', 1e6], ['vitamin-d', 'Vitamina D', 'µg', 1e6], ['vitamin-e', 'Vitamina E', 'mg', 1000], ['vitamin-b12', 'Vitamina B12', 'µg', 1e6], ['vitamin-b9', 'Folati (B9)', 'µg', 1e6]];

export function parseDetails(code: string, json: unknown): ProductDetails | null {
  const j = json as { status?: number; product?: Record<string, unknown> } | null;
  const p = j?.product;
  if (!p || j?.status === 0) return null;
  const m = (p.nutriments ?? {}) as Record<string, unknown>;
  const name = (typeof p.product_name === 'string' && p.product_name.trim()) || (typeof p.generic_name === 'string' && p.generic_name.trim()) || '';
  if (!name) return null;
  const tag = (s: string) => s.replace(/^[a-z]{2}:/, '');
  const adds: Additive[] = strs(p.additives_tags).map((t) => { const c0 = tag(t).toLowerCase(); const base = c0.replace(/(vii|vi|iv|iii|ii|i|v)$/, ''); const hit = ADDITIVES[c0] ?? (base !== c0 ? ADDITIVES[base] : undefined); const c = hit && !ADDITIVES[c0] ? base : c0; return { code: c.toUpperCase(), name: hit?.[0] ?? `E${c.slice(1).toUpperCase()}`, risk: hit?.[1] ?? 1 }; });
  const analysis = strs(p.ingredients_analysis_tags);
  const labels = [...new Set(strs(p.labels_tags).map((t) => LABEL_NAMES[t] ?? '').filter(Boolean))];
  const kcal100 = num(m['energy-kcal_100g']) ?? (num(m['energy_100g']) != null ? num(m['energy_100g'])! / 4.184 : undefined);
  const lv = (p.nutrient_levels ?? {}) as Record<string, string>;
  const levels: ProductDetails['levels'] = {};
  (['fat', 'saturated-fat', 'sugars', 'salt'] as const).forEach((k) => { if (lv[k] === 'low' || lv[k] === 'moderate' || lv[k] === 'high') levels[k] = lv[k] as Level; });
  const micros: ProductDetails['micros'] = [];
  for (const [k, label, unit, mult] of MICRO) { const v = num(m[`${k}_100g`]); if (v != null && v > 0) micros.push({ name: label, value: r1(v * mult), unit }); }
  const ns = typeof p.nutriscore_grade === 'string' && /^[a-e]$/i.test(p.nutriscore_grade) ? p.nutriscore_grade.toUpperCase() : undefined;
  const eg = typeof p.ecoscore_grade === 'string' && /^[a-e]\+?$/i.test(p.ecoscore_grade) ? p.ecoscore_grade.toUpperCase() : undefined;
  const nova = num(p.nova_group);
  const text = ((typeof p.ingredients_text_it === 'string' && p.ingredients_text_it) || (typeof p.ingredients_text === 'string' && p.ingredients_text) || '').trim();
  const ps = (k: string) => (typeof p[k] === 'string' && (p[k] as string).trim()) || undefined;
  const per = (k: string) => { const v = num(m[`${k}_100g`]); return v != null ? r1(v) : undefined; };
  return {
    code, name, brand: ps('brands')?.split(',')[0]?.trim(), quantity: ps('quantity'), image: ps('image_front_url') ?? ps('image_front_small_url'),
    categories: strs(p.categories_tags).map((t) => CAT_IT[t]).filter((x): x is string => !!x).slice(0, 4),
    ingredients: text || undefined, ingredientsCount: num(p.ingredients_n), palmOil: analysis.includes('en:palm-oil') ? true : analysis.includes('en:palm-oil-free') ? false : undefined,
    vegan: analysis.includes('en:vegan') ? true : analysis.includes('en:non-vegan') ? false : undefined, vegetarian: analysis.includes('en:vegetarian') ? true : analysis.includes('en:non-vegetarian') ? false : undefined,
    additives: adds, allergens: strs(p.allergens_tags).map((t) => ALLERGEN_IT[tag(t)] ?? clean(t)), traces: strs(p.traces_tags).map((t) => ALLERGEN_IT[tag(t)] ?? clean(t)),
    labels, organic: labels.some((l) => l.startsWith('Biologico')), origins: ps('origins'), places: ps('manufacturing_places'), countries: strs(p.countries_tags).map((t) => clean(t)).slice(0, 5), packaging: /unknown|^$/i.test(ps('packaging') ?? '') ? undefined : ps('packaging'), stores: ps('stores'),
    ...(ns ? { nutriscore: { grade: ns, score: num(p.nutriscore_score) } } : {}), ...(nova && nova >= 1 && nova <= 4 ? { nova } : {}), ...(eg || num(p.ecoscore_score) != null ? { eco: { grade: eg, score: num(p.ecoscore_score) } } : {}),
    levels, micros,
    per100: { kcal: kcal100 != null ? Math.round(kcal100) : undefined, fat: per('fat'), sat: per('saturated-fat'), carbs: per('carbohydrates'), sugars: per('sugars'), fiber: per('fiber'), protein: per('proteins'), salt: per('salt'), sodium: per('sodium'), mono: per('monounsaturated-fat'), poly: per('polyunsaturated-fat'), chol: per('cholesterol') },
  };
}

/* ---------------- il voto 0–100 ---------------- */
export type Part = { id: 'nutrition' | 'processing' | 'additives' | 'production'; label: string; value: number; weight: number; note: string };
export type Score = { score: number; label: string; color: string; parts: Part[]; good: string[]; bad: string[]; capped?: string; confidence: number };

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
const lerp = (x: number, a: number, b: number, ya: number, yb: number) => ya + ((x - a) / (b - a)) * (yb - ya);
export function nutriPoints(score: number): number {
  if (score <= -1) return lerp(Math.max(score, -15), -15, -1, 100, 85);
  if (score <= 2) return lerp(score, 0, 2, 85, 70);
  if (score <= 10) return lerp(score, 3, 10, 68, 50);
  if (score <= 18) return lerp(score, 11, 18, 48, 28);
  return lerp(Math.min(score, 40), 19, 40, 26, 4);
}
const GRADE_PTS: Record<string, number> = { A: 92, B: 76, C: 56, D: 34, E: 14 };
/** Se Open Food Facts non dà il Nutri-Score, lo stimiamo da zuccheri, grassi saturi, sale, fibre e proteine per 100 g. */
export function estimateNutrition(p: ProductDetails['per100']): number | undefined {
  if (p.kcal == null && p.sugars == null && p.sat == null && p.salt == null) return undefined;
  let v = 70;
  if (p.sugars != null) v -= clamp((p.sugars - 5) * 1.6, 0, 40);
  if (p.sat != null) v -= clamp((p.sat - 1.5) * 3.2, 0, 32);
  if (p.salt != null) v -= clamp((p.salt - 0.3) * 14, 0, 30);
  if (p.kcal != null) v -= clamp((p.kcal - 250) / 12, 0, 20);
  if (p.fiber != null) v += clamp(p.fiber * 3, 0, 15);
  if (p.protein != null) v += clamp(p.protein * 0.9, 0, 12);
  return clamp(v, 6, 100);
}

export function healthScore(d: ProductDetails): Score {
  const parts: Part[] = []; const good: string[] = []; const bad: string[] = [];
  /* 1. equilibrio nutrizionale */
  let nut: number | undefined; let nutNote = '';
  if (d.nutriscore?.score != null) { nut = nutriPoints(d.nutriscore.score); nutNote = `Nutri-Score ${d.nutriscore.grade}`; }
  else if (d.nutriscore) { nut = GRADE_PTS[d.nutriscore.grade]; nutNote = `Nutri-Score ${d.nutriscore.grade}`; }
  else { nut = estimateNutrition(d.per100); nutNote = 'stimato dai valori'; }
  if (nut != null) parts.push({ id: 'nutrition', label: 'Equilibrio nutrizionale', value: Math.round(nut), weight: 0.55, note: nutNote });
  /* 2. lavorazione */
  if (d.nova) { const v = [0, 100, 82, 50, 14][d.nova]!; parts.push({ id: 'processing', label: 'Lavorazione', value: v, weight: 0.2, note: `NOVA ${d.nova} su 4` }); }
  /* 3. additivi */
  if (d.ingredients || d.additives.length || d.ingredientsCount != null) {
    const pen = d.additives.reduce((a, x) => a + [0, 5, 14, 28][x.risk]!, 0);
    parts.push({ id: 'additives', label: 'Additivi', value: Math.round(clamp(100 - pen)), weight: 0.1, note: d.additives.length ? `${d.additives.length} additivi` : 'nessun additivo' });
  }
  /* 4. produzione: impatto ambientale, bio, olio di palma */
  let prod: number | undefined; const pn: string[] = [];
  if (d.eco?.score != null) { prod = clamp(d.eco.score); pn.push(`Eco-Score ${d.eco.grade ?? Math.round(d.eco.score)}`); }
  else if (d.eco?.grade) { prod = ({ 'A+': 95, A: 88, B: 72, C: 55, D: 35, E: 15 } as Record<string, number>)[d.eco.grade] ?? 50; pn.push(`Eco-Score ${d.eco.grade}`); }
  if (d.organic) { prod = clamp((prod ?? 60) + 15); pn.push('biologico'); }
  if (d.palmOil) { prod = clamp((prod ?? 60) - 10); pn.push('olio di palma'); }
  if (prod != null) parts.push({ id: 'production', label: 'Come è prodotto', value: Math.round(prod), weight: 0.15, note: pn.join(' · ') });

  const wsum = parts.reduce((a, x) => a + x.weight, 0);
  let score = wsum ? parts.reduce((a, x) => a + x.value * x.weight, 0) / wsum : 0;
  /* tetti: un prodotto molto sbilanciato o ultra-lavorato non può avere un voto alto per altri meriti */
  let capped: string | undefined;
  const cap = (max: number, why: string) => { if (score > max) { score = max; capped = why; } };
  if (d.nutriscore?.grade === 'E') cap(39, 'Nutri-Score E: il voto non supera 39'); else if (d.nutriscore?.grade === 'D') cap(59, 'Nutri-Score D: il voto non supera 59');
  if (d.nova === 4) cap(69, 'Ultra-lavorato (NOVA 4): il voto non supera 69');
  if (d.additives.some((a) => a.risk === 3)) cap(54, 'Contiene un additivo da evitare: il voto non supera 54');
  score = Math.round(clamp(score));

  /* perché */
  const p = d.per100;
  if (d.nutriscore && 'AB'.includes(d.nutriscore.grade)) good.push(`Buon equilibrio nutrizionale (Nutri-Score ${d.nutriscore.grade})`);
  if (d.nova && d.nova <= 2) good.push(d.nova === 1 ? 'Poco o per niente lavorato' : 'Ingrediente culinario semplice');
  if (d.nova === 4) bad.push('Alimento ultra-lavorato (NOVA 4): ricette industriali con ingredienti che in cucina non useresti');
  if (d.organic) good.push('Da agricoltura biologica: meno pesticidi di sintesi, per regolamento');
  if (p.fiber != null && p.fiber >= 6) good.push(`Ricco di fibre (${p.fiber} g)`); else if (p.fiber != null && p.fiber >= 3) good.push(`Buon contenuto di fibre (${p.fiber} g)`);
  if (p.protein != null && p.protein >= 12) good.push(`Buone proteine (${p.protein} g)`);
  if (p.sugars != null && p.sugars <= 5) good.push('Pochi zuccheri'); else if (p.sugars != null && p.sugars >= 15) bad.push(`Molti zuccheri (${p.sugars} g su 100 g)`);
  if (p.sat != null && p.sat >= 5) bad.push(`Grassi saturi alti (${p.sat} g)`); else if (p.sat != null && p.sat <= 1.5) good.push('Pochi grassi saturi');
  if (p.salt != null && p.salt >= 1.5) bad.push(`Molto sale (${p.salt} g)`); else if (p.salt != null && p.salt <= 0.3) good.push('Poco sale');
  if (d.palmOil) bad.push('Contiene olio di palma (grasso saturo e filiera discussa)');
  if (d.additives.filter((a) => a.risk >= 2).length) bad.push(`Additivi da limitare: ${d.additives.filter((a) => a.risk >= 2).map((a) => a.code).join(', ')}`);
  if (!d.additives.length && d.ingredients) good.push('Nessun additivo');
  if (d.eco?.grade && ['A', 'A+', 'B'].includes(d.eco.grade)) good.push(`Basso impatto ambientale (Eco-Score ${d.eco.grade})`); else if (d.eco?.grade && ['D', 'E'].includes(d.eco.grade)) bad.push(`Alto impatto ambientale (Eco-Score ${d.eco.grade})`);
  if (d.labels.includes('Integrale')) good.push('Integrale');

  const label = score >= 80 ? 'Ottimo' : score >= 65 ? 'Buono' : score >= 50 ? 'Discreto' : score >= 35 ? 'Scadente' : 'Da evitare';
  const color = score >= 80 ? '#3fbf8a' : score >= 65 ? '#8fcf6a' : score >= 50 ? '#e0c97b' : score >= 35 ? '#e8955f' : '#e0615f';
  return { score, label, color, parts, good: good.slice(0, 6), bad: bad.slice(0, 6), capped, confidence: Math.round(wsum * 100) };
}

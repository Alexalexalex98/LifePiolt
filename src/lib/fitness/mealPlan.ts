/**
 * Piano alimentare (modulo PURO, a regole: niente AI). Non è un piano dietetico e non sostituisce un nutrizionista:
 * parte dal fabbisogno indicativo, rispetta dieta ed esclusioni, ruota i pasti nella settimana e ogni voce si può cambiare.
 */
import { FOOD, macrosFor } from './nutrition.ts';

export type Slot = 'colazione' | 'spuntino' | 'pranzo' | 'merenda' | 'cena';
export type PlanItem = { foodId: string; grams: number };
export type PlanMeal = { id: string; slot: Slot; name: string; items: PlanItem[] };
export type PlanDay = PlanMeal[];
export type Diet = 'onnivoro' | 'vegetariano' | 'vegano';
export type Avoid = 'lattosio' | 'glutine' | 'frutta secca' | 'pesce' | 'uova';
export type PlanPrefs = { diet: Diet; avoid: Avoid[]; meals: 3 | 4 | 5; kcal: number; /** per quante persone si fa la spesa (il piano resta per una persona) */ people?: number; /** obiettivo calorico scelto a mano (altrimenti quello calcolato) */ kcalOverride?: number };

type Tpl = { slot: Slot; name: string; items: [string, number][]; veg?: boolean; vegan?: boolean; lactose?: boolean; gluten?: boolean; nuts?: boolean; fish?: boolean; egg?: boolean };
const T = (slot: Slot, name: string, items: [string, number][], f: Partial<Tpl> = {}): Tpl => ({ slot, name, items, ...f });
/** Pasti base (grammi di partenza): vengono scalati per arrivare alle calorie del momento. veg = adatto ai vegetariani, vegan = ai vegani. */
export const TEMPLATES: Tpl[] = [
  T('colazione', 'Yogurt greco con avena e banana', [['yogurt-greco-0', 170], ['avena-fiocchi', 40], ['banana', 100]], { veg: true, lactose: true, gluten: true }),
  T('colazione', 'Pane integrale con marmellata e latte', [['pane-integrale', 60], ['marmellata-di-albicocche', 20], ['latte-parzialmente-scremato', 200]], { veg: true, lactose: true, gluten: true }),
  T('colazione', 'Fiocchi d\'avena con latte di soia e mela', [['avena-fiocchi', 50], ['latte-di-soia-senza-zucchero', 200], ['mela', 150]], { veg: true, vegan: true, gluten: true }),
  T('colazione', 'Uova sode con pane e frutta', [['uova-sode', 100], ['pane-integrale', 50], ['arancia', 200]], { veg: true, gluten: true, egg: true }),
  T('colazione', 'Yogurt di soia con muesli', [['yogurt-di-soia', 150], ['muesli-senza-zuccheri', 40], ['banana', 100]], { veg: true, vegan: true, gluten: true }),
  T('spuntino', 'Mela e mandorle', [['mela', 150], ['mandorle', 20]], { veg: true, vegan: true, nuts: true }),
  T('spuntino', 'Yogurt greco', [['yogurt-greco-0', 150]], { veg: true, lactose: true }),
  T('spuntino', 'Banana', [['banana', 120]], { veg: true, vegan: true }),
  T('spuntino', 'Frutta e ricotta magra', [['arancia', 200], ['ricotta-magra', 60]], { veg: true, lactose: true }),
  T('merenda', 'Frutta fresca', [['mela', 180]], { veg: true, vegan: true }),
  T('merenda', 'Hummus con pane', [['hummus-di-ceci', 50], ['pane-integrale', 40]], { veg: true, vegan: true, gluten: true }),
  T('merenda', 'Yogurt bianco magro', [['yogurt-bianco-magro', 125]], { veg: true, lactose: true }),
  T('pranzo', 'Pasta integrale con verdure e pollo', [['pasta-integrale-cotta', 220], ['pollo', 120], ['zucchine', 150], ['olio-extravergine-d-oliva', 8]], { gluten: true }),
  T('pranzo', 'Riso con salmone e broccoli', [['riso-bianco-bollito', 200], ['salmone-alla-piastra', 120], ['broccoli-lessati', 150], ['olio-extravergine-d-oliva', 6]], { fish: true }),
  T('pranzo', 'Pasta e lenticchie', [['pasta-e-lenticchie', 300], ['insalata-mista', 100], ['olio-extravergine-d-oliva', 6]], { veg: true, vegan: true, gluten: true }),
  T('pranzo', 'Insalata di quinoa con ceci e verdure', [['quinoa-cotta', 180], ['ceci-cotti', 120], ['pomodori-da-insalata', 100], ['olio-extravergine-d-oliva', 8]], { veg: true, vegan: true }),
  T('pranzo', 'Pasta al pomodoro con mozzarella', [['pasta-al-pomodoro', 250], ['mozzarella-light', 80], ['insalata-mista', 100]], { veg: true, lactose: true, gluten: true }),
  T('pranzo', 'Tacchino con patate e spinaci', [['tacchino', 150], ['patate-lesse', 200], ['spinaci-lessati', 150], ['olio-extravergine-d-oliva', 6]], {}),
  T('pranzo', 'Tofu saltato con riso', [['tofu-saltato-con-verdure', 250], ['riso-bianco-bollito', 180]], { veg: true, vegan: true }),
  T('cena', 'Merluzzo con patate e zucchine', [['merluzzo-fresco', 180], ['patate-lesse', 180], ['zucchine-grigliate', 150], ['olio-extravergine-d-oliva', 6]], { fish: true }),
  T('cena', 'Frittata con verdure e pane', [['uova-strapazzate', 120], ['zucchine', 150], ['pane-integrale', 50]], { veg: true, gluten: true, egg: true }),
  T('cena', 'Pollo alla piastra con insalata', [['pollo', 150], ['insalata-mista', 150], ['pane-integrale', 50], ['olio-extravergine-d-oliva', 8]], { gluten: true }),
  T('cena', 'Zuppa di ceci con pane', [['ceci-cotti', 200], ['pomodori-da-insalata', 100], ['pane-integrale', 60], ['olio-extravergine-d-oliva', 6]], { veg: true, vegan: true, gluten: true }),
  T('cena', 'Ricotta con verdure e patate', [['ricotta-magra', 150], ['patate-lesse', 200], ['broccoli-lessati', 150], ['olio-extravergine-d-oliva', 6]], { veg: true, lactose: true }),
  T('cena', 'Tonno con fagioli e insalata', [['tonno-al-naturale', 100], ['fagioli-cannellini-cotti', 150], ['insalata-mista', 100], ['olio-extravergine-d-oliva', 8]], { fish: true }),
  T('cena', 'Tofu con verdure e riso', [['tofu', 150], ['riso-bianco-bollito', 160], ['broccoli-lessati', 150], ['olio-extravergine-d-oliva', 6]], { veg: true, vegan: true }),
];
const SHARE: Record<Slot, number> = { colazione: 0.22, spuntino: 0.08, pranzo: 0.33, merenda: 0.07, cena: 0.30 };
const slotsFor = (n: 3 | 4 | 5): Slot[] => (n === 3 ? ['colazione', 'pranzo', 'cena'] : n === 4 ? ['colazione', 'pranzo', 'merenda', 'cena'] : ['colazione', 'spuntino', 'pranzo', 'merenda', 'cena']);

const allowed = (t: Tpl, p: PlanPrefs): boolean => {
  if (p.diet === 'vegano' && !t.vegan) return false;
  if (p.diet === 'vegetariano' && !t.veg) return false;
  if (p.avoid.includes('lattosio') && t.lactose) return false;
  if (p.avoid.includes('glutine') && t.gluten) return false;
  if (p.avoid.includes('frutta secca') && t.nuts) return false;
  if (p.avoid.includes('pesce') && t.fish) return false;
  if (p.avoid.includes('uova') && t.egg) return false;
  return true;
};
export const kcalOf = (items: PlanItem[]): number => Math.round(items.reduce((s, i) => { const f = FOOD(i.foodId); return s + (f ? macrosFor(f, i.grams).kcal : 0); }, 0));
const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** Scala le quantità per arrivare alle calorie volute (tra 0,6 e 1,8 volte la ricetta base). */
export function scale(items: [string, number][], targetKcal: number): PlanItem[] {
  const base = kcalOf(items.map(([foodId, grams]) => ({ foodId, grams })));
  const k = base > 0 ? Math.min(1.8, Math.max(0.6, targetKcal / base)) : 1;
  return items.map(([foodId, g]) => ({ foodId, grams: round5(g * k) }));
}

/** Una settimana (lunedì-domenica) di pasti. `seed` cambia la rotazione, così «rifai» dà un piano diverso. */
export function generatePlan(p: PlanPrefs, seed = 0): { days: PlanDay[]; warnings: string[] } {
  const warnings: string[] = [];
  const days: PlanDay[] = [];
  for (let d = 0; d < 7; d++) {
    const day: PlanDay = [];
    for (const slot of slotsFor(p.meals)) {
      const pool = TEMPLATES.filter((t) => t.slot === slot && allowed(t, p));
      if (!pool.length) { if (!warnings.some((w) => w.includes(slot))) warnings.push(`Con le tue scelte non ho un pasto adatto per ${slot}: aggiungilo tu.`); continue; }
      const shareSum = slotsFor(p.meals).reduce((s, x) => s + SHARE[x], 0);
      const t = pool[(d + seed + slot.length) % pool.length];
      day.push({ id: `${d}-${slot}`, slot, name: t.name, items: scale(t.items, (p.kcal * SHARE[slot]) / shareSum) });
    }
    days.push(balanceDay(day, p.kcal).day);
  }
  return { days, warnings };
}

export type Balance = { day: PlanDay; status: 'ok' | 'low' | 'high'; kcal: number; /** calorie raggiungibili con porzioni ragionevoli */ min: number; max: number };
const MIN_K = 0.5, MAX_K = 2.2;
/** Ridimensiona le porzioni dei pasti (tranne quello che l'utente ha appena cambiato) per arrivare alle calorie dell'obiettivo. Se non si riesce con porzioni ragionevoli lo dice: troppo pochi o troppi pasti per quell'obiettivo. */
export function balanceDay(day: PlanDay, target: number, locked?: string): Balance {
  const kc = (m: PlanMeal) => kcalOf(m.items);
  const L = day.filter((m) => m.id === locked).reduce((a, m) => a + kc(m), 0);
  const U = day.filter((m) => m.id !== locked).reduce((a, m) => a + kc(m), 0);
  const min = Math.round(L + U * MIN_K), max = Math.round(L + U * MAX_K);
  if (U <= 0) { const k = L; return { day, status: k < target * 0.95 ? 'low' : k > target * 1.05 ? 'high' : 'ok', kcal: k, min, max }; }
  const k = Math.min(MAX_K, Math.max(MIN_K, (target - L) / U));
  const out = day.map((m) => (m.id === locked ? m : { ...m, items: m.items.map((i) => ({ ...i, grams: round5(i.grams * k) })) }));
  const total = out.reduce((a, m) => a + kc(m), 0);
  return { day: out, status: total < target * 0.95 ? 'low' : total > target * 1.05 ? 'high' : 'ok', kcal: total, min, max };
}

export const dayKcal = (day: PlanDay): number => day.reduce((s, m) => s + kcalOf(m.items), 0);

/** Tutto ciò che serve per i prossimi giorni (grammi per alimento), dal piano. */
export function needsFor(days: PlanDay[], fromWeekday: number, count: number): Map<string, number> {
  const out = new Map<string, number>();
  for (let k = 0; k < count; k++) for (const m of days[(fromWeekday + k) % 7] ?? []) for (const it of m.items) out.set(it.foodId, (out.get(it.foodId) ?? 0) + it.grams);
  return out;
}

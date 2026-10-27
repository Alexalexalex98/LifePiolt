import { parseWater } from './mealInsights.ts';

/** Banner «hai bevuto?» (modulo PURO): quando mostrarlo e cosa si può segnare. L'app non sa se bevi davvero: conta solo quello che segni. */
export const GLASS_ML = 250;

export type BannerIn = { now: number; on: boolean; afterMin: number; from: string; to: string; lastDrink: number; snoozeUntil: number; todayMl: number; goalMl: number };

const at = (now: number, hhmm: string): number => { const [h, m] = hhmm.split(':').map(Number); const d = new Date(now); d.setHours(h || 0, m || 0, 0, 0); return d.getTime(); };

/** Minuti dall'ultima acqua segnata (o dall'inizio della giornata se oggi non hai segnato nulla), oppure null se il banner non va mostrato. */
export function bannerMinutes(i: BannerIn): number | null {
  if (!i.on) return null;
  const start = at(i.now, i.from), end = at(i.now, i.to);
  if (i.now < start || i.now > end) return null;
  if (i.todayMl >= i.goalMl) return null;
  if (i.now < i.snoozeUntil) return null;
  const since = Math.max(i.lastDrink, start);
  const min = Math.floor((i.now - since) / 60000);
  return min >= i.afterMin ? min : null;
}

export function sinceText(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m >= 5 ? `${h} h ${m} min` : `${h} h`) : `${min} min`;
}

export type Drink = { id: string; label: string; ml: number; /** quanta parte conta come liquido (stima) */ hydrate: number; /** id nel database degli alimenti, se ha calorie */ food?: string };
export const DRINKS: Drink[] = [
  { id: 'te', label: 'Tè o tisana', ml: 200, hydrate: 1 },
  { id: 'caffe', label: 'Caffè', ml: 40, hydrate: 1 },
  { id: 'latte', label: 'Latte', ml: 200, hydrate: 0.9, food: 'latte' },
  { id: 'succo', label: 'Succo di frutta', ml: 200, hydrate: 0.9, food: 'succo' },
  { id: 'spremuta', label: 'Spremuta', ml: 200, hydrate: 0.9, food: 'spremuta-d-arancia' },
  { id: 'bibita', label: 'Bibita gassata', ml: 330, hydrate: 0.9, food: 'cola' },
  { id: 'birra', label: 'Birra', ml: 330, hydrate: 0, food: 'birra' },
  { id: 'vino', label: 'Vino', ml: 125, hydrate: 0, food: 'vino' },
];

/** Una quantità scritta come capita («350», «1,5 l», «mezzo litro», «2 bicchieri», «33 cl») in millilitri. Un numero da solo vale ml. null se non è valida (1-5000 ml). */
export function parseAmountMl(raw: string): number | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  const bare = /^\d+(?:[.,]\d+)?$/.exec(t);
  const ml = bare ? Math.round(Number(t.replace(',', '.'))) : parseWater(t);
  return ml !== null && Number.isFinite(ml) && ml >= 1 && ml <= 5000 ? ml : null;
}

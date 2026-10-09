import { currentCurrency, formatMoney } from '../i18n/format.ts';
import { t } from '../i18n/core.ts';
/**
 * Obiettivi collegati ai dati: l'avanzamento si calcola da solo da salute e finanze. Modulo PURO e testabile.
 * Periodo 'week' = ultimi 7 giorni (oggi incluso), 'month' = ultimi 30 giorni (per il risparmio: il mese in corso).
 */
export type GoalMetric = 'workouts' | 'steps' | 'sleep' | 'mindful' | 'exercise' | 'savings';
export type GoalPeriod = 'week' | 'month';
export type Pt = { d: string; v: number };

export type GoalLink = { metric: GoalMetric; target: number; period: GoalPeriod };

export const goalMetrics: Record<GoalMetric, { label: string; unit: string; how: 'count' | 'avg' | 'sum' | 'net'; defTarget: number; hint: string; dec: number; periods: GoalPeriod[] }> = {
  workouts: { label: 'Allenamenti', unit: 'allenamenti', how: 'count', defTarget: 3, hint: 'Numero di allenamenti nel periodo', dec: 0, periods: ['week', 'month'] },
  steps: { label: 'Passi medi', unit: 'passi al giorno', how: 'avg', defTarget: 8000, hint: 'Media giornaliera nel periodo', dec: 0, periods: ['week', 'month'] },
  sleep: { label: 'Ore di sonno', unit: 'ore per notte', how: 'avg', defTarget: 7.5, hint: 'Media per notte nel periodo', dec: 1, periods: ['week', 'month'] },
  mindful: { label: 'Mindfulness', unit: 'minuti', how: 'sum', defTarget: 60, hint: 'Minuti totali nel periodo', dec: 0, periods: ['week', 'month'] },
  exercise: { label: 'Minuti di esercizio', unit: 'minuti al giorno', how: 'avg', defTarget: 30, hint: 'Media giornaliera nel periodo', dec: 0, periods: ['week', 'month'] },
  savings: { label: 'Risparmio mensile', unit: 'CHF', how: 'net', defTarget: 500, hint: 'Entrate meno uscite del mese in corso', dec: 0, periods: ['month'] },
};
export const goalMetricIds = Object.keys(goalMetrics) as GoalMetric[];
export const periodLabel: Record<GoalPeriod, string> = { week: 'a settimana', month: 'al mese' };

export type GoalInputs = {
  today: string;
  /** serie giornaliere (data ISO, valore) per metrica di salute */
  series: Partial<Record<'steps' | 'sleep' | 'mindful' | 'exercise', Pt[]>>;
  /** giorni ISO degli allenamenti registrati (uno per allenamento) */
  workoutDays: string[];
  /** entrate - uscite del mese in corso */
  monthNet: number | null;
};

export type GoalProgressInfo = {
  value: number | null; target: number; pct: number; done: boolean;
  /** quanti giorni con dati nel periodo */
  samples: number; text: string; unit: string; hasData: boolean;
};

const addDays = (d: string, n: number) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); const p = (v: number) => String(v).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`; };
const fmt = (v: number, dec: number) => (Math.round(v * 10 ** dec) / 10 ** dec).toString().replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, "'");

export function isGoalLink(g: { metric?: string; target?: number; period?: string }): g is GoalLink {
  return !!g.metric && g.metric in goalMetrics && typeof g.target === 'number' && g.target > 0 && (g.period === 'week' || g.period === 'month');
}

export function goalProgress(link: GoalLink, inp: GoalInputs): GoalProgressInfo {
  const meta = goalMetrics[link.metric];
  const days = link.period === 'week' ? 7 : 30;
  const from = addDays(inp.today, -(days - 1));
  const inWin = (d: string) => d >= from && d <= inp.today;
  let value: number | null = null, samples = 0;
  if (link.metric === 'workouts') {
    const n = inp.workoutDays.filter(inWin).length;
    value = n; samples = n;
  } else if (link.metric === 'savings') {
    value = inp.monthNet; samples = inp.monthNet == null ? 0 : 1;
  } else {
    const pts = (inp.series[link.metric] ?? []).filter((p) => inWin(p.d) && Number.isFinite(p.v));
    samples = pts.length;
    if (pts.length) {
      const sum = pts.reduce((s, p) => s + p.v, 0);
      value = meta.how === 'sum' ? sum : sum / pts.length;
    }
  }
  const hasData = value != null;
  const pct = hasData && value! > 0 ? Math.min(100, Math.round((value! / link.target) * 100)) : 0;
  const unit = link.metric === 'savings' ? currentCurrency() : meta.unit;
  const text = hasData
    ? (link.metric === 'savings' ? t('{0} su {1} {2} questo mese', fmt(value!, meta.dec), fmt(link.target, meta.dec), unit) : link.period === 'week' ? t('{0} su {1} {2} (ultimi 7 giorni)', fmt(value!, meta.dec), fmt(link.target, meta.dec), unit) : t('{0} su {1} {2} (ultimi 30 giorni)', fmt(value!, meta.dec), fmt(link.target, meta.dec), unit))
    : 'Ancora nessun dato: collega Apple Health o registra i dati a mano.';
  return { value, target: link.target, pct, done: hasData && value! >= link.target, samples, text, unit, hasData };
}

/** Descrizione breve del collegamento, per le card ("Allenamenti · 3 a settimana"). */
export function linkTitle(link: GoalLink): string {
  const m = goalMetrics[link.metric];
  const tgt = fmt(link.target, m.dec);
  if (link.metric === 'savings') return t('Risparmio · {0} al mese', formatMoney(link.target));
  if (link.metric === 'workouts') return link.period === 'week' ? t('Allenamenti · {0} a settimana', tgt) : t('Allenamenti · {0} al mese', tgt);
  if (link.metric === 'steps') return t('Passi medi · {0} al giorno', tgt);
  if (link.metric === 'sleep') return t('Sonno · {0} ore per notte', tgt);
  if (link.metric === 'exercise') return t('Esercizio · {0} minuti al giorno', tgt);
  return link.period === 'week' ? t('Mindfulness · {0} minuti a settimana', tgt) : t('Mindfulness · {0} minuti al mese', tgt);
}

/** "dd/mm" (formato degli allenamenti salvati) -> data ISO, scegliendo l'anno più vicino a `today` senza finire nel futuro. */
export function ddmmToIso(s: string, today: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(s.trim());
  if (!m) return null;
  const p = (v: number) => String(v).padStart(2, '0');
  const y = Number(today.slice(0, 4));
  let iso = `${y}-${p(Number(m[2]))}-${p(Number(m[1]))}`;
  if (iso > addDays(today, 1)) iso = `${y - 1}-${p(Number(m[2]))}-${p(Number(m[1]))}`;
  return iso;
}

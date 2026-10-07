import { useMemo } from 'react';

import {
  addDays, analyze, attainment, buildInsights, correlations, dayDiff, domainScore, makeForecast, mean, todayStr,
  type Analysis, type Correlation, type Domain, type Forecast, type Insight, type MetricDef, type Pt, type Series,
} from '@/lib/analytics';
import { dayKey, monthNames } from '@/lib/format';
import { useFin, monthEnd, type FinMonth } from '@/store/finance';
import { healthMeta, pointsOf, useHealth, type Metric } from '@/store/health';
import { useContext } from '@/store/context';
import { useLife } from '@/store/life';

/* ---------- definizioni delle metriche ---------- */
const H = (id: Metric, over: Partial<MetricDef>): MetricDef => ({ id, label: healthMeta[id].label, unit: healthMeta[id].unit, dec: healthMeta[id].dec, color: healthMeta[id].color, domain: 'salute', better: 'up', period: 'day', ...over });

export const defs: Record<string, MetricDef> = {
  sleep: H('sleep', { better: 'range', range: [7, 9] }),
  steps: H('steps', { target: 10000 }),
  hr: H('hr', { label: 'Battito a riposo', better: 'down' }),
  hrv: H('hrv', { label: 'HRV' }),
  weight: H('weight', { better: 'none' }),
  energy: H('energy', { target: 400 }),
  exercise: H('exercise', { label: 'Esercizio', target: 30 }),
  vo2: H('vo2', { label: 'VO₂ max' }),
  spo2: H('spo2', { better: 'range', range: [95, 100], label: 'Ossigeno' }),
  stress: H('stress', { domain: 'mente', better: 'down', target: 45, label: 'Stress (stimato)', derivedFrom: ['hrv', 'hr'] }),
  mindful: H('mindful', { domain: 'mente', target: 10 }),
  mood: { id: 'mood', label: 'Umore', unit: '/5', domain: 'mente', better: 'up', target: 3.5, dec: 1, color: '#c9b6ff', period: 'day' },
  balance: { id: 'balance', label: 'Saldo a fine mese', unit: 'CHF', domain: 'finanza', better: 'up', dec: 0, color: '#7be0b0', period: 'month' },
  savings: { id: 'savings', label: 'Tasso di risparmio', unit: '%', domain: 'finanza', better: 'up', target: 20, dec: 0, color: '#7be0b0', period: 'month' },
  spending: { id: 'spending', label: 'Spese del mese', unit: 'CHF', domain: 'finanza', better: 'down', dec: 0, color: '#ff9d9d', period: 'month' },
  dailyspend: { id: 'dailyspend', label: 'Spesa giornaliera', unit: 'CHF', domain: 'finanza', better: 'down', dec: 0, color: '#ffb84f', period: 'day' },
  rain: { id: 'rain', label: 'Pioggia', unit: 'mm', domain: 'contesto', better: 'none', dec: 1, color: '#7bb8e0', period: 'day' },
  sun: { id: 'sun', label: 'Ore di sole', unit: 'h', domain: 'contesto', better: 'none', dec: 1, color: '#e0c97b', period: 'day' },
  temp: { id: 'temp', label: 'Temperatura massima', unit: '°C', domain: 'contesto', better: 'none', dec: 0, color: '#ff9d9d', period: 'day' },
  events: { id: 'events', label: 'Impegni in calendario', unit: '/giorno', domain: 'contesto', better: 'none', dec: 0, color: '#8fb3ff', period: 'day' },
  tasks: { id: 'tasks', label: 'Task completati', unit: '/giorno', domain: 'crescita', better: 'up', target: 2, dec: 1, color: '#8fb3ff', period: 'day' },
};

const moodScore: Record<string, number> = { Felice: 5, Calmo: 4, Neutro: 3, Stressato: 2, Triste: 2, Arrabbiato: 1 };

/* ---------- conversioni di data ---------- */
function ddmmToDay(s: string, today: string): string {
  const [d, m] = s.split('/').map(Number);
  const y = Number(today.slice(0, 4));
  let iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if (iso > addDays(today, 1)) iso = `${y - 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return iso;
}
function monthStart(label: string): string | null {
  const [name, year] = label.split(' ');
  const i = monthNames.indexOf(name);
  return i < 0 || !year ? null : `${year}-${String(i + 1).padStart(2, '0')}-01`;
}

/** Spesa per giorno (con gli zeri) dal primo movimento a oggi. */
function dailySpend(months: FinMonth[], today: string): Pt[] {
  const map = new Map<string, number>();
  months.forEach((m) => {
    const ms = monthStart(m.label);
    if (!ms) return;
    m.movements.forEach((mv) => {
      if (mv.amount >= 0) return;
      const dd = Number(mv.date.split('/')[0]);
      const d = `${ms.slice(0, 8)}${String(dd).padStart(2, '0')}`;
      map.set(d, (map.get(d) ?? 0) - mv.amount);
    });
  });
  if (!map.size) return [];
  const first = [...map.keys()].sort()[0];
  const out: Pt[] = [];
  for (let n = dayDiff(first, today), i = 0; i <= n; i++) { const d = addDays(first, i); out.push({ d, v: Math.round(map.get(d) ?? 0) }); }
  return out.slice(-90);
}

/* ---------- raccolta dati da tutta l'app ---------- */
export function collect(today = todayStr()): Series[] {
  const out: Series[] = [];
  const h = useHealth.getState();
  (['sleep', 'steps', 'hr', 'hrv', 'weight', 'energy', 'exercise', 'vo2', 'spo2', 'stress', 'mindful'] as Metric[]).forEach((m) => {
    const pts = pointsOf(h, m);
    if (pts.length) out.push({ def: defs[m], pts, source: h.sources[m] ?? 'manuale' });
  });

  const moods = h.moods.map((x) => ({ d: x.day ?? ddmmToDay(x.date, today), v: moodScore[x.mood] ?? 3 }));
  if (moods.length) {
    const byDay = new Map<string, number[]>();
    moods.forEach((p) => byDay.set(p.d, [...(byDay.get(p.d) ?? []), p.v]));
    out.push({ def: defs.mood, pts: [...byDay.entries()].map(([d, v]) => ({ d, v: mean(v) })).sort((a, b) => a.d.localeCompare(b.d)), source: 'manuale' });
  }

  const fin = useFin.getState();
  const months = fin.months.slice().reverse();
  const bal: Pt[] = [], sav: Pt[] = [], spe: Pt[] = [];
  const curStart = monthStart(fin.months[0]?.label ?? '');
  months.forEach((m) => {
    const ms = monthStart(m.label);
    if (!ms) return;
    const partial = ms === curStart && Number(today.slice(8, 10)) < 28; // mese ancora in corso: spese e risparmio non sono confrontabili
    const income = m.movements.filter((x) => x.amount > 0).reduce((s, x) => s + x.amount, 0);
    const spent = -m.movements.filter((x) => x.amount < 0).reduce((s, x) => s + x.amount, 0);
    if (m.movements.length) bal.push({ d: ms, v: Math.round(monthEnd(m)) });
    if (!partial && income > 0) sav.push({ d: ms, v: Math.round(((income - spent) / income) * 100) });
    if (!partial && spent > 0) spe.push({ d: ms, v: Math.round(spent) });
  });
  if (bal.length) out.push({ def: defs.balance, pts: bal, source: 'manuale' });
  if (sav.length) out.push({ def: defs.savings, pts: sav, source: 'manuale' });
  if (spe.length) out.push({ def: defs.spending, pts: spe, source: 'manuale' });
  const ds = dailySpend(fin.months, today);
  if (ds.length >= 7) out.push({ def: defs.dailyspend, pts: ds, source: 'manuale' });

  const life = useLife.getState();
  const done = new Map<string, number>();
  life.tasks.forEach((t) => {
    if (t.doneAt) done.set(t.doneAt, (done.get(t.doneAt) ?? 0) + 1);
    t.subtasks?.forEach((s) => { if (s.doneAt) done.set(s.doneAt, (done.get(s.doneAt) ?? 0) + 1); });
  });
  if (done.size) {
    const first = [...done.keys()].sort()[0];
    const pts: Pt[] = [];
    for (let n = dayDiff(first, today), i = 0; i <= n; i++) { const d = addDays(first, i); pts.push({ d, v: done.get(d) ?? 0 }); }
    out.push({ def: defs.tasks, pts: pts.slice(-60), source: 'manuale' });
  }
  life.goals.forEach((g) => {
    if ((g.hist?.length ?? 0) >= 2) out.push({ def: { id: `goal:${g.id}`, label: g.t, unit: '%', domain: 'crescita', better: 'up', dec: 0, color: '#8fa4ff', period: 'day' }, pts: g.hist!.map((x) => ({ d: x.d, v: x.p })), source: 'manuale' });
  });
  return out;
}

/* ---------- insight specifici della finanza (ritmo di spesa, categorie) ---------- */
function financeInsights(today: string): Insight[] {
  const fin = useFin.getState();
  const out: Insight[] = [];
  const cur = fin.months[0];
  if (!cur) return out;
  const spent = (m: FinMonth) => -m.movements.filter((x) => x.amount < 0).reduce((s, x) => s + x.amount, 0);
  const dayOfMonth = Number(today.slice(8, 10));
  const dim = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate();
  const prev = fin.months[1];
  if (prev && dayOfMonth >= 5 && spent(cur) > 0) {
    // quota di spesa "già fatta" al giorno D nei mesi precedenti (l'affitto a inizio mese non va spalmato)
    const shareAt = (m: FinMonth, d: number) => {
      const tot = spent(m);
      if (!tot) return null;
      const upto = -m.movements.filter((x) => x.amount < 0 && Number(x.date.split('/')[0]) <= d).reduce((s2, x) => s2 + x.amount, 0);
      return upto / tot;
    };
    const shares = fin.months.slice(1, 4).map((m) => shareAt(m, dayOfMonth)).filter((x): x is number => x != null);
    const share = shares.length ? mean(shares) : dayOfMonth / dim;
    if (share >= 0.2) {
      const projected = spent(cur) / share;
      const base = spent(prev);
      const pct = base ? ((projected - base) / base) * 100 : 0;
      if (Math.abs(pct) >= 12) {
        out.push({
          id: 'fin-runrate', severity: pct > 0 ? 'warn' : 'good', domain: 'finanza', metricId: 'spending', priority: pct > 0 ? 2.2 : 1.3,
          title: pct > 0 ? 'Stai spendendo più del mese scorso' : 'Stai spendendo meno del mese scorso',
          detail: `Sulla base di come si distribuivano le tue spese nei mesi precedenti, chiuderai questo mese a circa ${Math.round(projected).toLocaleString('it-CH')} CHF, ${Math.abs(Math.round(pct))}% ${pct > 0 ? 'in più' : 'in meno'} rispetto a ${prev.label.split(' ')[0].toLowerCase()} (${Math.round(base).toLocaleString('it-CH')} CHF).`,
          action: pct > 0 ? 'Guarda la categoria in più crescita e fissa un tetto per le prossime due settimane.' : 'Ottimo: considera di accantonare la differenza.',
        });
      }
    }
  }
  // categoria con l'aumento maggiore rispetto alla media dei mesi precedenti
  const older = fin.months.slice(1, 4);
  if (older.length) {
    let best: { n: string; cur: number; avg: number } | null = null;
    fin.categories.forEach((c) => {
      const v = (m: FinMonth) => -m.movements.filter((x) => x.amount < 0 && x.label === c.n).reduce((s, x) => s + x.amount, 0);
      const avg = mean(older.map(v)), now = v(cur);
      if (avg > 50 && now - avg > 80 && now / avg > 1.25 && (!best || now - avg > best.cur - best.avg)) best = { n: c.n, cur: now, avg };
    });
    if (best) {
      const b = best as { n: string; cur: number; avg: number };
      out.push({ id: 'fin-cat', severity: 'warn', domain: 'finanza', priority: 1.9, title: `${b.n}: spesa in forte aumento`, detail: `${Math.round(b.cur).toLocaleString('it-CH')} CHF questo mese contro una media di ${Math.round(b.avg).toLocaleString('it-CH')} CHF nei mesi precedenti (+${Math.round(((b.cur - b.avg) / b.avg) * 100)}%).`, action: 'Controlla i movimenti di questa categoria per capire se è una spesa una tantum.' });
    }
  }
  return out;
}

/* ---------- risultato completo per la Dashboard ---------- */
export type Dashboard = {
  today: string; list: Analysis[]; byId: Record<string, Analysis>; corrs: Correlation[]; insights: Insight[];
  scores: { salute: number | null; mente: number | null; finanza: number | null; crescita: number | null; total: number | null };
  lifeSeries: Pt[]; lifeForecast: Forecast | null; lifeDelta: number | null;
  dataDays: number; sources: Record<string, number>;
};

/** Indice giornaliero 0-100 per dominio salute/mente: media dell'aderenza agli obiettivi delle metriche di quel giorno. */
function dailyIndex(series: Series[], today: string, days = 28): Pt[] {
  const out: Pt[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const vals: number[] = [];
    series.forEach((s) => {
      if (s.def.period !== 'day' || !['salute', 'mente'].includes(s.def.domain)) return;
      const p = s.pts.find((x) => x.d === d);
      if (!p) return;
      const a = attainment(s.def, p.v);
      if (a != null) vals.push(a);
    });
    if (vals.length >= 2) out.push({ d, v: Math.round(mean(vals)) });
  }
  return out;
}

export function computeDashboard(): Dashboard {
  const today = todayStr();
  const series = collect(today);
  const list = series.filter((s) => s.def.domain !== 'contesto').map((s) => analyze(s, today)).filter((a): a is Analysis => !!a);
  const byId: Record<string, Analysis> = {};
  list.forEach((a) => { byId[a.def.id] = a; });
  const corrs = correlations(series);
  const insights = buildInsights(list, corrs, today, financeInsights(today)).slice(0, 12);

  const sc = { salute: domainScore(list, 'salute'), mente: domainScore(list, 'mente'), finanza: domainScore(list, 'finanza'), crescita: domainScore(list, 'crescita') };
  const vals = Object.values(sc).filter((v): v is number => v != null);
  const total = vals.length ? Math.round(mean(vals)) : null;

  // storico del Life Score: indice giornaliero salute+mente, con finanza e crescita attuali come costanti
  const idx = dailyIndex(series, today);
  const fixed = [sc.finanza, sc.crescita].filter((v): v is number => v != null);
  const lifeSeries = idx.map((p) => ({ d: p.d, v: Math.round(mean([p.v, ...fixed])) }));
  const lifeDef: MetricDef = { id: 'life', label: 'Life Score', unit: '', domain: 'salute', better: 'up', dec: 0, color: '#8fa4ff', period: 'day' };
  const lifeForecast = lifeSeries.length >= 7 ? makeForecast(lifeDef, lifeSeries, 7) : null;
  const w1 = lifeSeries.filter((p) => dayDiff(p.d, today) < 7).map((p) => p.v), w2 = lifeSeries.filter((p) => dayDiff(p.d, today) >= 7 && dayDiff(p.d, today) < 14).map((p) => p.v);
  const lifeDelta = w1.length >= 3 && w2.length >= 3 ? Math.round(mean(w1) - mean(w2)) : null;

  const days = new Set<string>();
  series.forEach((s) => { if (s.def.period === 'day') s.pts.forEach((p) => days.add(p.d)); });
  const sources: Record<string, number> = {};
  series.forEach((s) => { sources[s.source] = (sources[s.source] ?? 0) + 1; });
  return { today, list, byId, corrs, insights, scores: { ...sc, total }, lifeSeries, lifeForecast, lifeDelta, dataDays: days.size, sources };
}

/** Hook: ricalcola l'analisi quando cambiano i dati. */
export function useDashboard(): Dashboard {
  const hs = useHealth((s) => s.series), hd = useHealth((s) => s.dates), hm = useHealth((s) => s.moods);
  const months = useFin((s) => s.months), cats = useFin((s) => s.categories);
  const tasks = useLife((s) => s.tasks), goals = useLife((s) => s.goals);
  return useMemo(() => computeDashboard(), [hs, hd, hm, months, cats, tasks, goals]);
}

export const domainLabel: Record<Domain, string> = { salute: 'Salute', mente: 'Mente', finanza: 'Finanze', crescita: 'Crescita', contesto: 'Contesto' };
void dayKey;

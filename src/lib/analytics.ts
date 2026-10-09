import { currentCurrency, fmtNumber } from '../i18n/format.ts';

/**
 * Motore di analisi: statistica descrittiva, trend, previsioni, anomalie, correlazioni.
 * Modulo PURO (nessuna dipendenza dall'app) così si può testare con numeri noti.
 *
 * Metodi usati, dichiarati apposta per non spacciare stime per certezze:
 *  - trend: regressione lineare (minimi quadrati) sui giorni reali; "significativo" se |t| > 2 con almeno 6 punti
 *  - previsione: retta con smorzamento (φ=0.92) + intervallo di previsione all'80%
 *  - anomalie: z-score robusto (mediana e MAD), soglia 2.5
 *  - correlazioni: Pearson su giorni allineati (stesso giorno o giorno dopo), n ≥ 10, |r| ≥ 0.45 e p < 0.05 corretto per i confronti multipli (Bonferroni)
 */

export type Pt = { d: string; v: number };
export type Domain = 'salute' | 'mente' | 'finanza' | 'crescita' | 'contesto';
export type Better = 'up' | 'down' | 'range' | 'none';
export type Period = 'day' | 'month';

export type MetricDef = {
  id: string; label: string; unit: string; domain: Domain; better: Better; dec: number; color: string; period: Period;
  target?: number;            // obiettivo (per better 'up' = minimo, per 'down' = massimo)
  range?: [number, number];   // intervallo sano (better 'range')
  /** metrica derivata da un'altra: non va correlata con la sorgente (sarebbe banale) */
  derivedFrom?: string[];
};
export type Series = { def: MetricDef; pts: Pt[]; source: string };

export type Status = 'good' | 'warn' | 'bad' | 'neutral';
export type Confidence = 'alta' | 'media' | 'bassa';

export type Forecast = { pts: Pt[]; lo: number[]; hi: number[]; end: number; endLo: number; endHi: number; horizon: number; confidence: Confidence };

export type Analysis = {
  def: MetricDef; source: string; pts: Pt[];
  n: number; coverage: number; latest: Pt; value: number; ageDays: number;
  mean: number; median: number; std: number; min: number; max: number; cv: number;
  avg7: number; avgPrev7: number | null; deltaPct: number | null; vsMeanPct: number;
  slope: number; slopePctWeek: number; r2: number; t: number; trend: 'up' | 'down' | 'flat'; significant: boolean;
  status: Status; goalRate7: number | null; streak: number;
  forecast: Forecast | null; anomalies: Pt[];
};

/* ---------------- date ---------------- */
const MS = 86400000;
export const parseDay = (d: string) => new Date(d.slice(0, 10) + 'T00:00:00').getTime();
export const dayDiff = (a: string, b: string) => Math.round((parseDay(b) - parseDay(a)) / MS);
export const addDays = (d: string, n: number) => {
  const t = new Date(parseDay(d) + n * MS);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
export const addMonths = (d: string, n: number) => {
  const t = new Date(parseDay(d));
  t.setMonth(t.getMonth() + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`;
};
export const todayStr = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

/* ---------------- statistica di base ---------------- */
export const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
export const median = (a: number[]) => {
  if (!a.length) return NaN;
  const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const std = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};
const mad = (a: number[]) => { const m = median(a); return median(a.map((x) => Math.abs(x - m))); };

/** Regressione lineare y = a + b·x. Restituisce anche R², errore standard della pendenza e residuo. */
export function ols(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = mean(xs), my = mean(ys);
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); syy += (ys[i] - my) ** 2; }
  const b = sxx ? sxy / sxx : 0;
  const a = my - b * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (ys[i] - (a + b * xs[i])) ** 2;
  const r2 = syy ? 1 - sse / syy : 0;
  const resStd = n > 2 ? Math.sqrt(sse / (n - 2)) : 0;
  const se = sxx && n > 2 ? resStd / Math.sqrt(sxx) : Infinity;
  return { a, b, r2, resStd, se, t: se && Number.isFinite(se) ? b / se : 0, mx, sxx, n };
}

export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

/* ---------------- valutazione rispetto all'obiettivo ---------------- */
function meets(def: MetricDef, v: number): boolean | null {
  if (def.better === 'range' && def.range) return v >= def.range[0] && v <= def.range[1];
  if (def.target == null) return null;
  return def.better === 'down' ? v <= def.target : v >= def.target;
}

/** Punteggio 0-100 di un valore rispetto all'obiettivo / intervallo (null se non applicabile). */
export function attainment(def: MetricDef, v: number): number | null {
  if (def.better === 'range' && def.range) {
    const [lo, hi] = def.range;
    if (v >= lo && v <= hi) return 100;
    const span = (hi - lo) || 1;
    const dist = v < lo ? lo - v : v - hi;
    return Math.max(0, Math.round(100 - (dist / span) * 100));
  }
  if (def.target == null) return null;
  if (def.better === 'down') return v <= def.target ? 100 : Math.max(0, Math.round((def.target / v) * 100 - (v - def.target) / def.target * 20));
  return Math.min(100, Math.max(0, Math.round((v / def.target) * 100)));
}

/* ---------------- previsione ---------------- */
const PHI = 0.92;
const Z80 = 1.2816;

export function makeForecast(def: MetricDef, pts: Pt[], horizon: number): Forecast | null {
  const n = pts.length;
  if (n < 4) return null;
  const used = pts.slice(-(def.period === 'day' ? 21 : 6));
  const t0 = used[0].d;
  const step = def.period === 'day' ? (d: string) => dayDiff(t0, d) : (d: string) => Math.round(dayDiff(t0, d) / 30.4);
  const xs = used.map((p) => step(p.d)), ys = used.map((p) => p.v);
  const fit = ols(xs, ys);
  const lastX = xs[xs.length - 1];
  const lastFit = fit.a + fit.b * lastX;
  const out: Pt[] = [], lo: number[] = [], hi: number[] = [];
  let cum = 0;
  const clamp = (v: number) => {
    let r = v;
    if (def.id === 'spo2') r = Math.min(100, r);
    if (def.id === 'stress') r = Math.min(100, r);
    return Math.max(0, r);
  };
  for (let h = 1; h <= horizon; h++) {
    cum += fit.b * PHI ** h;
    const x = lastX + h;
    const center = lastFit + cum;
    const se = fit.resStd * Math.sqrt(1 + 1 / fit.n + (x - fit.mx) ** 2 / (fit.sxx || 1));
    const d = def.period === 'day' ? addDays(used[used.length - 1].d, h) : addMonths(used[used.length - 1].d, h);
    out.push({ d, v: clamp(center) });
    lo.push(clamp(center - Z80 * se));
    hi.push(clamp(center + Z80 * se));
  }
  const end = out[out.length - 1].v;
  const width = hi[hi.length - 1] - lo[lo.length - 1];
  const rel = Math.abs(mean(ys)) > 1e-9 ? width / Math.abs(mean(ys)) : 1;
  const confidence: Confidence = n < 7 ? 'bassa' : rel < 0.15 ? 'alta' : rel < 0.4 ? 'media' : 'bassa';
  return { pts: out, lo, hi, end, endLo: lo[lo.length - 1], endHi: hi[hi.length - 1], horizon, confidence };
}

/* ---------------- analisi di una serie ---------------- */
export function analyze(s: Series, today: string): Analysis | null {
  const pts = s.pts.filter((p) => Number.isFinite(p.v)).slice().sort((a, b) => a.d.localeCompare(b.d));
  if (!pts.length) return null;
  const def = s.def;
  const vals = pts.map((p) => p.v);
  const latest = pts[pts.length - 1];
  const t0 = pts[0].d;
  const xs = pts.map((p) => (def.period === 'day' ? dayDiff(t0, p.d) : Math.round(dayDiff(t0, p.d) / 30.4)));
  const fit = pts.length >= 3 ? ols(xs, vals) : { a: 0, b: 0, r2: 0, resStd: 0, se: Infinity, t: 0, mx: 0, sxx: 0, n: pts.length };
  const m = mean(vals), sd = std(vals);

  // finestre da 7 giorni (solo metriche giornaliere)
  let avg7 = m, avgPrev7: number | null = null, deltaPct: number | null = null;
  if (def.period === 'day') {
    const inWin = (from: number, to: number) => pts.filter((p) => { const a = dayDiff(p.d, today); return a >= from && a < to; }).map((p) => p.v);
    const w1 = inWin(0, 7), w2 = inWin(7, 14);
    if (w1.length) avg7 = mean(w1);
    if (w2.length >= 3 && w1.length >= 3) { avgPrev7 = mean(w2); deltaPct = avgPrev7 ? ((avg7 - avgPrev7) / Math.abs(avgPrev7)) * 100 : null; }
  } else if (pts.length >= 2) {
    avgPrev7 = pts[pts.length - 2].v;
    avg7 = latest.v;
    deltaPct = avgPrev7 ? ((latest.v - avgPrev7) / Math.abs(avgPrev7)) * 100 : null;
  }

  const perWeek = def.period === 'day' ? 7 : 1;
  const slopePctWeek = m ? ((fit.b * perWeek) / Math.abs(m)) * 100 : 0;
  const significant = pts.length >= 6 && Math.abs(fit.t) > 2 && Math.abs(slopePctWeek) >= (def.period === 'day' ? 1.5 : 3);
  const trend: Analysis['trend'] = significant ? (fit.b > 0 ? 'up' : 'down') : 'flat';

  // anomalie robuste negli ultimi 14 giorni
  const med = median(vals), md = mad(vals) * 1.4826 || sd || 1;
  const anomalies = pts.filter((p) => dayDiff(p.d, today) <= (def.period === 'day' ? 14 : 62) && Math.abs(p.v - med) / md > 2.5 && pts.length >= 8);

  // obiettivo
  const recent = def.period === 'day' ? pts.filter((p) => dayDiff(p.d, today) < 7 && dayDiff(p.d, today) >= 0) : [];
  let goalRate7: number | null = null;
  if (recent.length && (def.target != null || def.range)) goalRate7 = recent.filter((p) => meets(def, p.v)).length / recent.length;
  let streak = 0;
  if (def.period === 'day' && (def.target != null || def.range)) {
    for (let i = pts.length - 1; i >= 0; i--) { if (meets(def, pts[i].v)) streak++; else break; }
  }

  // stato: obiettivo e direzione del trend
  let status: Status = 'neutral';
  const att = attainment(def, def.period === 'day' ? avg7 : latest.v);
  if (att != null) status = att >= 85 ? 'good' : att >= 60 ? 'warn' : 'bad';
  if (def.better !== 'none' && significant) {
    const good = (def.better === 'up' && trend === 'up') || (def.better === 'down' && trend === 'down');
    const bad = (def.better === 'up' && trend === 'down') || (def.better === 'down' && trend === 'up');
    if (att == null) status = good ? 'good' : bad ? 'warn' : 'neutral';
    else if (bad && status === 'good') status = 'warn';
  }

  const horizon = def.period === 'day' ? 7 : 3;
  return {
    def, source: s.source, pts, n: pts.length,
    coverage: def.period === 'day' ? Math.min(1, pts.filter((p) => dayDiff(p.d, today) >= 0 && dayDiff(p.d, today) < 14).length / 14) : 1,
    latest, value: latest.v, ageDays: Math.max(0, dayDiff(latest.d, today)),
    mean: m, median: med, std: sd, min: Math.min(...vals), max: Math.max(...vals), cv: m ? sd / Math.abs(m) : 0,
    avg7, avgPrev7, deltaPct, vsMeanPct: m ? ((latest.v - m) / Math.abs(m)) * 100 : 0,
    slope: fit.b, slopePctWeek, r2: fit.r2, t: fit.t, trend, significant,
    status, goalRate7, streak,
    forecast: makeForecast(def, pts, horizon), anomalies,
  };
}

/* ---------------- correlazioni ---------------- */
export type Correlation = { a: MetricDef; b: MetricDef; r: number; n: number; lag: 0 | 1; p: number; sentence: string };

/** erfc (approssimazione di Abramowitz-Stegun 7.1.26) */
function erfc(x: number): number {
  const z = Math.abs(x), t = 1 / (1 + 0.3275911 * z);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return x >= 0 ? 1 - y : 1 + y;
}
/** p-value bilaterale della correlazione (trasformata di Fisher) */
export function corrPValue(r: number, n: number): number {
  if (n < 4 || Math.abs(r) >= 1) return Math.abs(r) >= 1 ? 0 : 1;
  const z = Math.atanh(r) * Math.sqrt(n - 3);
  return erfc(Math.abs(z) / Math.SQRT2);
}

export function correlations(series: Series[], minN = 10, minR = 0.45, max = 5): Correlation[] {
  const daily = series.filter((s) => s.def.period === 'day' && s.pts.length >= minN);
  const maps = new Map(daily.map((s) => [s.def.id, new Map(s.pts.map((p) => [p.d, p.v]))]));
  const out: Correlation[] = [];
  // numero di confronti effettuati (per la correzione di Bonferroni)
  const tests = Math.max(1, daily.length * (daily.length - 1)); // coppie ordinate × lag ≈ coppie × 2
  for (const A of daily) for (const B of daily) {
    if (A.def.id === B.def.id) continue;
    if (A.def.derivedFrom?.includes(B.def.id) || B.def.derivedFrom?.includes(A.def.id)) continue;
    for (const lag of [0, 1] as const) {
      if (lag === 0 && A.def.id > B.def.id) continue; // stesso giorno: una sola direzione
      const mb = maps.get(B.def.id)!;
      const xs: number[] = [], ys: number[] = [];
      A.pts.forEach((p) => { const v = mb.get(lag ? addDays(p.d, 1) : p.d); if (v != null) { xs.push(p.v); ys.push(v); } });
      if (xs.length < minN) continue;
      const r = pearson(xs, ys);
      const p = corrPValue(r, xs.length);
      if (Math.abs(r) < minR || p > 0.05 / tests) continue;
      out.push({ a: A.def, b: B.def, r, n: xs.length, lag, p, sentence: lag ? `Quando ${A.def.label.toLowerCase()} è più alta, ${B.def.label.toLowerCase()} il giorno dopo tende a essere ${r > 0 ? 'più alta' : 'più bassa'}` : `Nei giorni con ${A.def.label.toLowerCase()} più alta, ${B.def.label.toLowerCase()} tende a essere ${r > 0 ? 'più alta' : 'più bassa'}` });
    }
  }
  // elimina duplicati (stessa coppia, tiene il più forte) e ordina per forza × campione
  const best = new Map<string, Correlation>();
  out.forEach((c) => { const k = [c.a.id, c.b.id].sort().join('|'); const cur = best.get(k); if (!cur || Math.abs(c.r) > Math.abs(cur.r)) best.set(k, c); });
  return [...best.values()].sort((x, y) => Math.abs(y.r) * Math.sqrt(y.n) - Math.abs(x.r) * Math.sqrt(x.n)).slice(0, max);
}


/* ---------------- conferma nel tempo ---------------- */
export type CorrConfirmation = {
  status: 'confermata' | 'incerta' | 'non si ripete';
  first: number | null; second: number | null; nFirst: number; nSecond: number; text: string;
};
const sgnFmt = (v: number | null) => (v == null ? 'dati insufficienti' : `r = ${v.toFixed(2)}`);

/**
 * La correlazione si ripete? Divide le coppie di giorni in prima e seconda metà (cronologica) e ricalcola Pearson su ciascuna.
 * 'confermata' = stesso segno e |r| ≥ 0.3 in entrambe; 'non si ripete' = segno opposto o quasi zero in una metà; altrimenti 'incerta'.
 */
export function confirmCorrelation(a: Series, b: Series, lag: 0 | 1, minHalf = 6): CorrConfirmation {
  const mb = new Map(b.pts.map((p) => [p.d, p.v]));
  const pairs: { d: string; x: number; y: number }[] = [];
  a.pts.forEach((p) => { const v = mb.get(lag ? addDays(p.d, 1) : p.d); if (v != null) pairs.push({ d: p.d, x: p.v, y: v }); });
  pairs.sort((u, v) => u.d.localeCompare(v.d));
  const h = Math.floor(pairs.length / 2);
  const halves = [pairs.slice(0, h), pairs.slice(h)];
  const rs = halves.map((hv) => (hv.length >= minHalf ? pearson(hv.map((q) => q.x), hv.map((q) => q.y)) : null));
  const [r1, r2] = rs;
  const mk = (status: CorrConfirmation['status'], text: string): CorrConfirmation => ({ status, first: r1, second: r2, nFirst: halves[0].length, nSecond: halves[1].length, text });
  if (r1 == null || r2 == null || Number.isNaN(r1) || Number.isNaN(r2)) return mk('incerta', 'Troppo pochi giorni in una delle due metà del periodo per sapere se si ripete.');
  if (Math.sign(r1) === Math.sign(r2) && Math.abs(r1) >= 0.3 && Math.abs(r2) >= 0.3) return mk('confermata', `Si ripete nelle due metà del periodo (${sgnFmt(r1)} e ${sgnFmt(r2)}).`);
  if (Math.sign(r1) !== Math.sign(r2) && Math.max(Math.abs(r1), Math.abs(r2)) >= 0.3) return mk('non si ripete', `Nelle due metà del periodo va in direzioni opposte (${sgnFmt(r1)} e ${sgnFmt(r2)}): potrebbe essere un caso.`);
  if (Math.min(Math.abs(r1), Math.abs(r2)) < 0.15 && Math.max(Math.abs(r1), Math.abs(r2)) >= 0.3) return mk('non si ripete', `C’è solo in una metà del periodo (${sgnFmt(r1)} e ${sgnFmt(r2)}): non si ripete.`);
  return mk('incerta', `Legame più debole in almeno una metà (${sgnFmt(r1)} e ${sgnFmt(r2)}): servono più giorni.`);
}

/* ---------------- insight (business intelligence in italiano) ---------------- */
export type Insight = {
  id: string; severity: 'bad' | 'warn' | 'good' | 'info'; domain: Domain; title: string; detail: string; action?: string; metricId?: string; priority: number;
};

const fmt = (v: number, dec: number) => fmtNumber(v, { minimumFractionDigits: dec, maximumFractionDigits: dec });
const unitOf = (u: string) => (u === 'CHF' ? currentCurrency() : u);
export const fmtVal = (v: number, def: MetricDef) => `${fmt(v, def.dec)}${def.unit && def.unit !== '/100' && def.unit !== '%' ? ' ' + unitOf(def.unit) : def.unit === '%' ? '%' : ''}`;

const sevW = { bad: 3, warn: 2, info: 1, good: 1.2 } as const;

export function buildInsights(list: Analysis[], corrs: Correlation[], today: string, extra: Insight[] = []): Insight[] {
  const out: Insight[] = [...extra];
  const push = (i: Omit<Insight, 'priority'>, conf = 1, recency = 1) => out.push({ ...i, priority: sevW[i.severity] * conf * recency });

  for (const a of list) {
    const d = a.def;
    const conf = a.n >= 14 ? 1 : a.n >= 7 ? 0.8 : 0.55;
    const rec = a.ageDays <= 1 ? 1 : a.ageDays <= 3 ? 0.85 : 0.5;

    // 1. trend significativo
    if (a.significant && d.better !== 'none') {
      const good = (d.better === 'up' && a.trend === 'up') || (d.better === 'down' && a.trend === 'down');
      const verb = a.trend === 'up' ? 'in aumento' : 'in calo';
      const per = d.period === 'day' ? 'a settimana' : 'al mese';
      push({
        id: `trend-${d.id}`, severity: good ? 'good' : 'warn', domain: d.domain, metricId: d.id,
        title: `${d.label} ${verb}`,
        detail: `${Math.abs(a.slopePctWeek).toFixed(1)}% ${per} (trend statisticamente significativo su ${a.n} ${d.period === 'day' ? 'giorni' : 'mesi'}).${a.forecast ? ` Se prosegue, ${d.period === 'day' ? 'tra 7 giorni' : 'tra 3 mesi'} sarà intorno a ${fmtVal(a.forecast.end, d)}.` : ''}`,
        action: good ? 'Continua così.' : actionFor(d.id, 'worse'),
      }, conf, rec);
    }

    // 2. sotto/sopra l'obiettivo nella media degli ultimi 7 giorni
    if (d.period === 'day' && (d.target != null || d.range) && a.pts.length >= 3) {
      const att = attainment(d, a.avg7);
      if (att != null && att < 85) {
        const goalTxt = d.range ? `${d.range[0]}–${d.range[1]} ${d.unit}` : fmtVal(d.target!, d);
        push({
          id: `goal-${d.id}`, severity: att < 60 ? 'bad' : 'warn', domain: d.domain, metricId: d.id,
          title: `${d.label}: media 7 giorni ${fmtVal(a.avg7, d)}`,
          detail: `Obiettivo ${goalTxt}: ${a.goalRate7 != null ? `lo hai raggiunto ${Math.round(a.goalRate7 * 7)} giorni su 7` : 'sotto il target'}.`,
          action: actionFor(d.id, 'low'),
        }, conf, rec);
      }
      if (a.streak >= 5) push({ id: `streak-${d.id}`, severity: 'good', domain: d.domain, metricId: d.id, title: `${a.streak} giorni di fila: ${d.label.toLowerCase()} in obiettivo`, detail: 'Una serie costante è il miglior predittore di abitudini che durano.' }, 1, 1);
    }

    // 3. valori insoliti recenti
    const recentAn = a.anomalies.filter((p) => dayDiff(p.d, today) <= 3);
    if (recentAn.length && d.better !== 'none') {
      const p = recentAn[recentAn.length - 1];
      const dir = p.v > a.median ? 'più alto' : 'più basso';
      const bad = (d.better === 'up' && p.v < a.median) || (d.better === 'down' && p.v > a.median) || d.better === 'range';
      push({ id: `anom-${d.id}`, severity: bad ? 'warn' : 'info', domain: d.domain, metricId: d.id, title: `${d.label} insolito`, detail: `${fmtVal(p.v, d)} il ${p.d.slice(8)}/${p.d.slice(5, 7)}: ${dir} del tuo solito (${fmtVal(a.median, d)}).`, action: bad ? 'Se si ripete nei prossimi giorni, vale la pena capirne la causa.' : undefined }, conf, 1);
    }

    // 4. dati mancanti
    if (d.period === 'day' && a.ageDays >= 4 && a.n >= 5) push({ id: `gap-${d.id}`, severity: 'info', domain: d.domain, metricId: d.id, title: `Mancano dati di ${d.label.toLowerCase()}`, detail: `Ultima misura ${a.ageDays} giorni fa: l'analisi perde precisione.` }, 0.6, 1);
  }

  corrs.slice(0, 3).forEach((c, i) => out.push({
    id: `corr-${c.a.id}-${c.b.id}`, severity: 'info', domain: c.a.domain, title: 'Cosa influenza cosa',
    detail: `${c.sentence} (r = ${c.r.toFixed(2)}, ${c.n} giorni). È un legame statistico, non una prova di causa.`, priority: 1.1 - i * 0.1,
  }));

  // unico insight per metrica/tipo, ordinato; massimo 2 per dominio nei primi 6
  const seen = new Set<string>();
  const sorted = out.sort((x, y) => y.priority - x.priority).filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
  const perDomain: Record<string, number> = {};
  const picked: Insight[] = [], rest: Insight[] = [];
  sorted.forEach((i) => { perDomain[i.domain] = (perDomain[i.domain] || 0) + 1; (perDomain[i.domain] <= 2 && picked.length < 6 ? picked : rest).push(i); });
  return [...picked, ...rest];
}

function actionFor(id: string, kind: 'low' | 'worse'): string {
  const a: Record<string, [string, string]> = {
    sleep: ['Anticipa di 30 minuti l\'ora di andare a letto per tre sere.', 'Cerca di dormire a orari regolari e riduci gli schermi prima di coricarti.'],
    steps: ['Aggiungi una camminata di 15 minuti dopo pranzo.', 'Pianifica una camminata fissa nella tua giornata.'],
    hrv: ['Alleggerisci gli allenamenti intensi e dormi di più per qualche giorno.', 'Un HRV in calo indica meno recupero: riposo e sonno prima di spingere.'],
    hr: ['Controlla stress, sonno e caffeina nei prossimi giorni.', 'Un battito a riposo in salita può indicare stanchezza o poco recupero.'],
    stress: ['Prova 5 minuti di respirazione o mindfulness oggi.', 'Inserisci una pausa fissa a metà giornata.'],
    exercise: ['Punta a 30 minuti di movimento oggi, anche a blocchi da 10.', 'Rimetti in agenda i tuoi allenamenti.'],
    energy: ['Un po\' più di movimento durante la giornata.', 'Aumenta gradualmente l\'attività.'],
    mindful: ['Una sessione breve di mindfulness al giorno.', 'Ricomincia con 3 minuti di respirazione.'],
    weight: ['Controlla l\'apporto calorico e l\'attività della settimana.', 'Controlla l\'apporto calorico e l\'attività della settimana.'],
    spending: ['Guarda le categorie in aumento e fissa un tetto settimanale.', 'Rivedi le spese non essenziali di questo mese.'],
    savings: ['Automatizza un accantonamento appena arriva lo stipendio.', 'Riduci la categoria più cresciuta e sposta la differenza sul risparmio.'],
    balance: ['Rivedi le uscite ricorrenti.', 'Rivedi le uscite ricorrenti.'],
    tasks: ['Scegli le 3 attività più importanti di domani.', 'Spezza i task grandi in passaggi da 1 ora.'],
    mood: ['Annota cosa è cambiato negli ultimi giorni: sonno, impegni, persone.', 'Dedica del tempo a qualcosa che ti ricarica.'],
  };
  const key = Object.keys(a).find((k) => id.startsWith(k));
  return key ? a[key][kind === 'low' ? 0 : 1] : 'Tieni d\'occhio questo valore nei prossimi giorni.';
}

/* ---------------- punteggi di dominio ---------------- */
export function domainScore(list: Analysis[], domain: Domain): number | null {
  const sc = list.filter((a) => a.def.domain === domain).map((a) => attainment(a.def, a.def.period === 'day' ? a.avg7 : a.latest.v)).filter((v): v is number => v != null);
  return sc.length ? Math.round(mean(sc)) : null;
}

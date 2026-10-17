/**
 * Analisi di un titolo dai suoi prezzi giornalieri (modulo PURO, nessuna rete).
 * Tutto è calcolato dalle chiusure: andamento, indicatori tecnici, rischio, livelli, scenari.
 * Non sono previsioni né consigli: descrivono cosa è successo e quanto il titolo è stato variabile.
 */
const r2 = (n: number) => Math.round(n * 100) / 100;
const last = <T,>(xs: T[]) => xs[xs.length - 1];
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const stdev = (xs: number[]) => { if (xs.length < 2) return 0; const m = mean(xs); return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)); };

/** Media mobile semplice: serie della stessa lunghezza, `null` dove mancano dati. */
export function smaSeries(xs: number[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < xs.length; i++) { sum += xs[i]; if (i >= n) sum -= xs[i - n]; out.push(i >= n - 1 ? sum / n : null); }
  return out;
}
export function emaSeries(xs: number[], n: number): number[] {
  if (!xs.length) return [];
  const k = 2 / (n + 1);
  const out = [xs[0]];
  for (let i = 1; i < xs.length; i++) out.push(xs[i] * k + out[i - 1] * (1 - k));
  return out;
}
/** RSI di Wilder (0-100). */
export function rsi(xs: number[], n = 14): number | null {
  if (xs.length <= n) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) { const d = xs[i] - xs[i - 1]; if (d >= 0) gain += d; else loss -= d; }
  gain /= n; loss /= n;
  for (let i = n + 1; i < xs.length; i++) { const d = xs[i] - xs[i - 1]; gain = (gain * (n - 1) + Math.max(d, 0)) / n; loss = (loss * (n - 1) + Math.max(-d, 0)) / n; }
  if (loss === 0) return gain === 0 ? 50 : 100;
  return r2(100 - 100 / (1 + gain / loss));
}
export function macd(xs: number[]): { macd: number; signal: number; hist: number; histSeries: number[] } | null {
  if (xs.length < 35) return null;
  const e12 = emaSeries(xs, 12), e26 = emaSeries(xs, 26);
  const line = xs.map((_, i) => e12[i] - e26[i]);
  const sig = emaSeries(line, 9);
  const histSeries = line.map((v, i) => v - sig[i]);
  return { macd: last(line), signal: last(sig), hist: last(histSeries), histSeries };
}
export function bollinger(xs: number[], n = 20, k = 2): { mid: number; upper: number; lower: number; pctB: number; width: number } | null {
  if (xs.length < n) return null;
  const w = xs.slice(-n), mid = mean(w), sd = stdev(w);
  const upper = mid + k * sd, lower = mid - k * sd, p = last(xs);
  return { mid, upper, lower, pctB: upper > lower ? (p - lower) / (upper - lower) : 0.5, width: mid ? (upper - lower) / mid : 0 };
}
export const simpleReturns = (xs: number[]) => xs.slice(1).map((x, i) => (xs[i] > 0 ? x / xs[i] - 1 : 0));
export const logReturns = (xs: number[]) => xs.slice(1).map((x, i) => (xs[i] > 0 && x > 0 ? Math.log(x / xs[i]) : 0));
/** Rendimento su gli ultimi `n` giorni di borsa, in frazione (0.1 = +10%). */
export const periodReturn = (xs: number[], n: number): number | null => (xs.length > n && xs[xs.length - 1 - n] > 0 ? last(xs) / xs[xs.length - 1 - n] - 1 : null);
export const HORIZONS = [{ id: '1S', n: 5 }, { id: '1M', n: 21 }, { id: '3M', n: 63 }, { id: '6M', n: 126 }, { id: '1A', n: 252 }] as const;
/** Variabilità annua: quanto oscilla il prezzo (deviazione dei rendimenti giornalieri, annualizzata). */
export const annualVol = (xs: number[]) => stdev(logReturns(xs.slice(-253))) * Math.sqrt(252);
/** Peggior calo da un massimo a un minimo successivo (frazione negativa). */
export function maxDrawdown(xs: number[]): number {
  let peak = -Infinity, worst = 0;
  for (const x of xs) { peak = Math.max(peak, x); if (peak > 0) worst = Math.min(worst, x / peak - 1); }
  return worst;
}
export const currentDrawdown = (xs: number[]) => (xs.length ? last(xs) / Math.max(...xs) - 1 : 0);
/** Perdita giornaliera che nel 95% dei giorni non è stata superata (storica, frazione negativa). */
export function valueAtRisk(xs: number[], conf = 0.95): number {
  const r = simpleReturns(xs.slice(-253)).sort((a, b) => a - b);
  if (!r.length) return 0;
  return r[Math.max(0, Math.floor((1 - conf) * r.length))];
}
function alignedReturns(a: number[], b: number[]): [number[], number[]] {
  const n = Math.min(a.length, b.length, 253);
  return [simpleReturns(a.slice(-n)), simpleReturns(b.slice(-n))];
}
export function correlation(a: number[], b: number[]): number | null {
  const [x, y] = alignedReturns(a, b);
  if (x.length < 20) return null;
  const mx = mean(x), my = mean(y);
  let c = 0, vx = 0, vy = 0;
  for (let i = 0; i < x.length; i++) { c += (x[i] - mx) * (y[i] - my); vx += (x[i] - mx) ** 2; vy += (y[i] - my) ** 2; }
  return vx > 0 && vy > 0 ? c / Math.sqrt(vx * vy) : null;
}
/** Beta: di quanto si muove il titolo quando il mercato (benchmark) si muove dell'1%. */
export function beta(a: number[], bench: number[]): number | null {
  const [x, y] = alignedReturns(a, bench);
  if (x.length < 20) return null;
  const mx = mean(x), my = mean(y);
  let c = 0, vy = 0;
  for (let i = 0; i < x.length; i++) { c += (x[i] - mx) * (y[i] - my); vy += (y[i] - my) ** 2; }
  return vy > 0 ? c / vy : null;
}
export function range52(xs: number[]): { low: number; high: number; pos: number } {
  const w = xs.slice(-252), low = Math.min(...w), high = Math.max(...w);
  return { low, high, pos: high > low ? (last(xs) - low) / (high - low) : 0.5 };
}
/** Supporti (sotto il prezzo) e resistenze (sopra): massimi e minimi locali vicini tra loro, raggruppati. */
export function levels(xs: number[]): { supports: number[]; resistances: number[] } {
  const w = xs.slice(-160), p = last(xs), k = 4;
  const piv: number[] = [];
  for (let i = k; i < w.length - k; i++) {
    const seg = w.slice(i - k, i + k + 1);
    if (w[i] === Math.max(...seg) || w[i] === Math.min(...seg)) piv.push(w[i]);
  }
  const groups: { v: number; n: number }[] = [];
  for (const v of piv.sort((a, b) => a - b)) {
    const g = groups.find((x) => Math.abs(x.v - v) / v < 0.02);
    if (g) { g.v = (g.v * g.n + v) / (g.n + 1); g.n++; } else groups.push({ v, n: 1 });
  }
  const sup = groups.filter((g) => g.v < p).sort((a, b) => b.v - a.v).slice(0, 2).map((g) => r2(g.v));
  const res = groups.filter((g) => g.v > p).sort((a, b) => a.v - b.v).slice(0, 2).map((g) => r2(g.v));
  return { supports: sup, resistances: res };
}

export type Trend = 'rialzista' | 'ribassista' | 'laterale';
export function trend(xs: number[]): { trend: Trend; strength: number; cross: 'golden' | 'death' | null } {
  const s50 = smaSeries(xs, 50), s200 = smaSeries(xs, 200), p = last(xs);
  const a = last(s50), b = last(s200);
  let score = 0;
  if (a !== null && a !== undefined) score += p > a ? 1 : -1;
  if (b !== null && b !== undefined) score += p > b ? 1 : -1;
  if (a != null && b != null) score += a > b ? 1 : -1;
  const m = periodReturn(xs, 21);
  if (m !== null) score += m > 0.02 ? 1 : m < -0.02 ? -1 : 0;
  let cross: 'golden' | 'death' | null = null;
  if (s50.length > 20 && s200.length > 20) {
    for (let i = xs.length - 20; i < xs.length; i++) {
      const x0 = s50[i - 1], y0 = s200[i - 1], x1 = s50[i], y1 = s200[i];
      if (x0 != null && y0 != null && x1 != null && y1 != null) { if (x0 <= y0 && x1 > y1) cross = 'golden'; if (x0 >= y0 && x1 < y1) cross = 'death'; }
    }
  }
  return { trend: score >= 2 ? 'rialzista' : score <= -2 ? 'ribassista' : 'laterale', strength: Math.min(1, Math.abs(score) / 4), cross };
}
export type RiskLevel = 'basso' | 'medio' | 'alto' | 'molto alto';
export const riskLevel = (vol: number): RiskLevel => (vol < 0.15 ? 'basso' : vol < 0.28 ? 'medio' : vol < 0.45 ? 'alto' : 'molto alto');

/** Fascia statistica dei prezzi a `days` giorni, senza ipotesi di rendimento: solo la variabilità storica. */
export function projectRange(price: number, sigmaAnnual: number, days: number): { low: number; mid: number; high: number } {
  const t = days / 252, s = sigmaAnnual * Math.sqrt(t), drift = -0.5 * sigmaAnnual * sigmaAnnual * t;
  return { low: r2(price * Math.exp(drift - 1.2816 * s)), mid: r2(price * Math.exp(drift)), high: r2(price * Math.exp(drift + 1.2816 * s)) };
}
/** Quante quote comprare perché, se il prezzo tocca lo stop, si perda al massimo `riskPct`% del capitale. */
export function positionSize(o: { capital: number; riskPct: number; entry: number; stop: number }): { units: number; cost: number; maxLoss: number; capped: boolean; error?: string } {
  const { capital, riskPct, entry, stop } = o;
  if (!(capital > 0) || !(riskPct > 0) || !(entry > 0)) return { units: 0, cost: 0, maxLoss: 0, capped: false, error: 'Inserisci capitale, rischio e prezzo' };
  if (!(stop > 0) || stop >= entry) return { units: 0, cost: 0, maxLoss: 0, capped: false, error: 'Lo stop deve essere sotto il prezzo di acquisto' };
  let units = (capital * (riskPct / 100)) / (entry - stop), capped = false;
  if (units * entry > capital) { units = capital / entry; capped = true; }
  return { units: Math.floor(units * 1e4) / 1e4, cost: r2(units * entry), maxLoss: r2(units * (entry - stop)), capped };
}
/** Serie riportate a 100 alla prima data comune, per confrontare due titoli. */
export function rebase(xs: number[], n: number): number[] { const w = xs.slice(-n); return w.length && w[0] > 0 ? w.map((x) => (x / w[0]) * 100) : []; }

export type Signal = { id: string; tone: 'pos' | 'neg' | 'neu'; title: string; text: string };
/** Le osservazioni principali, in italiano semplice. */
export function signals(xs: number[], bench?: number[]): Signal[] {
  const out: Signal[] = [];
  if (xs.length < 30) return out;
  const p = last(xs), tr = trend(xs);
  out.push({ id: 'trend', tone: tr.trend === 'rialzista' ? 'pos' : tr.trend === 'ribassista' ? 'neg' : 'neu', title: `Andamento ${tr.trend}`, text: tr.trend === 'rialzista' ? 'Il prezzo sta sopra le sue medie degli ultimi mesi: la tendenza recente è al rialzo.' : tr.trend === 'ribassista' ? 'Il prezzo sta sotto le sue medie degli ultimi mesi: la tendenza recente è al ribasso.' : 'Il prezzo oscilla vicino alle sue medie: non c’è una direzione netta.' });
  if (tr.cross) out.push({ id: 'cross', tone: tr.cross === 'golden' ? 'pos' : 'neg', title: tr.cross === 'golden' ? 'Incrocio rialzista delle medie' : 'Incrocio ribassista delle medie', text: tr.cross === 'golden' ? 'Nelle ultime settimane la media a 50 giorni ha superato quella a 200: di solito segnala un cambio di tendenza verso l’alto.' : 'Nelle ultime settimane la media a 50 giorni è scesa sotto quella a 200: di solito segnala un indebolimento.' });
  const r = rsi(xs);
  if (r !== null) out.push({ id: 'rsi', tone: r >= 70 ? 'neg' : r <= 30 ? 'pos' : 'neu', title: `RSI ${r.toFixed(0)}`, text: r >= 70 ? 'Il titolo è salito molto e in fretta: viene detto «ipercomprato», può rallentare o ritracciare.' : r <= 30 ? 'Il titolo è sceso molto e in fretta: viene detto «ipervenduto», può rimbalzare (o continuare a scendere).' : 'Lo slancio è nella norma, né eccessivo né debole.' });
  const m = macd(xs);
  if (m) out.push({ id: 'macd', tone: m.hist > 0 ? 'pos' : 'neg', title: m.hist > 0 ? 'Slancio in aumento' : 'Slancio in calo', text: m.hist > 0 ? 'Il MACD è sopra la sua linea di segnale: la spinta recente è positiva.' : 'Il MACD è sotto la sua linea di segnale: la spinta recente è negativa.' });
  const b = bollinger(xs);
  if (b) out.push({ id: 'boll', tone: b.pctB > 1 ? 'neg' : b.pctB < 0 ? 'pos' : 'neu', title: b.pctB > 1 ? 'Sopra la banda alta' : b.pctB < 0 ? 'Sotto la banda bassa' : 'Dentro le bande', text: b.pctB > 1 ? 'Il prezzo è fuori dalla sua fascia abituale, verso l’alto: movimento insolito.' : b.pctB < 0 ? 'Il prezzo è fuori dalla sua fascia abituale, verso il basso: movimento insolito.' : 'Il prezzo è dentro la sua fascia abituale di oscillazione.' });
  const rg = range52(xs);
  out.push({ id: 'range', tone: rg.pos > 0.9 ? 'neu' : rg.pos < 0.15 ? 'neu' : 'neu', title: `A ${Math.round(rg.pos * 100)}% della fascia annua`, text: `Nell’ultimo anno il prezzo è stato tra ${r2(rg.low)} e ${r2(rg.high)} (in dollari): oggi è ${p >= rg.high * 0.98 ? 'vicino al massimo' : p <= rg.low * 1.02 ? 'vicino al minimo' : 'a metà strada'}.` });
  const v = annualVol(xs), lvl = riskLevel(v);
  out.push({ id: 'vol', tone: lvl === 'basso' ? 'pos' : lvl === 'medio' ? 'neu' : 'neg', title: `Rischio ${lvl}`, text: `In un anno il prezzo ha oscillato di circa ±${(v * 100).toFixed(0)}%. ${lvl === 'alto' || lvl === 'molto alto' ? 'Sono oscillazioni ampie: puoi vedere cali forti anche in poche settimane.' : 'Oscillazioni nella norma per questo tipo di titolo.'}` });
  const dd = maxDrawdown(xs.slice(-253));
  out.push({ id: 'dd', tone: dd < -0.35 ? 'neg' : 'neu', title: `Calo massimo ${(dd * 100).toFixed(0)}%`, text: `Nell’ultimo anno il peggior calo da un massimo è stato del ${Math.abs(dd * 100).toFixed(0)}%: è la perdita che avresti visto comprando al punto peggiore.` });
  if (bench) { const be = beta(xs, bench); if (be !== null) out.push({ id: 'beta', tone: 'neu', title: `Beta ${be.toFixed(2)}`, text: be > 1.15 ? 'Tende ad amplificare i movimenti del mercato: sale e scende più dell’indice.' : be < 0.85 ? 'Tende ad attenuare i movimenti del mercato: oscilla meno dell’indice.' : 'Si muove più o meno come il mercato.' }); }
  return out;
}

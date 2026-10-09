/**
 * Recap finanziario: analisi dei movimenti + frasi chiare sulla situazione (nessuna AI, nessuna promessa).
 * Modulo PURO e testabile: riceve i mesi (dal più recente) e restituisce numeri per i grafici e testo.
 * Convenzioni: "uscite" = spese del mese ESCLUSO l'accantonamento al fondo emergenza (che è risparmio);
 * "risparmio" = entrate - uscite; "saldo" = saldo del conto a fine mese (include gli accantonamenti).
 */
import { t, translateText } from '../i18n/core.ts';
import { formatMoney } from '../i18n/format.ts';

export type RMov = { label: string; amount: number };
export type RMonth = { label: string; start: number; locked: boolean; movements: RMov[] };
export type RAlert = { category: string; level: 'over' | 'near'; pct: number };
export type RecapInput = {
  /** dal più recente al più vecchio */
  months: RMonth[];
  catOf: (label: string) => string;
  catColors?: Record<string, string>;
  /** equivalente mensile di bollette e abbonamenti registrati */
  billsMonthly: number;
  /** totale accantonato nel fondo emergenza */
  efTotal: number;
  alerts: RAlert[];
  /** giorno del mese corrente e giorni totali (per il mese in corso) */
  day: number;
  daysInMonth: number;
  efName?: string;
};

export type MonthStat = { label: string; short: string; income: number; expense: number; saved: number; ef: number; net: number; end: number; byCat: Record<string, number>; locked: boolean };
export type CatPart = { n: string; v: number; p: number; c: string };
export type TopItem = { n: string; v: number; prev: number; delta: number; pctOfTotal: number; trend: 'up' | 'down' | 'flat'; c: string };
export type Analysis = {
  series: MonthStat[];            // cronologico, ultimi 6
  cur: MonthStat | null;
  prev: MonthStat | null;
  partial: boolean;               // il mese corrente non è finito
  rate: number | null;            // tasso di risparmio % del mese corrente (null senza entrate)
  basis: MonthStat | null;        // mese su cui poggiano donut e classifica
  basisIsCurrent: boolean;
  donut: CatPart[];
  top: TopItem[];
  balance: number[];              // saldi di fine mese (cronologico)
  forecast: number[];             // 3 mesi successivi
  forecastStep: number;           // variazione mensile ipotizzata
  projection: { income: number; outflow: number; end: number } | null;
  efMonths: number | null;
  fixedPct: number | null;        // % delle entrate
  hasEnough: { compare: boolean; trend: boolean };
};

const SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const FULL = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
export const shortMonth = (label: string) => { const i = FULL.indexOf(label.split(' ')[0]); return i >= 0 ? SHORT[i] : label.slice(0, 3); };
/** "Ottobre 2026" -> { y: 2026, m: 9 } (m da 0); null se non riconosciuto. */
export function parseMonthLabel(label: string): { y: number; m: number } | null {
  const [n, y] = label.split(' ');
  const m = FULL.indexOf(n);
  return m < 0 || !Number(y) ? null : { y: Number(y), m };
}
const r1 = (n: number) => Math.round(n * 10) / 10;
const pctOf = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

const EF = 'Fondo emergenza';

export function monthStat(m: RMonth, catOf: (l: string) => string): MonthStat {
  let income = 0, expense = 0, ef = 0;
  const byCat: Record<string, number> = {};
  for (const x of m.movements) {
    if (x.amount > 0) { income += x.amount; continue; }
    const c = catOf(x.label);
    if (c === EF) { ef -= x.amount; continue; }
    expense -= x.amount; byCat[c] = (byCat[c] ?? 0) - x.amount;
  }
  const net = income - expense - ef;
  return { label: m.label, short: shortMonth(m.label), income, expense, saved: income - expense, ef, net, end: m.start + net, byCat, locked: m.locked };
}

/** Le categorie sotto la soglia (default 4%) confluiscono in "Altro" (insieme all'eventuale "Altro" già presente). */
export function groupCategories(byCat: Record<string, number>, colors: Record<string, string> = {}, minPct = 4, maxSlices = 6): CatPart[] {
  const total = Object.values(byCat).reduce((s, v) => s + v, 0);
  if (total <= 0) return [];
  const all = Object.entries(byCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const keep: [string, number][] = [];
  let other = 0;
  for (const [n, v] of all) {
    if (n === 'Altro') { other += v; continue; }
    if (keep.length < maxSlices - 1 && pctOf(v, total) >= minPct) keep.push([n, v]); else other += v;
  }
  if (other > 0) keep.push(['Altro', other]);
  keep.sort((a, b) => (a[0] === 'Altro' ? 1 : b[0] === 'Altro' ? -1 : b[1] - a[1]));
  return keep.map(([n, v]) => ({ n, v, p: r1(pctOf(v, total)), c: colors[n] ?? '#8e98a8' }));
}

export function analyze(inp: RecapInput): Analysis {
  const stats = inp.months.map((m) => monthStat(m, inp.catOf));
  const cur = stats[0] ?? null, prev = stats[1] ?? null;
  const partial = !!cur && !cur.locked && inp.day < inp.daysInMonth;
  const frac = Math.min(1, Math.max(0.03, inp.day / Math.max(1, inp.daysInMonth)));
  const series = stats.slice(0, 6).reverse();
  const colors = inp.catColors ?? {};

  const rate = cur && cur.income > 0 ? r1((cur.saved / cur.income) * 100) : null;

  // base di donut e classifica: mese corrente se abbastanza avanzato (o se non c'è altro), altrimenti l'ultimo chiuso
  const basisIsCurrent = !!cur && (!prev || inp.day >= 15 || cur.expense > 0 && inp.day >= 10);
  const basis = basisIsCurrent ? cur : prev ?? cur;
  const cmp = basisIsCurrent ? prev : stats[2] ?? null;
  const donut = basis ? groupCategories(basis.byCat, colors) : [];
  const totalB = basis ? basis.expense : 0;
  const bPartial = basisIsCurrent && partial;
  const top: TopItem[] = basis
    ? Object.entries(basis.byCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, v]) => {
      const pv = cmp?.byCat[n] ?? 0;
      const delta = v - pv;
      const rel = pv > 0 ? delta / pv : v > 0 ? 1 : 0;
      let trend: TopItem['trend'] = Math.abs(rel) < 0.05 ? 'flat' : rel > 0 ? 'up' : 'down';
      if (bPartial && trend === 'down') trend = 'flat'; // mese non finito: non si può dire che sia sceso
      return { n, v, prev: pv, delta, pctOfTotal: r1(pctOf(v, totalB)), trend, c: colors[n] ?? '#8e98a8' };
    })
    : [];

  // saldo e proiezione a 3 mesi
  const balance = series.map((s) => s.end);
  const closed = stats.filter((s) => s.locked).slice(0, 3);
  const base = closed.length ? closed : cur ? [cur] : [];
  const forecastStep = base.length ? base.reduce((s, x) => s + x.net, 0) / base.length : 0;
  const last = balance.length ? balance[balance.length - 1] : 0;
  const forecast = balance.length >= 2 ? [1, 2, 3].map((k) => Math.round(last + forecastStep * k)) : [];

  // stima di fine mese
  let projection: Analysis['projection'] = null;
  if (cur) {
    const outSoFar = cur.expense + cur.ef;
    if (!partial) projection = { income: cur.income, outflow: outSoFar, end: cur.end };
    else {
      const prevs = stats.slice(1, 3);
      const avgIn = prevs.length ? prevs.reduce((s, x) => s + x.income, 0) / prevs.length : 0;
      const avgOut = prevs.length ? prevs.reduce((s, x) => s + x.expense + x.ef, 0) / prevs.length : 0;
      const income = Math.max(cur.income, avgIn);
      const outflow = prevs.length ? Math.max(outSoFar, avgOut) : outSoFar / frac;
      projection = { income: Math.round(income), outflow: Math.round(outflow), end: Math.round(inp.months[0].start + income - outflow) };
    }
  }

  const avgExp = (() => { const l = stats.filter((s) => s.expense > 0).slice(0, 3); return l.length ? l.reduce((s, x) => s + x.expense, 0) / l.length : 0; })();
  const efMonths = inp.efTotal > 0 && avgExp > 0 ? r1(inp.efTotal / avgExp) : null;
  const incomeRef = cur && cur.income > 0 ? cur.income : prev && prev.income > 0 ? prev.income : 0;
  const fixedPct = inp.billsMonthly > 0 && incomeRef > 0 ? Math.round((inp.billsMonthly / incomeRef) * 100) : null;

  return {
    series, cur, prev, partial, rate, basis, basisIsCurrent, donut, top, balance, forecast, forecastStep, projection, efMonths, fixedPct,
    hasEnough: { compare: series.length >= 2, trend: series.length >= 2 },
  };
}

/** Giudizio prudente sul tasso di risparmio (indicativo, non consulenza). */
export function rateZone(rate: number | null): 'neg' | 'low' | 'ok' | 'good' | null {
  if (rate == null) return null;
  return rate < 0 ? 'neg' : rate < 10 ? 'low' : rate < 20 ? 'ok' : 'good';
}

export type RecapAction = { id: string; label: string; kind: 'category' | 'alerts' | 'bills' | 'ef' | 'movements' | 'import'; category?: string };
export type Recap = { sentences: string[]; actions: RecapAction[]; empty: boolean };

const money = (n: number) => formatMoney(Math.round(n));
const catName = (n: string) => translateText(n);

export function buildRecap(a: Analysis, inp: RecapInput): Recap {
  const cur = a.cur;
  if (!cur || (cur.income === 0 && cur.expense === 0 && (!a.prev || (a.prev.income === 0 && a.prev.expense === 0)))) {
    return { sentences: [t('Non ci sono ancora movimenti da raccontare: aggiungine qualcuno o importa l\'estratto conto e qui comparirà un riepilogo scritto.')], actions: [{ id: 'import', label: t('Importa movimenti'), kind: 'import' }], empty: true };
  }
  const out: string[] = [];
  const actions: RecapAction[] = [];

  // 1) entrate/uscite/risparmio + confronto
  if (cur.saved >= 0) out.push(t(a.partial ? 'Finora questo mese hai incassato {0} e speso {1}: ti restano {2} messi da parte.' : 'Questo mese hai incassato {0} e speso {1}: hai messo da parte {2}.', money(cur.income), money(cur.expense), money(cur.saved)));
  else out.push(t(a.partial ? 'Finora questo mese hai incassato {0} e speso {1}: le uscite superano le entrate di {2}.' : 'Questo mese hai incassato {0} e speso {1}: le uscite superano le entrate di {2}.', money(cur.income), money(cur.expense), money(-cur.saved)));
  if (a.prev) {
    if (a.partial) out[0] += ' ' + t('Il mese scorso, a mese concluso, avevi incassato {0} e speso {1}.', money(a.prev.income), money(a.prev.expense));
    else if (a.prev.expense > 0) {
      const d = Math.round(((cur.expense - a.prev.expense) / a.prev.expense) * 100);
      out[0] += ' ' + (Math.abs(d) < 3 ? t('Le uscite sono in linea con il mese scorso.') : d > 0 ? t('Rispetto al mese scorso le uscite sono più alte del {0}%.', d) : t('Rispetto al mese scorso le uscite sono più basse del {0}%.', -d));
    }
  }

  // 2) tasso di risparmio
  const z = rateZone(a.rate);
  if (a.rate != null && z) {
    const r = Math.round(a.rate);
    out.push(z === 'neg' ? t('Il tasso di risparmio è negativo ({0}%): per ora spendi più di quanto entra, e il saldo ne risente.', r)
      : z === 'low' ? t('Il tasso di risparmio è del {0}%, piuttosto basso: come riferimento generale (non una regola) si indica spesso almeno il 10-20%.', r)
      : z === 'ok' ? t('Il tasso di risparmio è del {0}%, in linea con i riferimenti generali del 10-20%.', r)
      : t('Il tasso di risparmio è del {0}%, sopra i riferimenti generali: una base solida, da mantenere se ti è sostenibile.', r));
  }

  // 3) categoria che pesa di più
  const topItem = a.top[0];
  if (topItem && a.basis) {
    let s = t('{0} è la voce che pesa di più: {1}, il {2}% delle uscite.', catName(topItem.n), money(topItem.v), Math.round(topItem.pctOfTotal));
    if (!a.basisIsCurrent) s = t('Nell\'ultimo mese chiuso {0} è stata la voce che ha pesato di più: {1}, il {2}% delle uscite.', catName(topItem.n), money(topItem.v), Math.round(topItem.pctOfTotal));
    out.push(s);
    // azione: apri la categoria con la voce più mossa (se diversa) altrimenti la prima
    const mover = a.top.find((x) => x.trend === 'up' && x.prev > 0) ?? topItem;
    actions.push({ id: 'cat', label: t('Guarda {0}', catName(mover.n)), kind: 'category', category: mover.n });
  }

  // 4) bollette e abbonamenti fissi
  if (inp.billsMonthly > 0) {
    out.push(a.fixedPct != null
      ? t('Bollette e abbonamenti fissi valgono circa {0} al mese, il {1}% delle entrate.', money(inp.billsMonthly), a.fixedPct)
      : t('Bollette e abbonamenti fissi valgono circa {0} al mese.', money(inp.billsMonthly)));
    if (actions.length < 2 && a.fixedPct != null && a.fixedPct >= 50) actions.push({ id: 'bills', label: t('Rivedi bollette e abbonamenti'), kind: 'bills' });
  }

  // 5) fondo di emergenza
  if (a.efMonths != null) {
    const m = a.efMonths;
    const base = m < 0.95
      ? t('Il fondo di emergenza ({0}) copre meno di 1 mese di spese.', money(inp.efTotal))
      : m < 1.5
      ? t('Il fondo di emergenza ({0}) copre circa 1 mese di spese.', money(inp.efTotal))
      : t('Il fondo di emergenza ({0}) copre circa {1} mesi di spese.', money(inp.efTotal), (Math.round(m * 10) / 10).toString().replace('.', ','));
    out.push(m < 3 ? base + ' ' + t('Come riferimento generale si indicano spesso 3-6 mesi.') : base);
  } else if (inp.efTotal === 0) {
    out.push(t('Non risulta ancora un accantonamento nel fondo di emergenza.'));
  }

  // 6) proiezione + avvisi
  let last = '';
  if (a.partial && a.projection) last = t('Se il ritmo resta questo, a fine mese il saldo sarà intorno a {0} (è una stima, non una previsione certa).', money(a.projection.end));
  if (inp.alerts.length) {
    const over = inp.alerts.filter((x) => x.level === 'over').length;
    const al = over > 0
      ? (over === 1 ? t('C\'è 1 avviso di budget: una categoria ha superato il limite.') : t('Ci sono {0} avvisi di budget: alcune categorie hanno superato il limite.', over))
      : (inp.alerts.length === 1 ? t('C\'è 1 avviso di budget: una categoria si avvicina al limite.') : t('Ci sono {0} avvisi di budget: alcune categorie si avvicinano al limite.', inp.alerts.length));
    last = last ? last + ' ' + al : al;
    actions.unshift({ id: 'alerts', label: t('Apri gli avvisi di budget'), kind: 'alerts' });
  }
  if (last) out.push(last);

  return { sentences: out.slice(0, 6), actions: actions.slice(0, 2), empty: false };
}

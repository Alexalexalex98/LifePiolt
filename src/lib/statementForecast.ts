/**
 * Storico e previsioni dall'estratto conto (modulo PURO e testabile). Si lavora SOLO sui dati:
 *  - tutte le entrate contano; quelle ricorrenti (stessa fonte, mesi diversi) si distinguono dalle occasionali;
 *  - per ogni mese: entrate, spese fisse, spese variabili, pagamenti straordinari;
 *  - previsione dei prossimi mesi = cio' che e' ricorrente + la media recente del resto, con un intervallo preso dalla variabilita' vera dello storico.
 */
import { analyzeStatement, payeeKey, type Row, type SalaryRule, DEFAULT_RULE } from './statementAnalysis.ts';

const r2 = (n: number) => Math.round(n * 100) / 100;
const median = (a: number[]) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const ymLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const nextYm = (ym: string, n = 1) => { const t = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };

export type MonthHist = { ym: string; label: string; income: number; recurringIncome: number; occasionalIncome: number; fixed: number; variable: number; extraordinary: number; net: number; complete: boolean };
export type Projection = { ym: string; label: string; income: number; fixed: number; variable: number; net: number; low: number; high: number };
export type Forecast = {
  history: MonthHist[]; avgIncome: number; recurringMonthly: number; occasionalMonthly: number;
  next: Projection[]; extraordinaryPerMonth: number; extraordinaryCount: number;
  alerts: string[]; scenarios: { title: string; net: number; why: string }[]; reliability: 'bassa' | 'media' | 'buona';
};

export function buildForecast(rows: Row[], rule: SalaryRule = DEFAULT_RULE, excluded: string[] = [], today = new Date()): Forecast | null {
  if (rows.length < 5) return null;
  const an = analyzeStatement(rows, rule, excluded);
  if (!an) return null;
  const fixedKeys = new Set(an.fixed.map((f) => f.key));
  const recKeys = new Set(an.salary.sources.map((s) => s.key));
  const exKey = new Set(an.extraordinary.map((e) => `${e.date}|${e.amount}`));
  const byYm = new Map<string, MonthHist>();
  const get = (ym: string) => byYm.get(ym) ?? (byYm.set(ym, { ym, label: ymLabel(ym), income: 0, recurringIncome: 0, occasionalIncome: 0, fixed: 0, variable: 0, extraordinary: 0, net: 0, complete: true }), byYm.get(ym)!);
  for (const r of rows) {
    const m = get(r.date.slice(0, 7)); const k = payeeKey(r.label);
    if (r.amount > 0) { m.income += r.amount; if (recKeys.has(k)) m.recurringIncome += r.amount; else m.occasionalIncome += r.amount; }
    else if (fixedKeys.has(k)) m.fixed -= r.amount;
    else if (exKey.has(`${r.date}|${r.amount}`)) m.extraordinary -= r.amount;
    else m.variable -= r.amount;
  }
  const todayYm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const hist = [...byYm.values()].sort((a, b) => a.ym.localeCompare(b.ym)).map((m) => ({ ...m, income: r2(m.income), recurringIncome: r2(m.recurringIncome), occasionalIncome: r2(m.occasionalIncome), fixed: r2(m.fixed), variable: r2(m.variable), extraordinary: r2(m.extraordinary), net: r2(m.income - m.fixed - m.variable - m.extraordinary), complete: m.ym < todayYm }));
  const full = hist.filter((m) => m.complete);
  const base = full.length >= 3 ? full : hist;
  const recent = base.slice(-6);
  const income = median(recent.map((m) => m.income));
  const recurringMonthly = r2(an.salary.monthly);
  const occasionalMonthly = r2(median(recent.map((m) => m.occasionalIncome)));
  const fixed = r2(an.fixed.reduce((s, f) => s + f.monthly, 0));
  const variable = r2(median(recent.map((m) => m.variable)));
  const nets = recent.map((m) => m.income - m.fixed - m.variable); // senza i pagamenti straordinari
  const spread = nets.length > 1 ? Math.max(...nets) - Math.min(...nets) : Math.abs(income) * 0.3;
  const last = hist[hist.length - 1];
  const start = last.complete ? nextYm(last.ym) : last.ym;
  const next: Projection[] = [0, 1, 2].map((i) => { const ym = nextYm(start, i); const inc = r2(recurringMonthly + occasionalMonthly); const net = r2(inc - fixed - variable); return { ym, label: ymLabel(ym), income: inc, fixed, variable, net, low: r2(net - spread / 2), high: r2(net + spread / 2) }; });
  const extraTotal = an.extraordinary.reduce((s, e) => s - e.amount, 0);
  const extraordinaryPerMonth = r2(extraTotal / Math.max(1, hist.length));
  const alerts: string[] = [];
  if (fixed > recurringMonthly && recurringMonthly > 0) alerts.push(`Le spese fisse (${Math.round(fixed)}) superano le entrate ricorrenti (${Math.round(recurringMonthly)}): ogni mese serve il resto delle entrate occasionali per coprirle.`);
  const neg = full.filter((m) => m.income - m.fixed - m.variable < 0).length;
  if (full.length >= 3 && neg >= 2) alerts.push(`In ${neg} mesi su ${full.length} le uscite (senza i pagamenti straordinari) hanno superato le entrate.`);
  if (an.extraordinary.length >= 2) alerts.push(`${an.extraordinary.length} pagamenti straordinari in ${hist.length} mesi (${Math.round(extraTotal)} CHF in tutto, circa ${Math.round(extraordinaryPerMonth)} al mese): non sono previsti nei mesi qui sotto ma si sono ripetuti.`);
  const v3 = median(base.slice(-3).map((m) => m.variable)), v6 = median(base.slice(-6, -3).map((m) => m.variable));
  if (base.length >= 6 && v6 > 0 && v3 > v6 * 1.2) alerts.push(`Le spese variabili sono salite: ${Math.round(v3)} negli ultimi 3 mesi contro ${Math.round(v6)} nei 3 prima.`);
  const main = an.salary.sources[0];
  const scenarios: Forecast['scenarios'] = [];
  const baseNet = next[0].net;
  if (main) scenarios.push({ title: `Se ${main.name} non arriva un mese`, net: r2(baseNet - main.monthly), why: `Tolgo ${Math.round(main.monthly)} CHF di entrata ricorrente dal mese previsto.` });
  if (an.extraordinary.length) scenarios.push({ title: 'Se si ripete un pagamento straordinario', net: r2(baseNet - median(an.extraordinary.map((e) => -e.amount))), why: `Tolgo ${Math.round(median(an.extraordinary.map((e) => -e.amount)))} CHF, la mediana di quelli già visti.` });
  const reliability = full.length >= 6 ? 'buona' : full.length >= 3 ? 'media' : 'bassa';
  return { history: hist, avgIncome: r2(income), recurringMonthly, occasionalMonthly, next, extraordinaryPerMonth, extraordinaryCount: an.extraordinary.length, alerts, scenarios, reliability };
}

/**
 * Analisi di un estratto conto, tutta dai movimenti (modulo PURO e testabile):
 *  - stipendio: il mese di stipendio X va dal giorno `from` di X al giorno `to` del mese dopo (es. 20 settembre - 10 ottobre = «settembre»);
 *  - spese fisse: quelle che tornano mese dopo mese (affitto, cassa malati, mutuo, prestiti, assicurazioni, telefono, abbonamenti): non i biglietti singoli;
 *  - spese variabili per categoria (cibo...) come media mensile, e pagamenti straordinari a parte (non fanno media).
 */
import { normalizeLabel } from './recurring.ts';

export type Row = { date: string; label: string; amount: number };
export type SalaryRule = { from: number; to: number };
export const DEFAULT_RULE: SalaryRule = { from: 20, to: 10 };

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const strip = (label: string) => label.replace(/^[^·]{1,30}·\s*/, '').trim();
export const payeeKey = (label: string) => normalizeLabel(strip(label).replace(/^(pagamento istantaneo|pagamento estero|pagamento|acquisto online|acquisto|addebito diretto|ordine permanente|lsv|accredito|bonifico|gutschrift|zahlung)\s+/i, ''));
const median = (a: number[]) => { const s = a.slice().sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r2 = (n: number) => Math.round(n * 100) / 100;
const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/* ------------------------------------------------------------------ stipendio */
export const salaryMonthOf = (iso: string, rule: SalaryRule): string | null => {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)), d = Number(iso.slice(8, 10));
  if (d >= rule.from) return `${y}-${String(m).padStart(2, '0')}`;
  if (d <= rule.to) { const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y; return `${py}-${String(pm).padStart(2, '0')}`; }
  return null;
};
export const salaryMonthLabel = (ym: string, rule: SalaryRule) => {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  const nm = m === 12 ? 1 : m + 1;
  const dd = (n: number) => String(n).padStart(2, '0');
  return `${MONTHS[m - 1]} ${y} (${dd(rule.from)}.${dd(m)} – ${dd(rule.to)}.${dd(nm)})`;
};

const NOT_SALARY = /deposito|bancomat|prelievo|giroconto|storno|rimborso|rettifica|einzahlung|bezug|twint|stornierung/i;
export type SalaryPart = { name: string; key: string; amount: number };
export type SalaryMonth = { ym: string; label: string; sum: number; parts: SalaryPart[]; used?: boolean };
/** Come si calcola la cifra mensile: su quanti mesi (0 = tutti) e con quale media (mediana = non si fa tirare da un mese strano). */
export type AvgRule = { window: number; method: 'median' | 'mean' };
export const DEFAULT_AVG: AvgRule = { window: 0, method: 'median' };
export type SalaryResult = { monthly: number; used: number; method: AvgRule['method']; months: SalaryMonth[]; sources: { name: string; key: string; monthly: number; months: number }[] };

/** Le entrate che tornano (almeno 3 mesi di stipendio diversi), sommate mese per mese nella finestra scelta. */
export function analyzeSalary(rows: Row[], rule: SalaryRule = DEFAULT_RULE, excluded: string[] = [], avg: AvgRule = DEFAULT_AVG): SalaryResult {
  const credits = rows.filter((r) => r.amount > 0 && !NOT_SALARY.test(r.label));
  const per = new Map<string, Map<string, { name: string; amount: number }>>(); // key -> ym -> {name, amount}
  for (const r of credits) {
    const ym = salaryMonthOf(r.date, rule); if (!ym) continue;
    const k = payeeKey(r.label); if (k.length < 3 || excluded.includes(k)) continue;
    const g = per.get(k) ?? new Map(); const cur = g.get(ym);
    g.set(ym, { name: cur?.name ?? titleCase(k).slice(0, 40), amount: (cur?.amount ?? 0) + r.amount }); per.set(k, g);
  }
  const keep = [...per.entries()].filter(([, g]) => g.size >= 3);
  const byMonth = new Map<string, SalaryPart[]>();
  const sources = keep.map(([k, g]) => {
    for (const [ym, v] of g) byMonth.set(ym, [...(byMonth.get(ym) ?? []), { name: v.name, key: k, amount: r2(v.amount) }]);
    return { name: [...g.values()][0].name, key: k, monthly: r2(median([...g.values()].map((v) => v.amount))), months: g.size };
  }).sort((a, b) => b.monthly * b.months - a.monthly * a.months);
  const all = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([ym, parts]) => ({ ym, label: salaryMonthLabel(ym, rule), sum: r2(parts.reduce((s, p) => s + p.amount, 0)), parts }));
  const n = avg.window > 0 ? Math.min(avg.window, all.length) : all.length;
  const months = all.map((m, i) => ({ ...m, used: i < n }));
  const sums = all.slice(0, n).map((m) => m.sum);
  const value = !sums.length ? 0 : avg.method === 'mean' ? sums.reduce((a, b) => a + b, 0) / sums.length : median(sums);
  return { monthly: Math.round(value || 0), used: n, method: avg.method, months, sources };
}

/* ------------------------------------------------------------------ classificazione delle uscite */
export type Cls = 'Affitto' | 'Cassa malati e assicurazioni' | 'Mutuo' | 'Prestiti e leasing' | 'Telefono e internet' | 'Energia e acqua' | 'Trasporti' | 'Abbonamenti' | 'Tasse e imposte' | 'Cibo' | 'Ristoranti e bar' | 'Altro';
const RULES: [RegExp, Cls][] = [
  [/\b(immo|immobil\w*|affitto|pigione|locazione|miete|loyer|regie|verwaltung|wohnung|gerance|gérance|amministrazione stabili)\b/, 'Affitto'],
  [/kranken|cassa malati|\bcss\b|concordia|helsana|sanitas|swica|visana|assura|mutuel|atupri|\bkpt\b|assicurazion|versicherung|\baxa\b|zurich|mobiliare|baloise|generali|vaudoise|allianz|\bsympany\b|\bsana24\b/, 'Cassa malati e assicurazioni'],
  [/mutuo|ipotec|hypothek|hypo\b/, 'Mutuo'],
  [/prestito|credito|leasing|kredit|darlehen|\brata\b|cembra|bank[- ]now|cashgate|findomestic|compass/, 'Prestiti e leasing'],
  [/swisscom|sunrise|\bsalt\b|mobilnet|wingo|yallo|upc|init7|internet|telefon|quickline|teleboy/, 'Telefono e internet'],
  [/\baet\b|\bail\b|electric|energia|elettric|acqua|\bgas\b|strom|wasser|services industriels/, 'Energia e acqua'],
  [/abbonament|\babo\b|arcobaleno|tpl|ctp|\bsbb\b|\bcff\b|\bffs\b|trasport|vbz|tl lausanne|parking|parcheggio|autosilo|benzina|shell|\bagip\b|\btamoil\b/, 'Trasporti'],
  [/netflix|spotify|disney|apple|google|amazon prime|dazn|palestra|fitness|anthropic|openai|youtube|icloud|microsoft|adobe|canva|dropbox/, 'Abbonamenti'],
  [/imposte|steuer|tasse|\bamministrazione\b.*fisc|ufficio di esecuzione|esecuzione|betreibung|contribut|\bavs\b|\bai\b.*cassa/, 'Tasse e imposte'],
  [/coop|migros|aldi|lidl|denner|supermercat|manor.*food|volg|spar\b|carrefour|esselunga|panetter|macelleria|alimentari|kiosk|k kiosk|avec|valora/, 'Cibo'],
  [/ristorant|pizz|bar\b|caff[eè]|osteria|trattoria|grotto|mcdonald|burger|sushi|gastro|bistro|kebab|take away|takeaway|panino|bakery|starbucks/, 'Ristoranti e bar'],
];
export const classify = (label: string): Cls => { const l = strip(label).toLowerCase(); const hit = RULES.find(([re]) => re.test(l)); return hit ? hit[1] : 'Altro'; };

/* ------------------------------------------------------------------ spese fisse e variabili */
const FIXED_CLS: Cls[] = ['Affitto', 'Cassa malati e assicurazioni', 'Mutuo', 'Prestiti e leasing', 'Telefono e internet', 'Energia e acqua', 'Abbonamenti', 'Tasse e imposte'];
export type FixedItem = { name: string; cls: Cls; key: string; monthly: number; months: number; payments: number; lastDate: string };
export type VarItem = { name: string; total: number; monthly: number; payments: number };
export type Extra = { date: string; label: string; amount: number };
export type Analysis = { salary: SalaryResult; fixed: FixedItem[]; variable: VarItem[]; extraordinary: Extra[]; months: number; from: string; to: string };

export function analyzeSpending(rows: Row[]): { fixed: FixedItem[]; variable: VarItem[]; extraordinary: Extra[]; months: number } {
  const debits = rows.filter((r) => r.amount < 0 && !/fondo emergenza/i.test(r.label));
  const monthsAll = new Set(rows.map((r) => r.date.slice(0, 7))).size || 1;
  const groups = new Map<string, Row[]>();
  debits.forEach((r) => { const k = payeeKey(r.label); if (k.length >= 3) groups.set(k, [...(groups.get(k) ?? []), r]); });
  const fixed: FixedItem[] = []; const fixedKeys = new Set<string>();
  groups.forEach((list, k) => {
    const cls = classify(list[0].label);
    const perMonth = new Map<string, number>(); list.forEach((r) => perMonth.set(r.date.slice(0, 7), (perMonth.get(r.date.slice(0, 7)) ?? 0) - r.amount));
    const months = perMonth.size; const per = list.length / months;
    const monthly = r2(median([...perMonth.values()]));
    const isFixedClass = FIXED_CLS.includes(cls);
    const sorted = list.slice().sort((a, b) => a.date.localeCompare(b.date));
    // una spesa fissa torna nel tempo: abbastanza mesi, al massimo un paio di pagamenti al mese, e non e' un biglietto da pochi franchi
    const stable = months >= 3 && per <= 2.5 && monthly >= (cls === 'Abbonamenti' ? 4 : 25);
    const generic = cls === 'Altro' && months >= Math.max(4, Math.round(monthsAll * 0.5)) && per <= 1.5 && monthly >= 40 && !/^acquisto\b/i.test(strip(list[0].label));
    const subscription = cls === 'Trasporti' && /abbonament|\babo\b|arcobaleno|mezzo prezzo|generale/i.test(list[0].label) && months >= 2 && monthly >= 25;
    if ((isFixedClass && stable) || generic || subscription) {
      fixed.push({ name: cls === 'Altro' ? titleCase(k).slice(0, 40) : `${cls}: ${titleCase(k).slice(0, 30)}`, cls: subscription ? 'Trasporti' : cls, key: k, monthly, months, payments: list.length, lastDate: sorted[sorted.length - 1].date });
      fixedKeys.add(k);
    }
  });
  const extraordinary: Extra[] = []; const varAcc = new Map<string, { total: number; payments: number }>();
  debits.forEach((r) => {
    const k = payeeKey(r.label); if (fixedKeys.has(k)) return;
    const cls = classify(r.label);
    // grossi pagamenti una tantum (>= 1000 che non tornano): non fanno media
    if (-r.amount >= 1000 || cls === 'Tasse e imposte' && -r.amount >= 400) { extraordinary.push({ date: r.date, label: strip(r.label), amount: r.amount }); return; }
    const cur = varAcc.get(cls) ?? { total: 0, payments: 0 }; varAcc.set(cls, { total: cur.total - r.amount, payments: cur.payments + 1 });
  });
  const variable = [...varAcc.entries()].map(([name, v]) => ({ name, total: r2(v.total), monthly: r2(v.total / monthsAll), payments: v.payments })).sort((a, b) => b.total - a.total);
  return { fixed: fixed.sort((a, b) => b.monthly - a.monthly), variable, extraordinary: extraordinary.sort((a, b) => b.date.localeCompare(a.date)), months: monthsAll };
}

export function analyzeStatement(rows: Row[], rule: SalaryRule = DEFAULT_RULE, excluded: string[] = [], avg: AvgRule = DEFAULT_AVG): Analysis | null {
  if (!rows.length) return null;
  const dates = rows.map((r) => r.date).sort();
  return { salary: analyzeSalary(rows, rule, excluded, avg), ...analyzeSpending(rows), from: dates[0], to: dates[dates.length - 1] };
}

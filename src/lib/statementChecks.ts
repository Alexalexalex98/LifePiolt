/**
 * Controlli sull'estratto conto (modulo PURO): dove i dati non bastano per essere certi, l'app NON indovina e chiede all'utente.
 *  - più pagamenti ricorrenti nella stessa classe (due casse malati, due affitti, due leasing): famiglia/più contratti oppure ho cambiato fornitore?
 *  - più stipendi: conto unico di un nucleo, oppure ho cambiato lavoro?
 *  - «Altro» troppo grande: assegnare le voci a una classe.
 *  - spese fisse che di solito sono già state addebitate questo mese e ancora non si vedono.
 * Tutto deriva dai movimenti; niente AI.
 */
import { classify, payeeKey, type Cls } from './statementAnalysis.ts';

export type Row = { date: string; label: string; amount: number };
export type Fixed = { name: string; key: string; cls: string; monthly: number };
export type Tr = (src: string, ...args: (string | number)[]) => string;
const itTr: Tr = (src, ...a) => src.replace(/\{(\d+)\}/g, (_m, i) => String(a[+i] ?? ''));
export type Check = {
  id: string;
  kind: 'multi' | 'sequence' | 'income-multi' | 'income-seq' | 'change' | 'other';
  text: string;
  options: { label: string; answer: string; effect?: { hide?: string[]; excludeIncome?: string[]; override?: { key: string; amount: number } } }[];
};

const ymOf = (iso: string) => iso.slice(0, 7);
const monthsOf = (rows: Row[], key: string, credit: boolean) => [...new Set(rows.filter((r) => (credit ? r.amount > 0 : r.amount < 0) && payeeKey(r.label) === key).map((r) => ymOf(r.date)))].sort();
const overlap = (a: string[], b: string[]) => a.filter((m) => b.includes(m)).length;
const money = (n: number) => Math.round(n).toLocaleString('de-CH');

/** Classi in cui due pagamenti ricorrenti meritano una domanda. */
const ASK_CLS = new Set(['Cassa malati e assicurazioni', 'Affitto', 'Mutuo', 'Prestiti e leasing', 'Telefono e internet', 'Energia e acqua']);

export function findChecks(args: { rows: Row[]; fixed: Fixed[]; incomes: { name: string; key: string; monthly: number }[]; answers: Record<string, string>; tr?: Tr }): Check[] {
  const tr = args.tr ?? itTr;
  const out: Check[] = [];
  const { rows, fixed, incomes, answers } = args;
  const byCls = new Map<string, Fixed[]>();
  fixed.forEach((f) => { if (ASK_CLS.has(f.cls)) byCls.set(f.cls, [...(byCls.get(f.cls) ?? []), f]); });
  for (const [cls, list] of byCls) {
    if (list.length < 2) continue;
    const id = `fixed:${cls}:${list.map((x) => x.key).sort().join('+')}`;
    if (answers[id]) continue;
    const ms = list.map((f) => monthsOf(rows, f.key, false));
    const together = ms.some((a, i) => ms.some((b, j) => j > i && overlap(a, b) >= 2));
    const names = list.map((f) => `${f.name.split(': ').pop()} (${money(f.monthly)})`).join(' e ');
    if (together) out.push({ id, kind: 'multi', text: tr('Pago più di una voce di «{0}» nello stesso periodo: {1}. Come stanno le cose?', tr(cls), names), options: [{ label: tr('Sono tutte mie (famiglia o più contratti): contano tutte'), answer: 'all' }, ...list.map((f) => ({ label: tr('«{0}» non è una mia spesa', f.name.split(': ').pop() ?? ''), answer: `not:${f.key}`, effect: { hide: [f.key] } }))] });
    else {
      const order = list.map((f, i) => ({ f, last: ms[i]![ms[i]!.length - 1] ?? '' })).sort((a, b) => a.last.localeCompare(b.last));
      const old = order.slice(0, -1).map((x) => x.f);
      out.push({ id, kind: 'sequence', text: tr('Vedo {0} in periodi diversi: ho cambiato fornitore?', names), options: [{ label: tr('Sì, ho cambiato: conta solo il più recente'), answer: 'changed', effect: { hide: old.map((f) => f.key) } }, { label: tr('No, sono due cose diverse: contano tutte'), answer: 'all' }] });
    }
  }
  if (incomes.length >= 2) {
    const id = `income:${incomes.map((x) => x.key).sort().join('+')}`;
    if (!answers[id]) {
      const ms = incomes.map((s) => monthsOf(rows, s.key, true));
      const together = ms.some((a, i) => ms.some((b, j) => j > i && overlap(a, b) >= 2));
      const names = incomes.map((s) => `${s.name} (${money(s.monthly)})`).join(' e ');
      if (together) out.push({ id, kind: 'income-multi', text: tr('Entrano più stipendi nello stesso periodo: {0}. Come funziona?', names), options: [{ label: tr('Conto unico: due stipendi di un nucleo, contano tutti'), answer: 'household' }, ...incomes.map((s) => ({ label: tr('«{0}» non è un mio stipendio', s.name), answer: `not:${s.key}`, effect: { excludeIncome: [s.key] } }))] });
      else {
        const order = incomes.map((s, i) => ({ s, last: ms[i]![ms[i]!.length - 1] ?? '' })).sort((a, b) => a.last.localeCompare(b.last));
        out.push({ id, kind: 'income-seq', text: tr('Vedo {0} in periodi diversi: ho cambiato lavoro?', names), options: [{ label: tr('Sì: conta solo il più recente'), answer: 'changed', effect: { excludeIncome: order.slice(0, -1).map((x) => x.s.key) } }, { label: tr('No: contano entrambi'), answer: 'all' }] });
      }
    }
  }
  // una spesa fissa che cambia di colpo: aumento vero o errore?
  for (const f of fixed) {
    const mine = rows.filter((r) => r.amount < 0 && payeeKey(r.label) === f.key).sort((x, y) => x.date.localeCompare(y.date));
    if (mine.length < 4) continue;
    const last = -mine[mine.length - 1]!.amount, prev = mine.slice(0, -1).map((r) => -r.amount).sort((x, y) => x - y);
    const typical = prev[Math.floor(prev.length / 2)]!;
    if (typical <= 0 || Math.abs(last - typical) / typical < 0.2 || Math.abs(last - typical) < 15) continue;
    const id = `change:${f.key}:${Math.round(last)}`;
    if (answers[id]) continue;
    out.push({ id, kind: 'change', text: tr('«{0}» di solito costa {1} ma l\'ultimo pagamento è {2}. È un aumento vero o un errore?', f.name.split(': ').pop() ?? f.name, money(typical), money(last)), options: [{ label: tr('Aumento vero: usa il nuovo importo'), answer: 'new', effect: { override: { key: f.key, amount: Math.round(last * 100) / 100 } } }, { label: tr('Una tantum o errore: tieni il solito'), answer: 'keep' }] });
  }
  return out;
}

/** Giorni dall'ultimo movimento: se sono tanti, i calcoli non sono aggiornati e va detto. */
export function staleDays(rows: Row[], today: string): number | null {
  const last = rows.map((r) => r.date).sort().pop();
  return last ? Math.floor((Date.parse(today) - Date.parse(last)) / 86400000) : null;
}

/** «Altro» pesa troppo per capire dove vanno i soldi: le voci più grandi da assegnare. */
export function otherCandidates(rows: Row[], max = 6): { key: string; name: string; total: number }[] {
  const g = new Map<string, { name: string; total: number }>();
  rows.filter((r) => r.amount < 0 && classify(r.label) === 'Altro').forEach((r) => { const k = payeeKey(r.label); if (k.length < 3) return; const c = g.get(k) ?? { name: r.label, total: 0 }; g.set(k, { name: c.name, total: c.total - r.amount }); });
  return [...g.entries()].map(([key, v]) => ({ key, name: v.name, total: Math.round(v.total) })).sort((a, b) => b.total - a.total).slice(0, max);
}

/** Spese fisse che di solito sono già state addebitate questo mese e ancora non compaiono. */
export function dueFixed(rows: Row[], fixed: Fixed[], today: string): { name: string; monthly: number; day: number }[] {
  const ym = ymOf(today), dayNow = Number(today.slice(8, 10));
  const out: { name: string; monthly: number; day: number }[] = [];
  for (const f of fixed) {
    const mine = rows.filter((r) => r.amount < 0 && payeeKey(r.label) === f.key);
    if (!mine.length || mine.some((r) => ymOf(r.date) === ym)) continue;
    const last = mine.map((r) => r.date).sort().pop()!;
    const gapDays = (Date.parse(today) - Date.parse(last)) / 86400000;
    if (gapDays > 75) continue; // non è più attiva
    const days = mine.map((r) => Number(r.date.slice(8, 10))).sort((a, b) => a - b);
    out.push({ name: f.name, monthly: f.monthly, day: days[Math.floor(days.length / 2)]! });
  }
  return out.filter((d) => d.day >= dayNow - 1).sort((a, b) => a.day - b.day);
}

/** Classe da mostrare nel grafico del mese: la stessa dell'analisi dell'estratto (così le due pagine non si contraddicono). */
const TO_CHART: Record<string, string> = { 'Cassa malati e assicurazioni': 'Cassa malati', Cibo: 'Alimentari/Casa' };
export function chartCategory(label: string, fix: Record<string, { cls?: string }> | undefined, fallback: (l: string) => string): string {
  const cls = (fix?.[payeeKey(label)]?.cls as Cls | undefined) ?? classify(label);
  if (cls === 'Altro') return fallback(label);
  return TO_CHART[cls] ?? cls;
}

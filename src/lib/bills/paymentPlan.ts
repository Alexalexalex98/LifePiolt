/**
 * Piano di pagamento (scadenzario a rate): «Rata N. · Pagabile entro il · Ammontare», con N rate di date e importi diversi.
 * Si riconosce dalle righe «numero, data, importo» consecutive, anche se il PDF mette ogni cella su una riga a parte. Modulo PURO.
 */
import { mkIso, validYmd } from './dates.ts';
import type { Installment } from './types.ts';

export type PaymentPlan = { installments: Installment[]; total: number; /** totale scritto nel documento (se c'è) */ statedTotal?: number; /** ogni quanti mesi, se regolare */ everyMonths?: number; source: string };

const DATE = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/;
const AMOUNT = /^\d{1,3}(?:['’ʼ`´]\d{3})*[.,]\d{2}$|^\d+[.,]\d{2}$/;
const toNum = (s: string) => Number(s.replace(/['’ʼ`´]/g, '').replace(',', '.'));
const round2 = (n: number) => Math.round(n * 100) / 100;

function monthsBetween(a: string, b: string): number { return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7))); }

/** Le rate del piano, se il testo ne contiene un elenco (almeno 3 righe «numero data importo» in ordine). */
export function detectPaymentPlan(rawText: string): PaymentPlan | null {
  const text = String(rawText ?? '');
  const tokens = text.split(/\s+/).filter(Boolean);
  const rows: { n: number; iso: string; amount: number; at: number }[] = [];
  for (let i = 0; i + 2 < tokens.length; i++) {
    if (!/^\d{1,3}$/.test(tokens[i])) continue;
    const d = DATE.exec(tokens[i + 1]);
    if (!d || !AMOUNT.test(tokens[i + 2])) continue;
    const y = +d[3], m = +d[2], day = +d[1];
    if (!validYmd(y, m, day)) continue;
    rows.push({ n: +tokens[i], iso: mkIso(y, m, day), amount: round2(toNum(tokens[i + 2])), at: i });
    i += 2;
  }
  /* la sequenza più lunga con numerazione crescente di 1 in 1 e date in ordine */
  let best: typeof rows = [];
  for (let s = 0; s < rows.length; s++) {
    const seq = [rows[s]];
    for (let k = s + 1; k < rows.length; k++) {
      const prev = seq[seq.length - 1];
      if (rows[k].n === prev.n + 1 && rows[k].iso > prev.iso) seq.push(rows[k]);
      else if (rows[k].n <= prev.n) break;
    }
    if (seq.length > best.length) best = seq;
  }
  if (best.length < 3 || best.some((r) => r.amount <= 0)) return null;
  const installments: Installment[] = best.map((r) => ({ dueDate: r.iso, amount: r.amount }));
  const total = round2(installments.reduce((a, x) => a + x.amount, 0));
  const gaps = best.slice(1).map((r, i) => monthsBetween(best[i].iso, r.iso));
  const everyMonths = gaps.every((g) => g === gaps[0]) && gaps[0] >= 1 ? gaps[0] : undefined;
  let statedTotal: number | undefined;
  const tm = /(?:importo\s+totale(?:\s+da\s+pagare)?|totale\s+da\s+pagare|gesamtbetrag|montant\s+total|total\s+amount)\s*:?\s*(?:CHF|EUR|Fr\.?|€)?\s*(\d[\d'’ʼ.,]*\d)/i.exec(text);
  if (tm) { const v = toNum(tm[1]); if (Number.isFinite(v) && v > 0) statedTotal = round2(v); }
  return { installments, total, ...(statedTotal !== undefined ? { statedTotal } : {}), ...(everyMonths ? { everyMonths } : {}), source: `${best[0].n} ${best[0].iso} … ${best[best.length - 1].n} ${best[best.length - 1].iso}` };
}

/**
 * Risposta strutturata del server AI su un documento (tipo, riassunto, importi, date, azioni, decisione) -> testo da leggere
 * e fatture da proporre. Modulo PURO: nessun import dall'app. Tollerante: ogni campo puo' mancare.
 */
type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);
const arr = (x: unknown): Obj[] => (Array.isArray(x) ? x.filter(isObj) : []);
const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '');

export type ProposedInvoice = { issuer: string; amount: number; currency: string; number?: string; dueDate?: string; label: string };
export type Described = { text: string; tipo: string; invoices: ProposedInvoice[] };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Il numero di una fattura dall'etichetta: «Fattura 249/2025», «Fattura Nr. 034/2026», «Scadenza fattura 090/2026». */
const numberOf = (s: string) => /(?:fattura|invoice|factura|rechnung)\D{0,8}?([A-Za-z]*\d[\w./-]*)/i.exec(s)?.[1];
const dateOf = (s: string) => { const m = /(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(s); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : undefined; };

const fmtDate = (iso: string) => (ISO.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : iso);

export function describeAnalysis(result: unknown): Described | null {
  if (!isObj(result)) return null;
  const tipo = str(result.tipo).toLowerCase();
  const riassunto = str(result.riassunto);
  const dettagli = arr(result.dettagli), importi = arr(result.importi), date = arr(result.date), azioni = arr(result.azioni);
  const decisione = isObj(result.decisione) ? result.decisione : null;
  if (!riassunto && !importi.length && !dettagli.length) return null;

  const emittente = str(dettagli.find((d) => /emittente|fornitore|issuer/i.test(str(d.voce)))?.valore) || (Array.isArray(result.persone_enti) ? str(result.persone_enti[0]) : '');
  const invoices: ProposedInvoice[] = [];
  for (const im of importi) {
    const label = str(im.etichetta);
    const n = numberOf(label);
    const amount = Number(im.valore);
    if (!n || !/(fattur|invoice|factura|rechnung)/i.test(label) || !Number.isFinite(amount) || amount <= 0) continue;
    const due = date.find((d) => /scadenz|due|entro/i.test(str(d.etichetta)) && numberOf(str(d.etichetta)) === n);
    const fromDetail = dettagli.find((d) => numberOf(str(d.voce)) === n);
    const dueDate = ISO.test(str(due?.data)) ? str(due?.data) : dateOf(str(fromDetail?.valore));
    invoices.push({ issuer: emittente || 'Fattura', amount, currency: str(im.valuta) || 'CHF', number: n, ...(dueDate ? { dueDate } : {}), label });
  }

  const parts: string[] = [];
  if (riassunto) parts.push(riassunto);
  const keep = dettagli.filter((d) => str(d.voce) && str(d.valore)).slice(0, 6).map((d) => `• ${str(d.voce)}: ${str(d.valore)}`);
  if (keep.length) parts.push(keep.join('\n'));
  const todo = azioni.map((a) => `• ${str(a.azione)}${ISO.test(str(a.entro)) ? ` (entro il ${fmtDate(str(a.entro))})` : ''}`).filter((l) => l.length > 3).slice(0, 4);
  if (todo.length) parts.push(`Cosa farei:\n${todo.join('\n')}`);
  if (decisione && str(decisione.consiglio)) parts.push(str(decisione.consiglio));
  const check = Array.isArray(decisione?.da_verificare) ? (decisione!.da_verificare as unknown[]).map(str).filter(Boolean).slice(0, 3) : [];
  if (check.length) parts.push(`Da controllare:\n${check.map((c) => `• ${c}`).join('\n')}`);
  const unreadable = Array.isArray(result.non_leggibile) ? (result.non_leggibile as unknown[]).map(str).filter(Boolean) : [];
  if (unreadable.length) parts.push(`Non sono riuscita a leggere: ${unreadable.slice(0, 3).join(', ')}.`);
  return { text: parts.join('\n\n'), tipo, invoices };
}

/** Bolletta o fattura singola da pagare (tipo dichiarato dal server). */
export const isBillType = (tipo: string) => /^(bollett|fattur|invoice|rechnung|factura)/i.test(tipo);

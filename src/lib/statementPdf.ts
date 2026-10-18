/** Estratto conto in PDF: risposta dell'AI (elenco JSON di movimenti) -> testo CSV che l'importazione sa gia' leggere. Modulo PURO. */
export const STATEMENT_PDF_PROMPT = 'Questo è l\'estratto conto di una banca in PDF. Elenca TUTTI i movimenti del conto, uno per riga dell\'estratto (non i saldi riepilogativi né i totali), come elenco JSON del tipo [{"data":"2026-10-03","descrizione":"Coop Pronto Lugano","importo":-45.90}]. La data è sempre AAAA-MM-GG. L\'importo è negativo per le uscite (addebiti, pagamenti, prelievi) e positivo per le entrate (accrediti, stipendio, versamenti), con il punto come separatore decimale e senza apostrofi. Rispondi SOLO con il JSON, senza altro testo. Se non è un estratto conto rispondi [].';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const clean = (s: string) => s.replace(/[;\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

export type StatementMove = { date: string; label: string; amount: number };

/** Legge la risposta (anche dentro un blocco di codice) e tiene solo i movimenti validi. */
export function parseStatementReply(text: string): StatementMove[] {
  const m = /\[[\s\S]*\]/.exec(text ?? '');
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]) as unknown;
    if (!Array.isArray(arr)) return [];
    const out: StatementMove[] = [];
    for (const x of arr as Record<string, unknown>[]) {
      const date = String(x?.data ?? x?.date ?? '').trim();
      const label = clean(String(x?.descrizione ?? x?.description ?? x?.label ?? ''));
      const amount = Number(String(x?.importo ?? x?.amount ?? '').replace(/'/g, '').replace(',', '.'));
      if (ISO.test(date) && label && Number.isFinite(amount) && amount !== 0 && Math.abs(amount) < 1e7) out.push({ date, label, amount });
    }
    return out;
  } catch { return []; }
}

/** CSV con intestazione che parseCsv riconosce (Data;Descrizione;Importo). */
export const movesToCsv = (moves: StatementMove[]): string => ['Data;Descrizione;Importo', ...moves.map((m) => `${m.date};${clean(m.label)};${m.amount.toFixed(2)}`)].join('\n');

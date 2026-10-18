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

const DATE_RE = /\b\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b/;
const AMOUNT_RE = /-?\d{1,3}(?:['’ ]\d{3})*[.,]\d{2}\b|-?\d+[.,]\d{2}\b/;

/** Dal testo di un estratto conto tiene solo le righe dei movimenti (data + importo) e ricava l'anno: il resto (nome, IBAN, intestazioni) non esce dal telefono. */
export function statementLines(text: string): { lines: string[]; year?: number } {
  const lines = (text ?? '').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l.length > 8 && l.length < 400 && DATE_RE.test(l) && AMOUNT_RE.test(l));
  const years = new Map<number, number>();
  for (const m of (text ?? '').matchAll(/\b(20\d{2})\b/g)) years.set(Number(m[1]), (years.get(Number(m[1])) ?? 0) + 1);
  const year = [...years.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return { lines, year };
}

/** Spezza l'elenco in blocchi di dimensione limitata (un estratto lungo va in piu' richieste piccole). */
export function chunkLines(lines: string[], max = 5500): string[][] {
  const out: string[][] = []; let cur: string[] = []; let size = 0;
  for (const l of lines) {
    if (size + l.length + 1 > max && cur.length) { out.push(cur); cur = []; size = 0; }
    cur.push(l); size += l.length + 1;
  }
  if (cur.length) out.push(cur);
  return out;
}

export const statementChunkPrompt = (lines: string[], year?: number) =>
  `Queste sono righe dei movimenti di un estratto conto bancario, tali e quali (testo estratto da un PDF, quindi le colonne possono essere mescolate).${year ? ` L'anno di riferimento è ${year}: se una data non ha l'anno, usa questo.` : ''} Per ogni riga che è un movimento restituisci data (AAAA-MM-GG), una descrizione breve e l'importo: negativo per le uscite (addebiti, pagamenti, prelievi) e positivo per le entrate (accrediti, stipendio, versamenti), con il punto come separatore decimale e senza apostrofi. Se la riga ha anche il saldo, il saldo NON è l'importo: usa la sua variazione rispetto alla riga precedente per capire se è un'uscita o un'entrata. Ignora i saldi iniziali e finali e i totali. Rispondi SOLO con un elenco JSON del tipo [{"data":"2026-10-03","descrizione":"Coop Lugano","importo":-45.90}].\n\n${lines.join('\n')}`;

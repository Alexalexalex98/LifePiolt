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

/* ---------------------------------------------------------------- tabelle con colonne (Addebito / Accredito) */
import type { PdfLayoutPage, PdfRun } from './bills/pdfText.ts';

const H_DATE = /^(data|date|datum|data contabile|buchungsdatum|data operazione)$/i;
const H_TEXT = /^(testo|text|descrizione|beschreibung|buchungstext|description|causale|dettagli|movimento|operazione)$/i;
const H_DEBIT = /^(addebito|addebiti|debit|belastung|dare|uscita|uscite|soll|withdrawal)$/i;
const H_CREDIT = /^(accredito|accrediti|credit|gutschrift|avere|entrata|entrate|haben|deposit)$/i;
const H_BALANCE = /^(saldo|balance|kontostand|saldo contabile)$/i;
/** L'intestazione di colonna senza la valuta («Uscita CHF» → «Uscita») e, per «Testo / Descrizione», ognuna delle due parti. */
const headParts = (s: string): string[] => s.replace(/\b(chf|eur|usd|gbp|fr\.?|sfr|€|\$)\b/gi, ' ').split('/').map((x) => x.replace(/[\s.:()]+/g, ' ').trim()).filter(Boolean);
const colOf = (raw: string): Col | null => {
  for (const p of headParts(raw)) {
    if (H_DATE.test(p)) return 'date';
    if (H_TEXT.test(p)) return 'text';
    if (H_DEBIT.test(p)) return 'debit';
    if (H_CREDIT.test(p)) return 'credit';
    if (H_AMOUNT.test(p)) return 'amount';
    if (H_BALANCE.test(p)) return 'balance';
  }
  return null;
};
const H_AMOUNT = /^(importo|betrag|amount)$/i;
const FULL_DATE = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/;
const SKIP = /^(saldo|totale|riporto|summe|saldovortrag|total)\b/i;

type Col = 'date' | 'text' | 'debit' | 'credit' | 'amount' | 'balance';
type Cols = { col: Col; from: number; to: number }[];

const isoOf = (s: string): string | null => {
  const m = FULL_DATE.exec(s.trim());
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const mo = Number(m[2]), d = Number(m[1]);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
};
const numOf = (s: string): number | null => {
  const t = s.trim().replace(/['’\s]/g, '');
  if (!/^[-+]?\d+([.,]\d{1,2})?-?$/.test(t)) return null;
  const neg = t.startsWith('-') || t.endsWith('-');
  const n = Number(t.replace(/[-+]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? (neg ? -n : n) : null;
};

function headerOf(runs: PdfRun[], rects: PdfLayoutPage['rects']): { y: number; cols: Cols } | null {
  const byY = new Map<number, PdfRun[]>();
  for (const r of runs) { const k = Math.round(r.y); byY.set(k, [...(byY.get(k) ?? []), r]); }
  for (const [y, row] of byY) {
    const named = row.map((r) => ({ r, col: colOf(r.text) })).filter((x): x is { r: PdfRun; col: Col } => !!x.col);
    const has = (c: Col) => named.some((x) => x.col === c);
    if (!(has('date') && has('text') && (has('debit') || has('credit') || has('amount')))) continue;
    named.sort((a, b) => a.r.x - b.r.x);
    const cols: Cols = named.map((n, i) => {
      /* la cella disegnata sotto l'intestazione vale solo se contiene QUELLA intestazione e nessun'altra: le righe a strisce a tutta larghezza non sono celle */
      const cell = rects.find((q) => n.r.x >= q.x - 1 && n.r.x <= q.x + q.w + 1 && Math.abs(q.y - n.r.y) < 14 && q.w > 10
        && !named.some((o) => o !== n && o.r.x >= q.x - 1 && o.r.x <= q.x + q.w + 1));
      const next = named[i + 1];
      /* senza celle: una colonna va dall'inizio della sua intestazione a quella della successiva (gli importi sono spesso allineati a destra, quindi iniziano dopo l'intestazione) */
      const from = cell ? cell.x - 0.5 : i === 0 ? -1e9 : n.r.x - 8;
      const to = cell ? cell.x + cell.w + 0.5 : next ? next.r.x - 8 : 1e9;
      return { col: n.col, from, to };
    });
    return { y, cols };
  }
  return null;
}

/** Legge un estratto conto in tabella usando le posizioni: la colonna dice se e' un addebito o un accredito. Senza intestazione riconoscibile restituisce []. */
export function parseTableStatement(pages: PdfLayoutPage[]): StatementMove[] {
  const out: StatementMove[] = [];
  let cols: Cols | null = null;
  let cur: { date: string; label: string; amount: number | null; bal: number | null; fromAmountCol: boolean } | null = null;
  let prevBal: number | null = null;
  const commit = () => {
    if (cur && cur.amount !== null && cur.amount !== 0 && cur.label && !SKIP.test(cur.label)) {
      let amount = cur.amount;
      /* una sola colonna importi: il segno si ricava dalla variazione del saldo, se c'è */
      if (cur.fromAmountCol && cur.bal !== null && prevBal !== null) { const d = Math.round((cur.bal - prevBal) * 100) / 100; if (Math.abs(Math.abs(d) - Math.abs(amount)) < 0.05) amount = d; }
      out.push({ date: cur.date, label: clean(cur.label), amount });
    }
    if (cur && cur.bal !== null) prevBal = cur.bal;
    cur = null;
  };
  for (const pg of pages) {
    const h = headerOf(pg.runs, pg.rects);
    let top = Infinity;
    if (h) { cols = h.cols; top = h.y; }
    if (!cols) continue;
    const rows = new Map<number, PdfRun[]>();
    for (const r of pg.runs) { if (r.y >= top - 0.5) continue; const k = Math.round(r.y * 2) / 2; rows.set(k, [...(rows.get(k) ?? []), r]); }
    const ys = [...rows.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const row = rows.get(y)!.sort((a, b) => a.x - b.x);
      const inCol = (c: Col) => row.filter((r) => { const k = cols!.find((x) => x.col === c); return !!k && r.x >= k.from && r.x < k.to; });
      const dateRun = inCol('date').map((r) => ({ r, iso: isoOf(r.text) })).find((x) => x.iso);
      const textRuns = inCol('text');
      let amount: number | null = null;
      for (const r of inCol('debit')) { const n = numOf(r.text); if (n !== null) amount = -Math.abs(n); }
      for (const r of inCol('credit')) { const n = numOf(r.text); if (n !== null) amount = Math.abs(n); }
      let fromAmountCol = false;
      for (const r of inCol('amount')) { const n = numOf(r.text); if (n !== null) { amount = n; fromAmountCol = true; } }
      let bal: number | null = null;
      for (const r of inCol('balance')) { const n = numOf(r.text); if (n !== null) bal = n; }
      if (dateRun) { commit(); cur = { date: dateRun.iso!, label: textRuns[0]?.text.trim() ?? '', amount, bal, fromAmountCol }; }
      else if (cur) { if (cur.amount === null && amount !== null) { cur.amount = amount; cur.fromAmountCol = fromAmountCol; } if (cur.bal === null && bal !== null) cur.bal = bal; if (!cur.label && textRuns[0]) cur.label = textRuns[0].text.trim(); }
    }
  }
  commit();
  return out;
}

/* ---------------------------------------------------------------- testo semplice (senza posizioni): ogni riga o ogni cella a capo */
const FLAT_DATE = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/;
const FLAT_AMOUNT = /^[-+]?\d{1,3}(?:['’ʼ]\d{3})*[.,]\d{2}-?$|^[-+]?\d+[.,]\d{2}-?$/;
const POSITIVE = /(accredit|entrat|stipend|salari|rimbors|versament|incass|interess|storno|gutschrift|credit|deposit|refund|vendita)/i;

/**
 * Legge un estratto conto dal solo testo (anche quando ogni cella della tabella sta su una riga a parte): una riga comincia con una data,
 * poi viene la descrizione e gli importi. Con la colonna «saldo» il segno si ricava dalla variazione del saldo; altrimenti dalle parole
 * (accredito, stipendio, rimborso… = entrata) o da un segno meno. Senza almeno 3 movimenti restituisce [].
 */
export function parseFlatStatement(text: string): StatementMove[] {
  const lines = String(text ?? '').replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  type Row = { date: string; label: string[]; amounts: string[] };
  const rows: Row[] = [];
  let cur: Row | null = null;
  /* righe che non sono movimenti: intestazioni di colonna (da sole), numeri di pagina, totali, avvisi */
  const NOISE = /^(pagina|page|seite)\b|^(data|date|datum|testo|text|descrizione|uscita|entrata|addebito|accredito|saldo|importo|valuta)(\s*\/\s*\w+)?(\s+(chf|eur|usd))?$|^(totale|riporto|total|summe)\b|fittizio|^iban\b|^periodo\b/i;
  for (const line of lines) {
    const toks = line.split(' ');
    const d = FLAT_DATE.exec(toks[0] ?? '');
    if (d) {
      const iso = isoOf(toks[0]);
      if (!iso) { cur = null; continue; }
      let rest = toks.slice(1);
      if (rest[0] && FLAT_DATE.test(rest[0])) rest = rest.slice(1); // data valuta
      cur = { date: iso, label: [], amounts: [] };
      rows.push(cur);
      for (const tk of rest) { if (FLAT_AMOUNT.test(tk)) cur.amounts.push(tk); else if (!cur.amounts.length) cur.label.push(tk); }
      continue;
    }
    if (!cur) continue;
    if (NOISE.test(line) && cur.amounts.length) { cur = null; continue; }
    if (toks.every((tk) => FLAT_AMOUNT.test(tk))) { cur.amounts.push(...toks); continue; }
    if (!cur.amounts.length) { if (NOISE.test(line)) { cur = null; continue; } cur.label.push(line); continue; }
    cur = null; // testo dopo gli importi: fine della riga
  }
  const valid = rows.filter((r) => r.amounts.length >= 1 && r.label.join(' ').trim().length >= 2 && !SKIP.test(r.label.join(' ').trim()));
  if (valid.length < 3) return [];
  const opening = /saldo\s+iniziale[^\d-]{0,20}(-?\d[\d'’ʼ]*[.,]\d{2})/i.exec(text);
  let prev: number | null = opening ? numOf(opening[1]) : null;
  const out: StatementMove[] = [];
  for (const r of valid) {
    const nums = r.amounts.map((a) => numOf(a)).filter((n): n is number => n !== null);
    if (!nums.length) continue;
    let amount = nums[0];
    const bal = nums.length >= 2 ? nums[nums.length - 1] : null;
    const label = clean(r.label.join(' '));
    if (bal !== null && prev !== null) {
      const dlt = Math.round((bal - prev) * 100) / 100;
      amount = Math.abs(Math.abs(dlt) - Math.abs(amount)) < 0.05 ? dlt : (POSITIVE.test(label) ? Math.abs(amount) : amount < 0 ? amount : -Math.abs(amount));
    } else amount = amount < 0 ? amount : POSITIVE.test(label) ? Math.abs(amount) : -Math.abs(amount);
    if (bal !== null) prev = bal;
    if (amount !== 0) out.push({ date: r.date, label, amount });
  }
  return out;
}

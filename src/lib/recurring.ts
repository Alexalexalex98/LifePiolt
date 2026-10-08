/**
 * Spese ricorrenti rilevate dai movimenti di più mesi. Modulo PURO e testabile.
 * Regola: stessa descrizione normalizzata, importo simile (±15% o ±2 CHF dalla mediana), cadenza mensile (25-35 giorni tra un pagamento
 * e il successivo, almeno 3 pagamenti, oppure 2 se sono nei mesi consecutivi e di importo identico) o annuale (350-380 giorni, 2 pagamenti).
 */
export type DatedMovement = { date: string; label: string; amount: number };
export type RecurringBill = { name: string; amount: number; freq: 'monthly' | 'yearly'; count: number; lastDate: string; key: string };

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const DAY = 86400000;
const t = (iso: string) => new Date(iso + 'T00:00:00').getTime();

/** "Alimentari/Casa · Migros Lugano 12.10.2026" -> "migros lugano" (prefisso categoria, date, numeri e rumore tolti). */
export function normalizeLabel(label: string): string {
  let s = label.toLowerCase();
  s = s.replace(/^[^·]{1,30}·\s*/, '');
  s = s.replace(/\b\d{1,2}[./]\d{1,2}([./]\d{2,4})?\b/g, ' ').replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ');
  s = s.replace(new RegExp(`\\b(${MONTHS.join('|')}|gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)\\b`, 'g'), ' ');
  s = s.replace(/\b(pagamento|carta di debito|carta|kartenzahlung|kauf|dienstleistung|vom|ordine di pagamento|addebito|lsv|direct debit|dd|ref|n\.?)\b/g, ' ');
  s = s.replace(/[0-9#*_/\\()[\]:;,.\-+]/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

const median = (a: number[]) => { const s = a.slice().sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
const normBill = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ');

/** `existing` = nomi delle bollette già presenti: i candidati simili vengono esclusi. */
export function detectRecurring(movs: DatedMovement[], existing: string[] = []): RecurringBill[] {
  const groups = new Map<string, DatedMovement[]>();
  movs.filter((m) => m.amount < 0).forEach((m) => {
    const k = normalizeLabel(m.label);
    if (k.length < 3) return;
    groups.set(k, [...(groups.get(k) ?? []), m]);
  });
  const have = existing.map(normBill);
  const out: RecurringBill[] = [];
  groups.forEach((list, key) => {
    list.sort((a, b) => a.date.localeCompare(b.date));
    const amounts = list.map((m) => -m.amount);
    const med = median(amounts);
    const similar = list.filter((m) => Math.abs(-m.amount - med) <= Math.max(2, med * 0.15));
    if (similar.length < 2) return;
    const gaps = similar.slice(1).map((m, i) => Math.round((t(m.date) - t(similar[i].date)) / DAY));
    const monthlyGaps = gaps.filter((g) => g >= 25 && g <= 35).length;
    const yearlyGaps = gaps.filter((g) => g >= 350 && g <= 380).length;
    const identical = new Set(similar.map((m) => m.amount)).size === 1;
    let freq: RecurringBill['freq'] | null = null;
    if (monthlyGaps >= 2 || (monthlyGaps >= 1 && similar.length === 2 && identical)) freq = 'monthly';
    else if (yearlyGaps >= 1) freq = 'yearly';
    if (!freq) return;
    // il nome mostrato è l'ultima descrizione, senza prefisso categoria
    const last = similar[similar.length - 1];
    const display = titleCase(normalizeLabel(last.label)) || titleCase(key);
    const name = display.length > 40 ? display.slice(0, 40).trim() : display;
    const nk = normBill(name);
    if (have.some((h) => h === nk || (h.length >= 4 && (nk.includes(h) || h.includes(nk))))) return;
    out.push({ name, amount: Math.round(med * 100) / 100, freq, count: similar.length, lastDate: last.date, key });
  });
  return out.sort((a, b) => b.count - a.count || b.amount - a.amount);
}

const MONTH_IDX = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
/** Mesi dell'app ({label:"Ottobre 2026", movements:[{date:"dd/mm"}]}) -> movimenti con data ISO. */
export function movementsToDated(months: { label: string; movements: { date: string; label: string; amount: number }[] }[]): DatedMovement[] {
  const out: DatedMovement[] = [];
  months.forEach((m) => {
    const [name, year] = m.label.split(' ');
    const mi = MONTH_IDX.indexOf(name);
    if (mi < 0 || !year) return;
    m.movements.forEach((x) => {
      const d = /^(\d{1,2})\/(\d{1,2})$/.exec(x.date.trim());
      const day = d ? Number(d[1]) : 1;
      out.push({ date: `${year}-${String(mi + 1).padStart(2, '0')}-${String(Math.min(31, Math.max(1, day))).padStart(2, '0')}`, label: x.label, amount: x.amount });
    });
  });
  return out;
}

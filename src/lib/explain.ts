/** Spiegare un numero: elenco dei movimenti da cui arriva. Modulo PURO e testabile. */
export type ExplainRow = { date: string; label: string; amount: number; sort: string };
type MonthLike = { label: string; start: number; movements: { date: string; label: string; amount: number }[] };

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const yearOf = (label: string) => Number(label.split(' ')[1]) || new Date().getFullYear();
export const monthNo = (label: string) => MONTHS.indexOf(label.split(' ')[0].toLowerCase()) + 1;

/** Movimenti (dal piu' recente) che rispettano il filtro; la data diventa gg.mm.aaaa. */
export function listMovements(months: MonthLike[], pred: (m: { label: string; amount: number }, month: MonthLike) => boolean): ExplainRow[] {
  const out: ExplainRow[] = [];
  for (const m of months) for (const x of m.movements) {
    if (!pred(x, m)) continue;
    const y = yearOf(m.label), [dd, mm] = x.date.split('/');
    out.push({ date: `${dd}.${mm}.${y}`, label: x.label.replace(/^[^·]{1,30}·\s*/, ''), amount: x.amount, sort: `${y}-${mm}-${dd}` });
  }
  return out.sort((a, b) => b.sort.localeCompare(a.sort));
}

export const sumRows = (rows: { amount: number }[]) => Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;

import { listMovements } from '@/lib/explain';
import { dueFixed, findChecks } from '@/lib/statementChecks';
import { useFin } from '@/store/finance';

/** Cosa nell'estratto è ancora incerto e cosa ha già confermato l'utente: Theia lo sa e chiede invece di assumere. */
export function financeCheckFacts(): string {
  const f = useFin.getState();
  const info = f.statementInfo;
  if (!info) return '';
  const rows = listMovements(f.months, () => true).map((r) => ({ date: r.sort, label: r.label, amount: r.amount }));
  const fixed = info.fixed.map((x) => ({ name: x.name, key: x.key, cls: x.cls, monthly: x.monthly }));
  const pending = findChecks({ rows, fixed, incomes: info.salary.sources, answers: f.checks ?? {} });
  const due = dueFixed(rows, fixed, new Date().toISOString().slice(0, 10));
  const lines: string[] = [];
  if (pending.length) lines.push(`DATI DA CONFERMARE (l'utente non ha ancora risposto: NON dare per certi i numeri collegati, chiedi tu la conferma): ${pending.map((c) => c.text).join(' | ')}`);
  const ans = Object.entries(f.checks ?? {});
  if (ans.length) lines.push(`Conferme dell'utente: ${ans.map(([id, a]) => `${id} = ${a}`).join('; ')}`);
  const unsure = Object.keys(f.moveKind ?? {}).length;
  if (unsure) lines.push(`Entrate classificate a mano dall'utente: ${unsure}`);
  if (due.length) lines.push(`Spese fisse non ancora addebitate questo mese (di solito intorno al giorno indicato): ${due.map((d) => `${d.name} ${Math.round(d.monthly)} (giorno ${d.day})`).join('; ')}`);
  return lines.join('\n');
}

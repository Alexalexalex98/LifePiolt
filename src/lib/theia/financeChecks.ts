import { listMovements } from '@/lib/explain';
import { dueFixed, findChecks, staleDays } from '@/lib/statementChecks';
import { useFin } from '@/store/finance';
import { buildMonthPlan } from '@/lib/monthPlan';
import { findPlanChecks } from '@/lib/monthPlanChecks';
import { useMonthPlan } from '@/store/monthPlan';

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
  const stale = staleDays(rows, new Date().toISOString().slice(0, 10));
  if (stale != null && stale > 30) lines.push(`ATTENZIONE: l'ultimo movimento dell'estratto risale a ${stale} giorni fa: i calcoli non sono aggiornati, dillo all'utente e suggerisci di caricare un estratto recente.`);
  if (pending.length) lines.push(`DATI DA CONFERMARE (l'utente non ha ancora risposto: NON dare per certi i numeri collegati, chiedi tu la conferma): ${pending.map((c) => c.text).join(' | ')}`);
  const ans = Object.entries(f.checks ?? {});
  if (ans.length) lines.push(`Conferme dell'utente: ${ans.map(([id, a]) => `${id} = ${a}`).join('; ')}`);
  const unsure = Object.keys(f.moveKind ?? {}).length;
  if (unsure) lines.push(`Entrate classificate a mano dall'utente: ${unsure}`);
  if (due.length) lines.push(`Spese fisse non ancora addebitate questo mese (di solito intorno al giorno indicato): ${due.map((d) => `${d.name} ${Math.round(d.monthly)} (giorno ${d.day})`).join('; ')}`);
  try {
    const mp = useMonthPlan.getState();
    const now = new Date();
    const daysLeft = Math.max(1, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1);
    const plan = buildMonthPlan({ ym: now.toISOString().slice(0, 7), income: mp.income, fixed: [...fixed.map((x) => ({ label: x.name, amount: x.monthly })), ...mp.extraFixed.map((x) => ({ label: x.name, amount: x.amount }))], goals: mp.goals, plans: mp.plans, daysLeft });
    if (plan.income.total > 0 || mp.goals.length || mp.plans.length) lines.push(`PIANO DEL MESE (calcolato dall'app): entrata prevista ${Math.round(plan.income.total)}${plan.income.manual ? ' (indicata dall\'utente)' : ''}; spese fisse ${Math.round(plan.fixedTotal)}; da mettere da parte ${Math.round(plan.setAsideTotal)} (${plan.setAside.map((x) => `${x.label} ${Math.round(x.amount)}`).join(', ') || 'nulla'}); restano da vivere ${Math.round(plan.free)} (${Math.round(plan.perDay)} al giorno); conto per i risparmi: ${mp.savingsAccount || 'non indicato'}`);
    else lines.push("PIANO DEL MESE: l'utente non ha ancora indicato quanto guadagna: chiedigli come è pagato (fisso, a ore, a percentuale, con straordinari) prima di fare previsioni sul mese prossimo.");
    const pc = findPlanChecks({ rows, monthlyIncome: plan.income.total || info.salary.monthly, answers: mp.answers, setAside: plan.setAsideTotal, today: now.toISOString().slice(0, 10), savingsHint: mp.savingsAccount });
    if (pc.length) lines.push(`ALTRE COSE DA CONFERMARE: ${pc.map((c) => c.text).join(' | ')}`);
  } catch { /* piano non disponibile */ }
  return lines.join('\n');
}

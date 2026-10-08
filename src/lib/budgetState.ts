import { budgetAlerts, type BudgetAlert } from '@/lib/budgetAlerts';
import { spendByCategory, type FinState0 } from '@/store/finance';

/** Avvisi di budget del mese in corso a partire da uno stato (o dallo store finanza). */
export function alertsFor(f: FinState0): BudgetAlert[] {
  const cur = f.months[0];
  if (!cur) return [];
  return budgetAlerts({ spent: spendByCategory([cur], f.categories), alloc: f.budget.alloc, guidelines: f.guidelines, salary: f.budget.salary });
}

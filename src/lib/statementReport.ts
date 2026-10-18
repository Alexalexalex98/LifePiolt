/**
 * Dopo il caricamento di un estratto conto: Theia lo analizza (in locale, senza inviare nulla) e lo racconta in chat.
 * L'approfondimento con l'AI parte solo dopo il consenso e manda un RIEPILOGO (totali per categoria), non i singoli movimenti.
 */
import { t } from '@/i18n/core';
import { alertsFor } from '@/lib/budgetState';
import { analyze, buildRecap } from '@/lib/financeRecap';
import { formatMoney } from '@/i18n/format';
import { useAssistant } from '@/store/assistant';
import { categoryOf, emergencyByMonth, useFin } from '@/store/finance';

const money = (n: number) => formatMoney(Math.round(n));

function input() {
  const f = useFin.getState();
  const now = new Date();
  const colors: Record<string, string> = {};
  f.categories.forEach((c) => { colors[c.n] = c.c; });
  return {
    months: f.months, catOf: (l: string) => categoryOf(l, f.categories), catColors: colors,
    billsMonthly: f.bills.reduce((s, b) => s + (b.freq === 'monthly' ? b.amount : b.amount / 12), 0),
    efTotal: f.months.reduce((s, m) => s + emergencyByMonth(m), 0),
    alerts: alertsFor(f).map((x) => ({ category: x.category, level: x.level, pct: x.pct })),
    day: now.getDate(), daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
  };
}

/** Riepilogo compatto (solo totali) da dare all'AI per l'approfondimento: niente descrizioni dei movimenti. */
export function statementSummary(): string {
  const inp = input();
  const an = analyze(inp);
  const lines = an.series.slice(-6).map((m) => `${m.label}: entrate ${money(m.income)}, uscite ${money(m.expense)}, risparmio ${money(m.income - m.expense)}`);
  const cats = Object.entries(an.basis?.byCat ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, amount]) => `${name}: ${money(amount)}`);
  return `Mesi (CHF):\n${lines.join('\n')}${cats.length ? `\n\nSpese per categoria nel mese di riferimento:\n${cats.join('\n')}` : ''}`;
}

/** Racconta in chat cosa c'e' nell'estratto appena caricato e propone cosa fare. */
export function announceStatement(summary: { added: number; months: number }) {
  const inp = input();
  const an = analyze(inp);
  const recap = buildRecap(an, inp);
  const head = t('Ho letto il tuo estratto conto: {0} movimenti in {1} {2}.', summary.added, summary.months, summary.months === 1 ? t('mese') : t('mesi'));
  const text = [head, ...recap.sentences].join('\n\n');
  useAssistant.getState().push({
    who: 'ai', source: 'chat', text,
    ext: { actions: [
      { kind: 'ai-analysis', label: t('Approfondisci con l’AI') },
      { kind: 'open', label: t('Apri la situazione'), page: 'lifefinance' },
      { kind: 'dismiss', label: t('Per ora basta') },
    ] },
  });
}

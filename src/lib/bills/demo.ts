/** Bollette di esempio per la modalita' demo (nomi inventati, scadenze relative a oggi). Puro. */
import { addDays } from './dates.ts';
import type { Invoice } from './types.ts';

export function demoInvoices(today: string, newId: () => string): Invoice[] {
  const at = `${today}T08:00:00.000Z`;
  const base = { currency: 'CHF', state: 'open' as const, remind: true, createdAt: at };
  const log = (d: number, text: string) => [{ at: `${addDays(today, d)}T08:00:00.000Z`, text }];
  return [
    {
      ...base, id: newId(), issuer: 'Energia Ticino SA', kind: 'luce', amount: 84.5, issueDate: addDays(today, -12), dueDate: addDays(today, 5),
      periodFrom: addDays(today, -72), periodTo: addDays(today, -13), number: 'ET-2026-10211', iban: 'CH93 0076 2011 6238 5295 7', recurrence: 'bimonthly', history: log(-12, 'Aggiunta'),
    },
    {
      ...base, id: newId(), issuer: 'Servizi Idrici Valle SA', kind: 'acqua', amount: 63.2, issueDate: addDays(today, -5), dueDate: addDays(today, 19),
      number: '55/2026', iban: 'CH93 0076 2011 6238 5295 7', recurrence: 'quarterly', history: log(-5, 'Aggiunta'),
    },
    {
      ...base, id: newId(), issuer: 'Studio dentistico Bernasconi', kind: 'medico', amount: 640, issueDate: addDays(today, -18), dueDate: addDays(today, 12),
      number: 'R-2026-3321', history: log(-18, 'Aggiunta'),
    },
    {
      ...base, id: newId(), issuer: 'Mobilnet Telefonia SA', kind: 'internet', amount: 49.9, issueDate: addDays(today, -33), dueDate: addDays(today, -3),
      number: '88221', lateFee: 10, reminderLevel: 1, recurrence: 'monthly', history: log(-33, 'Aggiunta'),
    },
    {
      ...base, id: newId(), issuer: 'Energia Ticino SA', kind: 'luce', amount: 79.1, state: 'paid', issueDate: addDays(today, -70), dueDate: addDays(today, -41),
      paidAt: addDays(today, -44), paidAmount: 79.1, number: 'ET-2026-08104', remind: false, history: [...log(-70, 'Aggiunta'), ...log(-44, 'Pagata')],
    },
  ];
}

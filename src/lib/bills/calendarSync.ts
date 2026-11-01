import { formatMoney } from '@/i18n/format';
import { useFin } from '@/store/finance';
import { syncBillCalendar } from './calendar';

let started = false;
/** Le scadenze di tutte le bollette (e di ogni rata di un piano di pagamento) stanno sempre nel Plan, sotto «Da pagare»: si aggiornano a ogni modifica, senza aprire il Plan. */
export function startBillCalendarSync(): void {
  if (started) return;
  started = true;
  const run = () => syncBillCalendar(useFin.getState().invoices, (i) => formatMoney(i.amount, { currency: i.currency, decimals: 2 }));
  run();
  let timer: ReturnType<typeof setTimeout> | undefined;
  useFin.subscribe((s, p) => { if (s.invoices === p.invoices) return; if (timer) clearTimeout(timer); timer = setTimeout(run, 400); });
}

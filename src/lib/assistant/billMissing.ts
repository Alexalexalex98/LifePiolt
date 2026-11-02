import { t } from '@/i18n/core';
import { monthName } from '@/i18n/format';
import { todayIso } from '@/lib/bills/dates';
import { pastUnpaid } from '@/lib/bills/installments';
import { findMissing, type Missing } from '@/lib/bills/missing';
import { go } from '@/lib/nav';
import { useAssistant } from '@/store/assistant';
import { useFin } from '@/store/finance';
import type { TheiaAction } from './theiaExt';

/** Le bollette e i pagamenti ricorrenti che non sono stati segnati: Theia chiede com'è andata, senza colpe, con tre risposte semplici. */
const push = (text: string, actions?: TheiaAction[]) => useAssistant.getState().push({ who: 'ai', text, source: 'chat', ext: actions?.length ? { actions } : undefined });
const act = (label: string, op: 'paid' | 'wait' | 'stop' | 'open', m: Missing): TheiaAction => ({ kind: 'bill-missing', label, op, invoiceId: m.invoiceId, mkind: m.kind, due: m.expectedDue });

export function askMissingBills(): number {
  const list = findMissing(useFin.getState().invoices, todayIso()).slice(0, 2);
  for (const m of list) {
    const month = monthName(Number(m.expectedDue.slice(5, 7)) - 1);
    push(t('Ho visto che la scadenza di {0} di {1} non risulta ancora segnata. Com\'è andata?', m.issuer, month), [
      act(t('L\'ho già pagata'), 'paid', m), act(t('Non è ancora arrivata'), 'wait', m), act(t('Non la ricevo più'), 'stop', m), act(t('Apri'), 'open', m),
    ]);
    // se la risposta non arriva, non si richiede prima di una settimana
    useFin.getState().patchInvoice(m.invoiceId, { askedAt: todayIso() });
  }
  return list.length + askPastInstallments();
}

/** Piani a rate caricati dopo che alcune scadenze erano già passate: chiedo quali sono già state pagate (una volta sola per piano). */
export function askPastInstallments(): number {
  let past = 0;
  for (const inv of useFin.getState().invoices) {
    if (past >= 1 || inv.state === 'paid' || inv.pastAsked || !inv.installments?.length) continue;
    const idx = pastUnpaid(inv, todayIso());
    if (!idx.length) { useFin.getState().patchInvoice(inv.id, { pastAsked: true }); continue; }
    const mk = (label: string, op: 'past-paid' | 'past-open'): TheiaAction => ({ kind: 'bill-missing', label, op, invoiceId: inv.id, mkind: 'past', due: inv.installments![idx[0]!]!.dueDate });
    push(idx.length === 1 ? t('Nel piano di {0} una rata ha la scadenza già passata. L\'hai già pagata?', inv.issuer) : t('Nel piano di {0} {1} rate hanno la scadenza già passata. Le hai già pagate?', inv.issuer, idx.length), [mk(idx.length === 1 ? t('Sì, è pagata') : t('Sì, tutte pagate'), 'past-paid'), mk(t('Scelgo io'), 'past-open'), { kind: 'dismiss', label: t('Non ancora') }]);
    useFin.getState().patchInvoice(inv.id, { pastAsked: true });
    past++;
  }
  return past;
}

export function runMissing(a: Extract<TheiaAction, { kind: 'bill-missing' }>): void {
  const fin = useFin.getState();
  const inv = fin.invoices.find((i) => i.id === a.invoiceId);
  if (!inv) { push(t('Non trovo più quella scadenza: la trovi nelle Bollette.')); return; }
  if (a.op === 'open' || a.op === 'past-open') { go('billDetail', { id: inv.id }); return; }
  if (a.op === 'past-paid') {
    const idx = pastUnpaid(inv, todayIso());
    idx.forEach((k) => useFin.getState().markInvoicePaid(inv.id, { installment: k, date: inv.installments![k]!.dueDate, amount: inv.installments![k]!.amount, record: false }));
    push(t('Perfetto, le ho segnate come pagate. Le prossime rate restano nel Piano alle loro date.'));
    return;
  }
  if (a.op === 'wait') { fin.patchInvoice(inv.id, { askedAt: todayIso() }); push(t('Va bene, nessun problema: te lo richiedo tra qualche giorno.')); return; }
  if (a.op === 'stop') {
    if (a.mkind === 'estimated') fin.delInvoice(inv.id);
    fin.invoices.filter((i) => i.issuer === inv.issuer && i.kind === inv.kind && i.recurrence).forEach((i) => fin.patchInvoice(i.id, { recurrence: undefined }, 'Ricorrenza tolta'));
    push(t('Fatto: non aspetto più «{0}» e non te lo chiederò più.', inv.issuer));
    return;
  }
  // «l'ho già pagata»: si segna pagata alla sua data e si prepara la scadenza del prossimo periodo
  let id = inv.id;
  if (a.mkind === 'gap') {
    id = fin.addInvoice({ issuer: inv.issuer, kind: inv.kind, amount: inv.amount, currency: inv.currency, dueDate: a.due, recurrence: inv.recurrence, estimated: false, remind: inv.remind, ...(inv.iban ? { iban: inv.iban } : {}) }, 'Aggiunta da Theia: pagamento ricorrente non segnato');
  }
  fin.patchInvoice(id, { estimated: false, askedAt: todayIso() });
  const cur = useFin.getState().invoices.find((i) => i.id === id)!;
  useFin.getState().markInvoicePaid(id, { date: a.due, amount: cur.amount, record: false });
  push(t('Perfetto, l\'ho segnata come pagata. Ho preparato la scadenza del prossimo periodo: se l\'importo cambia, aggiornalo quando arriva il documento.'));
}

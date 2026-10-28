/** Cancellazioni che l'utente può fare da più posti (Finanza, Frigo, Impostazioni): sempre con conferma e con «Annulla» subito dopo. */
import { alertT } from '@/lib/alert';
import { refreshBillReminders } from '@/lib/bills/schedule';
import { useFin } from '@/store/finance';
import { usePantry } from '@/store/pantry';
import { showUndoToast, toast } from '@/store/toast';

/** Tutti i dati di finanza personale (LifePoints e investimenti restano). */
export function confirmClearFinance(): void {
  alertT('Cancellare tutti i dati di finanza?', 'Verranno tolti movimenti, budget, spese fisse, bollette, fatture, dati fiscali e i dati dell’estratto. I LifePoints e gli investimenti non si toccano. Subito dopo puoi annullare.', [
    { text: 'Annulla', style: 'cancel' },
    { text: 'Cancella tutto', style: 'destructive', onPress: () => { const snap = useFin.getState().clearPersonalFinance(); void refreshBillReminders().catch(() => {}); showUndoToast('Dati di finanza cancellati', () => { useFin.getState().restoreFinance(snap); void refreshBillReminders().catch(() => {}); }); } },
  ]);
}

/** Tutte le scorte del frigo (la lista della spesa non cambia). */
export function confirmClearFridge(): void {
  const n = usePantry.getState().items.length;
  if (!n) { toast('Il frigo è già vuoto'); return; }
  alertT('Svuotare il frigo?', `Verranno tolte tutte le scorte che hai segnato (${n}). La lista della spesa non cambia. Subito dopo puoi annullare.`, [
    { text: 'Annulla', style: 'cancel' },
    { text: 'Svuota', style: 'destructive', onPress: () => { const before = usePantry.getState().clearItems(); showUndoToast('Frigo svuotato', () => usePantry.getState().restoreItems(before)); } },
  ]);
}

/** Tutta la lista della spesa (le scorte del frigo non cambiano). */
export function confirmClearShopping(): void {
  const n = usePantry.getState().shop.length;
  if (!n) { toast('La lista della spesa è già vuota'); return; }
  alertT('Cancellare la lista della spesa?', `Verranno tolte tutte le voci (${n}). Le scorte del frigo non cambiano. Subito dopo puoi annullare.`, [
    { text: 'Annulla', style: 'cancel' },
    { text: 'Cancella', style: 'destructive', onPress: () => { const before = usePantry.getState().clearShop(); showUndoToast('Lista della spesa cancellata', () => usePantry.getState().restoreShop(before)); } },
  ]);
}

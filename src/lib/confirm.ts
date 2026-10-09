import { alertT } from './alert';
import { showUndoToast } from '@/store/toast';

/**
 * Ogni eliminazione chiede conferma e, se possibile, si può annullare subito dopo.
 * confirmDelete('l\'obiettivo «X»', () => { ...elimina... }, () => { ...ripristina... })
 */
export function confirmDelete(what: string, onConfirm: () => void, onUndo?: () => void, opts?: { title?: string; okLabel?: string; undoMessage?: string }) {
  alertT(opts?.title ?? 'Eliminare?', `Vuoi eliminare ${what}? ${onUndo ? 'Potrai annullare subito dopo.' : 'L\'azione non si può annullare.'}`, [
    { text: 'Annulla', style: 'cancel' },
    {
      text: opts?.okLabel ?? 'Elimina',
      style: 'destructive',
      onPress: () => {
        onConfirm();
        if (onUndo) showUndoToast(opts?.undoMessage ?? 'Eliminato', onUndo);
      },
    },
  ]);
}

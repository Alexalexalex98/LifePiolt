import { go } from '@/lib/nav';
import { t } from '@/i18n/core';
import { toast } from '@/store/toast';
import type { Att } from '@/lib/attachments';

type Ctx = { keys: () => string[] };
let known: boolean | undefined;

/** La schermata `billReview` (creata da un altro agente) esiste in questa build? Si controlla nei file delle rotte; se non si riesce a verificare si prova comunque. */
export function billReviewExists(): boolean {
  if (known !== undefined) return known;
  try {
    // Metro risolve `require.context` in fase di build: deve restare una chiamata letterale
    // @ts-expect-error `require.context` è fornito da Metro, non dai tipi di Node
    known = (require.context('../../app/(tabs)', false, /^\.\/billReview\.tsx?$/) as Ctx).keys().length > 0;
  } catch { known = true; }
  return known;
}

/** Apre l'analisi di una bolletta/fattura; se la schermata non c'è ancora dice "Presto disponibile". */
export function openBillReview(a: Pick<Att, 'uri' | 'mime' | 'name' | 'text'>) {
  try {
    if (!billReviewExists()) { toast(t('Presto disponibile')); return; }
    go('billReview', { uri: a.uri ?? '', mime: a.mime ?? '', name: a.name });
  } catch { toast(t('Presto disponibile')); }
}

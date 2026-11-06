import { t } from '@/i18n/core';
import { askSend, logSend } from '@/lib/aiConsent';
import { AiServerError, aiReadFiles, aiServerConfigured } from '@/lib/aiServer';
import type { Captured } from '@/lib/warrantyScan';
import { WARRANTY_PROMPT, parseWarranty, type Read } from '@/lib/warranty';

/** Theia legge la fattura o lo scontrino e ne ricava prodotti, data e durata della garanzia. Con il tuo consenso; senza AI i dati si scrivono a mano. */
export async function readWarranty(c: Captured, today: string): Promise<{ ok: true; data: Read } | { ok: false; message: string }> {
  if (!aiServerConfigured) return { ok: false, message: t('Theia con l\'AI non è collegata: inserisci i dati a mano.') };
  if (!(await askSend('files', t('Fattura, scontrino o garanzia')))) return { ok: false, message: t('Va bene, non invio il documento: inserisci i dati a mano.') };
  try {
    const files = c.pages.length ? c.pages.slice(0, 4).map((uri) => ({ uri, mime: 'image/jpeg' })) : c.pdf ? [{ uri: c.pdf, mime: 'application/pdf' }] : [];
    if (!files.length) return { ok: false, message: t('Non trovo il documento da leggere.') };
    logSend('files', 0, files.map((f) => f.mime));
    const r = parseWarranty(await aiReadFiles(WARRANTY_PROMPT, files, 70000, 1600), today);
    return r ? { ok: true, data: r } : { ok: false, message: t('Non sono riuscita a leggere i dati: puoi inserirli a mano.') };
  } catch (e) { return { ok: false, message: e instanceof AiServerError ? e.message : t('Dammi un attimo e riproviamo.') }; }
}

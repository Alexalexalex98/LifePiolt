import { t } from '@/i18n/core';
import { analysisHtml, analyzePeriod, diaryBookHtml, periodOf } from '@/lib/journalCore';
import { useApp } from '@/store/app';
import { useJournal } from '@/store/journal';

/** Crea il PDF e apre il menu di condivisione: lo scegli tu a chi mandarlo. Niente parte da solo. `what`: solo l'analisi oppure il diario intero. */
export async function shareJournal(what: 'analysis' | 'diary', days: number): Promise<{ ok: boolean; message?: string }> {
  try {
    const { from, to } = periodOf(days); const entries = Object.values(useJournal.getState().entries);
    const name = useApp.getState().account?.name || undefined;
    const html = what === 'analysis' ? analysisHtml(analyzePeriod(entries, from, to), name) : diaryBookHtml(entries, from, to, name);
    const Sharing = await import('expo-sharing');
    if (!(await Sharing.isAvailableAsync())) return { ok: false, message: t('La condivisione dei file non è disponibile su questo dispositivo.') };
    const Print = await import('expo-print');
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: what === 'analysis' ? t('L\'analisi del tuo diario') : t('Il tuo diario'), UTI: 'com.adobe.pdf' });
    return { ok: true };
  } catch { return { ok: false, message: t('Non sono riuscito a creare il file: riprova.') }; }
}

import { t } from '@/i18n/core';
import { toast } from '@/store/toast';

/** Crea un PDF da HTML e lo apre nel foglio di condivisione (salva, invia, stampa). */
export async function sharePdf(html: string, name: string): Promise<boolean> {
  try {
    const Print = await import('expo-print'); const Sharing = await import('expo-sharing');
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: name, UTI: 'com.adobe.pdf' }); return true; }
    toast(t('Non riesco ad aprire il PDF su questo dispositivo.')); return false;
  } catch { toast(t('Non sono riuscita a creare il PDF.')); return false; }
}
/** Salva un testo (per esempio un CSV per Excel) e lo apre nel foglio di condivisione. */
export async function shareFile(name: string, content: string, mime = 'text/csv'): Promise<boolean> {
  try {
    const { File, Paths } = await import('expo-file-system'); const Sharing = await import('expo-sharing');
    const f = new File(Paths.cache, `${Date.now().toString(36)}-${name.replace(/[^\w.\-]+/g, '_')}`); f.create({ overwrite: true }); f.write(content);
    if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(f.uri, { mimeType: mime, dialogTitle: name }); return true; }
    toast(t('Non riesco ad aprire il file su questo dispositivo.')); return false;
  } catch { toast(t('Non sono riuscita a creare il file.')); return false; }
}

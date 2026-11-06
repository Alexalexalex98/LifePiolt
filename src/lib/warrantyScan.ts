import { Camera, CameraView } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { pickFromGallery, takePhoto } from '@/components/theia/images';
import { t } from '@/i18n/core';
import { imageForAi } from '@/lib/aiServer';
import { toast } from '@/store/toast';

/** Un documento acquisito: le pagine come immagini e il PDF. Una scansione, una foto o un file arrivano tutti allo stesso modo. */
export type Captured = { pdf?: string; pages: string[]; source: 'scan' | 'foto' | 'file' };
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Copia il file in un posto che dura: la cache dello scanner si svuota da sola. */
export function keepFile(uri: string, ext: string): string {
  if (Platform.OS === 'web') return uri;
  try {
    const dir = new Directory(Paths.document, 'garanzie'); if (!dir.exists) dir.create();
    const dest = new File(dir, `${uid()}.${ext}`); new File(uri).copy(dest); return dest.uri;
  } catch { return uri; }
}

/** Foto → PDF di una pagina, così la fattura si conserva sempre come PDF. */
export async function imageToPdf(uri: string): Promise<string | null> {
  try {
    const img = await imageForAi(uri, 1800, 0.8); if (!img) return null;
    const Print = await import('expo-print');
    const html = `<html><body style="margin:0;padding:0"><img src="data:image/jpeg;base64,${img.base64}" style="width:100%"/></body></html>`;
    const { uri: pdf } = await Print.printToFileAsync({ html, width: 595, height: 842 });
    return keepFile(pdf, 'pdf');
  } catch { return null; }
}

/** Scanner del sistema (come Genius Scan): trova i bordi, raddrizza, più pagine. iPhone: VisionKit; Android: ML Kit. */
export async function scanDocument(): Promise<Captured | null> {
  if (Platform.OS === 'web') { toast(t('La scansione funziona sul telefono. Qui puoi scegliere una foto o un file.')); return null; }
  try {
    const perm = await Camera.requestCameraPermissionsAsync();
    if (!perm.granted) { toast(t('Permesso fotocamera negato: abilitalo dalle impostazioni del telefono.')); return null; }
    const r = await CameraView.scanDocumentAsync({ requestPdf: true, quality: 0.9 });
    if (!r || !r.pages?.length) return null;
    const pages = r.pages.map((p) => keepFile(p, 'jpg')); const pdf = r.pdfUri ? keepFile(r.pdfUri, 'pdf') : await imageToPdf(pages[0]!);
    return { pages, ...(pdf ? { pdf } : {}), source: 'scan' };
  } catch { toast(t('Lo scanner non è disponibile su questo telefono: usa una foto o un file.')); return null; }
}

/** Una foto (scattata o dalla galleria): diventa un PDF di una pagina. */
export async function fromPhoto(src: 'camera' | 'gallery'): Promise<Captured | null> {
  try {
    const r = await (src === 'camera' ? takePhoto(1) : pickFromGallery(1)); const uri = r[0]?.uri; if (!uri) return null;
    const page = keepFile(uri, 'jpg'); const pdf = await imageToPdf(page);
    return { pages: [page], ...(pdf ? { pdf } : {}), source: 'foto' };
  } catch (e) { toast(e instanceof Error ? e.message : t('Non riesco ad aprire la foto.')); return null; }
}

/** Un PDF o un'immagine già sul telefono (per esempio la fattura arrivata per email). */
export async function fromFile(): Promise<Captured | null> {
  try {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true }); const f = r.assets?.[0]; if (r.canceled || !f) return null;
    if ((f.mimeType ?? '').startsWith('image/')) { const page = keepFile(f.uri, 'jpg'); const pdf = await imageToPdf(page); return { pages: [page], ...(pdf ? { pdf } : {}), source: 'file' }; }
    return { pages: [], pdf: keepFile(f.uri, 'pdf'), source: 'file' };
  } catch { toast(t('Non riesco ad aprire il file.')); return null; }
}

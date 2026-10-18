/**
 * Scelta, lettura locale e salvataggio dei file di bollette e fatture. Tutto resta SUL TELEFONO:
 * la copia va nella memoria dell'app e in LifeDrive (cartella "Bollette e fatture"), mai in rete.
 */
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform, Share } from 'react-native';

import { t } from '@/i18n/core';
import { fmtBytes } from '@/lib/docCheck';
import { uid, weekdayShortDate } from '@/lib/format';
import { readPickedText } from '@/lib/readPicked';
import { useLife } from '@/store/life';
import { extractPdfText } from './pdfText';

export const BILL_FOLDER = 'Bollette e fatture';

export type PickedBill = { uri: string; name: string; mime?: string; size?: number; file?: unknown };
export type PickResult = { ok: true; file: PickedBill } | { ok: false; canceled?: boolean; message: string };

const ext = (n: string) => (n.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1] ?? '');
export function fileKind(f: { name: string; mime?: string }): 'pdf' | 'image' | 'text' | 'other' {
  const e = ext(f.name), m = f.mime ?? '';
  if (e === 'pdf' || m === 'application/pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif'].includes(e) || m.startsWith('image/')) return 'image';
  if (['txt', 'csv', 'tsv', 'md', 'xml', 'json'].includes(e) || m.startsWith('text/') || m === 'application/json') return 'text';
  return 'other';
}

export async function pickFile(): Promise<PickResult> {
  try {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: ['application/pdf', 'image/*', 'text/*', 'text/csv', 'application/vnd.ms-excel'] });
    if (r.canceled || !r.assets[0]) return { ok: false, canceled: true, message: '' };
    const a = r.assets[0];
    return { ok: true, file: { uri: a.uri, name: a.name, mime: a.mimeType, size: a.size, file: (a as { file?: unknown }).file } };
  } catch { return { ok: false, message: t('Impossibile aprire i file') }; }
}

export async function pickPhoto(camera: boolean): Promise<PickResult> {
  try {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return { ok: false, message: camera ? t('Serve il permesso della fotocamera') : t('Serve il permesso di accedere alle foto') };
    const opts: ImagePicker.ImagePickerOptions = { preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible, mediaTypes: ['images'], quality: 0.9 };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled || !r.assets[0]) return { ok: false, canceled: true, message: '' };
    const a = r.assets[0];
    return { ok: true, file: { uri: a.uri, name: a.fileName ?? `Bolletta ${weekdayShortDate().replace('/', '-')}.jpg`, mime: a.mimeType ?? 'image/jpeg', size: a.fileSize, file: (a as { file?: unknown }).file } };
  } catch { return { ok: false, message: t('Impossibile aprire le foto') }; }
}

export async function readBytes(f: { uri: string; file?: unknown }): Promise<Uint8Array> {
  if (Platform.OS === 'web') {
    const b = f.file as Blob | undefined;
    return new Uint8Array(b && typeof b.arrayBuffer === 'function' ? await b.arrayBuffer() : await (await fetch(f.uri)).arrayBuffer());
  }
  try { return new Uint8Array(await new File(f.uri).arrayBuffer()); } catch { return new Uint8Array(await (await fetch(f.uri)).arrayBuffer()); }
}

export type LocalRead =
  | { kind: 'text'; text: string; note?: string }
  | { kind: 'no_text'; why: 'image' | 'pdf_scan' | 'pdf_encrypted' | 'other'; message: string }
  | { kind: 'error'; message: string };

/** Prova a ottenere il TESTO del file sul telefono (txt/csv e PDF con livello di testo). Per immagini e scansioni non c'e' OCR locale. */
export async function readLocally(f: PickedBill): Promise<LocalRead> {
  try {
    const k = fileKind(f);
    if (k === 'text') {
      const text = await readPickedText({ uri: f.uri, file: f.file });
      return text.trim().length > 10 ? { kind: 'text', text } : { kind: 'error', message: t('Il file di testo è vuoto.') };
    }
    if (k === 'pdf') {
      const r = extractPdfText(await readBytes(f));
      if (r.ok) return { kind: 'text', text: r.text, note: r.quality === 'incerta' ? t('Il testo del PDF è stato letto in modo incerto: controlla bene i campi.') : undefined };
      if (r.reason === 'encrypted') return { kind: 'no_text', why: 'pdf_encrypted', message: t('Il PDF è protetto da password: non posso leggerlo sul telefono. Compila i campi a mano guardando il documento.') };
      if (r.reason === 'no_text') return { kind: 'no_text', why: 'pdf_scan', message: t('Questo PDF è una scansione (non contiene testo): sul telefono non c\'è ancora un lettore di immagini. Compila i campi a mano guardando il documento, oppure scegli di leggerlo con un\'AI esterna.') };
      return { kind: 'error', message: t('Non sono riuscito a leggere il PDF.') };
    }
    if (k === 'image') return { kind: 'no_text', why: 'image', message: t('Una foto non contiene testo leggibile dal telefono (non c\'è ancora un lettore di immagini offline). Compila i campi a mano guardando la foto, oppure scegli di leggerla con un\'AI esterna.') };
    return { kind: 'no_text', why: 'other', message: t('Formato non supportato per la lettura automatica. Compila i campi a mano.') };
  } catch { return { kind: 'error', message: t('Non sono riuscito a leggere il file.') }; }
}

/** Su web gli URI blob spariscono al ricaricamento: i file piccoli diventano data URL. Sul telefono si copia nella memoria dell'app. */
export async function persistBillFile(f: PickedBill): Promise<string> {
  if (Platform.OS === 'web') {
    if (f.uri.startsWith('data:') || (f.size ?? 0) > 1024 * 1024) return f.uri;
    try {
      const blob = await (await fetch(f.uri)).blob();
      return await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
    } catch { return f.uri; }
  }
  try {
    const dir = new Directory(Paths.document, 'bills');
    if (!dir.exists) dir.create();
    const dest = new File(dir, `${uid()}${ext(f.name) ? '.' + ext(f.name) : ''}`);
    new File(f.uri).copy(dest);
    return dest.uri;
  } catch { return f.uri; }
}

/** Copia il file nella memoria dell'app e lo aggiunge a LifeDrive. Restituisce uri e id del file in LifeDrive. */
export async function storeBillFile(f: PickedBill): Promise<{ uri: string; driveId?: string }> {
  const uri = await persistBillFile(f);
  const life = useLife.getState();
  life.addFile({ n: f.name, s: fmtBytes(f.size) || '—', folder: BILL_FOLDER, date: weekdayShortDate(), uri });
  const added = useLife.getState().drive.filter((d) => d.uri === uri).pop();
  return { uri, driveId: added?.id };
}

/** Toglie da LifeDrive il file collegato (con annulla: restituisce cio' che e' stato tolto). */
export function dropBillFile(driveId?: string, uri?: string) {
  const life = useLife.getState();
  const gone = life.drive.filter((d) => (driveId && d.id === driveId) || (uri && d.uri === uri && d.folder === BILL_FOLDER));
  gone.forEach((g) => life.delFile(g.id));
  return gone;
}

/** Apre il file originale: sul web in una nuova scheda, sul telefono con il foglio di condivisione di sistema. */
export function openBillFile(f: { uri: string; name: string }): boolean {
  try {
    if (Platform.OS === 'web') { (globalThis as { open?: (u: string, t: string) => unknown }).open?.(f.uri, '_blank'); return true; }
    void Share.share({ message: f.name, url: f.uri });
    return true;
  } catch { return false; }
}

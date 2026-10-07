import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Linking, Platform } from 'react-native';

import type { FileRef } from '@/data/skillBank';
import { persistFile } from '@/lib/chatMedia';

/** Sul web gli URL dei file scelti (blob:) muoiono alla chiusura della pagina: i file piccoli diventano data URL, così restano nel salvataggio. */
const WEB_INLINE_MAX = 1_500_000;
async function stable(uri: string, size?: number): Promise<string> {
  if (Platform.OS !== 'web' || uri.startsWith('data:') || (size != null && size > WEB_INLINE_MAX)) return uri;
  try {
    const blob = await (await fetch(uri)).blob();
    if (blob.size > WEB_INLINE_MAX) return uri;
    return await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  } catch { return uri; }
}

/** Sceglie uno o più file (pdf, xlsx, docx, immagini, zip...) e li copia nella memoria dell'app. */
export async function pickFiles(multiple = true): Promise<FileRef[]> {
  const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple });
  if (r.canceled) return [];
  return Promise.all(r.assets.map(async (a) => ({ uri: await stable(persistFile(a.uri, a.name), a.size), name: a.name, size: a.size, mime: a.mimeType })));
}

export async function pickImages(multiple = false): Promise<FileRef[]> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: multiple, quality: 0.8 });
  if (r.canceled) return [];
  return Promise.all(r.assets.map(async (a, i) => {
    const name = a.fileName ?? `immagine-${Date.now()}-${i}.jpg`;
    return { uri: await stable(persistFile(a.uri, name), a.fileSize), name, size: a.fileSize, mime: a.mimeType ?? 'image/jpeg' };
  }));
}

export const isImage = (f: FileRef) => !!f.mime?.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic)$/i.test(f.name) || f.uri.startsWith('data:image/');

/** Scarica / apre il file. Se il file ha un contenuto in linea (file di esempio) lo crea al volo. */
export async function openFile(f: FileRef): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      const href = f.text != null ? `data:${f.mime ?? 'text/plain'};charset=utf-8,${encodeURIComponent(f.text)}` : f.uri;
      const a = document.createElement('a');
      a.href = href; a.download = f.name; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      return true;
    }
    let uri = f.uri;
    if (f.text != null) {
      const file = new File(Paths.cache, f.name);
      file.create({ overwrite: true });
      file.write(f.text);
      uri = file.uri;
    }
    await Linking.openURL(uri);
    return true;
  } catch {
    return false;
  }
}

export const fmtBytes = (b?: number) => (b == null ? '' : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} kB`);

/** Legge un file di testo (es. un CSV scelto dal telefono). */
export async function readText(f: FileRef): Promise<string> {
  if (f.text != null) return f.text;
  if (Platform.OS === 'web' || f.uri.startsWith('data:')) return (await fetch(f.uri)).text();
  return new File(f.uri).text();
}

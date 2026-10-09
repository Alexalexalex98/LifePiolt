import * as Contacts from 'expo-contacts';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { uid } from '@/lib/format';
import type { Media, MsgKind } from '@/store/chat';

export type Picked = { kind: MsgKind; media?: Media; location?: { lat: number; lng: number; label?: string }; contact?: { name: string; phone?: string } };

/** Copia il file nella memoria dell'app, così resta disponibile anche se l'originale sparisce. */
export function persistFile(uri: string, name?: string): string {
  if (Platform.OS === 'web') return uri;
  try {
    const dir = new Directory(Paths.document, 'chat');
    if (!dir.exists) dir.create();
    const ext = (name ?? uri).match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? '';
    const dest = new File(dir, `${uid()}${ext}`);
    new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}

function fromAsset(a: ImagePicker.ImagePickerAsset): Picked {
  const isVideo = a.type === 'video';
  return {
    kind: isVideo ? 'video' : 'image',
    media: { uri: persistFile(a.uri, a.fileName ?? undefined), w: a.width, h: a.height, mime: a.mimeType, name: a.fileName ?? undefined, size: a.fileSize, durationMs: a.duration ?? undefined },
  };
}

export async function pickFromGallery(): Promise<Picked[]> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: 10, quality: 0.8 });
  return r.canceled ? [] : r.assets.map(fromAsset);
}

export async function takePhoto(): Promise<Picked[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Permesso fotocamera negato: abilitalo da Impostazioni.');
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
  return r.canceled ? [] : r.assets.map(fromAsset);
}

export async function pickDocument(): Promise<Picked[]> {
  const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: true });
  if (r.canceled) return [];
  return r.assets.map((a) => ({ kind: 'file' as const, media: { uri: persistFile(a.uri, a.name), name: a.name, size: a.size, mime: a.mimeType } }));
}

export async function currentLocation(): Promise<Picked> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) throw new Error('Permesso posizione negato: abilitalo da Impostazioni.');
  const p = await Location.getCurrentPositionAsync({});
  let label: string | undefined;
  try {
    const [a] = await Location.reverseGeocodeAsync(p.coords);
    label = [a?.street, a?.city].filter(Boolean).join(', ') || undefined;
  } catch { /* indirizzo facoltativo */ }
  return { kind: 'location', location: { lat: p.coords.latitude, lng: p.coords.longitude, label } };
}

export async function pickContact(): Promise<Picked | null> {
  const perm = await Contacts.requestPermissionsAsync();
  if (!perm.granted) throw new Error('Permesso contatti negato: abilitalo da Impostazioni.');
  const c = await Contacts.presentContactPickerAsync();
  if (!c) return null;
  return { kind: 'contact', contact: { name: c.name || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Contatto', phone: c.phoneNumbers?.[0]?.number } };
}

export const fmtSize = (b?: number) => (b == null ? '' : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} kB`);

/** Riduce la lista di livelli di metering (dB) a barre 0..1 per la forma d'onda. */
export function toWaveform(levels: number[], bars = 32): number[] {
  if (!levels.length) return Array.from({ length: bars }, () => 0.2);
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const a = Math.floor((i * levels.length) / bars), b = Math.max(a + 1, Math.floor(((i + 1) * levels.length) / bars));
    const slice = levels.slice(a, b);
    const db = slice.reduce((s, x) => s + x, 0) / slice.length; // da -60 a 0
    out.push(Math.min(1, Math.max(0.08, (db + 60) / 60)));
  }
  return out;
}

/** Pulisce un numero per tel: / sms: / wa.me. */
export const cleanPhone = (p: string) => p.replace(/[^\d+]/g, '');

/** Salva il contatto in rubrica (apre il modulo nativo precompilato, come WhatsApp). */
export async function saveContactToBook(name: string, phone?: string): Promise<boolean> {
  const perm = await Contacts.requestPermissionsAsync();
  if (!perm.granted) throw new Error('Permesso contatti negato: abilitalo da Impostazioni.');
  const clean = name.replace(/\s*\(.*\)\s*$/, '').trim() || name;
  const [first, ...rest] = clean.split(' ');
  const res = await Contacts.presentFormAsync(null, {
    firstName: first,
    lastName: rest.join(' ') || undefined,
    note: name !== clean ? name.slice(clean.length).replace(/[()]/g, '').trim() : undefined,
    phoneNumbers: phone ? [{ label: 'mobile', number: phone }] : undefined,
  } as never, { isNew: true } as never);
  return res !== undefined;
}

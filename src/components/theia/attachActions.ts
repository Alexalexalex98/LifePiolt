import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { currentLocation, persistFile, pickContact, readTextFile } from '@/lib/chatMedia';
import { t } from '@/i18n/core';
import {
  DOC_PICKER_TYPES, admit, canExtractLocally, docTypeOf, fmtBytes, looksLikeBill, rejectSummary, titleFromText, truncateText,
  type Att,
} from '@/lib/attachments';
import { uid } from '@/lib/format';
import { notePreview, noteTitle } from '@/lib/notes';
import { MAX_IMAGES } from '@/lib/assistant/imageCore';
import { prepare, takePhoto as takeImage } from './images';
import type { DriveFile, Note } from '@/store/life';

/** Esito di una scelta: gli allegati nuovi e, se qualcosa è stato scartato, un messaggio chiaro (italiano, già tradotto). */
export type Added = { atts: Att[]; notice?: string };

const rejectNotice = (rej: Parameters<typeof rejectSummary>[0]) => (rej.length ? t(rejectSummary(rej)) : undefined);

const imageAtt = (a: Awaited<ReturnType<typeof prepare>>, i: number): Att => ({ id: a.id, kind: 'image', name: `${t('Foto')} ${i}`, uri: a.uri, mime: a.mime, width: a.width, height: a.height });

/** Scatta una foto con la fotocamera (permesso richiesto qui). */
export async function addPhoto(current: Att[]): Promise<Added> {
  const imgs = current.filter((a) => a.kind === 'image').length;
  if (imgs >= MAX_IMAGES) return { atts: [], notice: t('Puoi allegare al massimo {0} immagini.', MAX_IMAGES) };
  const got = await takeImage(1);
  const { ok, rejected } = admit(current.length, got.map((g) => ({ ...g, name: 'foto.jpg' })), { skipClassify: true });
  return { atts: ok.map((g, i) => imageAtt(g, imgs + i + 1)), notice: rejectNotice(rejected) };
}

/** Foto e video dalla galleria. Le foto vengono ridotte; i video restano com'erano. */
export async function addGallery(current: Att[]): Promise<Added> {
  const room = Math.max(0, 6 - current.length);
  if (room <= 0) return { atts: [], notice: t('Puoi allegare al massimo {0} elementi.', 6) };
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: room > 1, selectionLimit: room, quality: 1, exif: false });
  if (r.canceled) return { atts: [] };
  const imgBudget = Math.max(0, MAX_IMAGES - current.filter((a) => a.kind === 'image').length);
  let imgs = 0;
  const wanted = r.assets.filter((a) => (a.type === 'video' ? true : imgs++ < imgBudget));
  const { ok, rejected } = admit(current.length, wanted.map((a) => ({ a, name: a.fileName ?? (a.type === 'video' ? 'video.mp4' : 'foto.jpg'), size: a.fileSize, mime: a.mimeType })), { skipClassify: true });
  const out: Att[] = [];
  for (const { a, name } of ok) {
    if (a.type === 'video') out.push({ id: uid(), kind: 'document', name, uri: persistFile(a.uri, name), mime: a.mimeType ?? 'video/mp4', size: a.fileSize, docType: 'other' });
    else out.push(imageAtt(await prepare(a), current.filter((x) => x.kind === 'image').length + out.filter((x) => x.kind === 'image').length + 1));
  }
  const skippedImgs = r.assets.filter((a) => a.type !== 'video').length - wanted.filter((a) => a.type !== 'video').length;
  const notice = rejectNotice(rejected) ?? (skippedImgs > 0 ? t('Puoi allegare al massimo {0} immagini.', MAX_IMAGES) : undefined);
  return { atts: out, notice };
}

async function sizeOf(uri: string, given?: number): Promise<number | undefined> {
  if (given != null) return given;
  if (Platform.OS === 'web') return undefined;
  try { return new File(uri).size; } catch { return undefined; }
}

/** Documenti dal telefono (PDF, Word, Excel/CSV, testo, ZIP...), anche più di uno. I file di testo semplice si leggono in locale. */
export async function addFiles(current: Att[]): Promise<Added> {
  if (current.length >= 6) return { atts: [], notice: t('Puoi allegare al massimo {0} elementi.', 6) };
  const r = await DocumentPicker.getDocumentAsync({ type: DOC_PICKER_TYPES, multiple: true, copyToCacheDirectory: true });
  if (r.canceled) return { atts: [] };
  const sized = await Promise.all(r.assets.map(async (a) => ({ a, name: a.name, mime: a.mimeType ?? undefined, size: await sizeOf(a.uri, a.size ?? undefined) })));
  const { ok, rejected } = admit(current.length, sized);
  const out: Att[] = [];
  for (const { a, name, mime, size } of ok) {
    const docType = docTypeOf(name, mime);
    let text: string | undefined, truncated: boolean | undefined;
    if (canExtractLocally(name, mime)) {
      const raw = await readTextFile(a.uri);
      if (raw != null && raw.trim()) { const tr = truncateText(raw); text = tr.text; truncated = tr.truncated; }
    }
    out.push({ id: uid(), kind: 'document', name, uri: persistFile(a.uri, name), mime, size, docType, text, truncated, billish: looksLikeBill(name, text) });
  }
  return { atts: out, notice: rejectNotice(rejected) };
}

/** Testo incollato o scritto qui: diventa un allegato di testo. */
export function addPasted(current: Att[], text: string): Added {
  const clean = text.trim();
  if (!clean) return { atts: [], notice: t('Scrivi o incolla un testo.') };
  if (current.length >= 6) return { atts: [], notice: t('Puoi allegare al massimo {0} elementi.', 6) };
  const tr = truncateText(clean);
  return { atts: [{ id: uid(), kind: 'text', name: titleFromText(clean), text: tr.text, truncated: tr.truncated, size: clean.length, billish: looksLikeBill('', tr.text) }], notice: tr.truncated ? t('Testo lungo: allego i primi caratteri.') : undefined };
}

export async function addLocation(current: Att[]): Promise<Added> {
  if (current.length >= 6) return { atts: [], notice: t('Puoi allegare al massimo {0} elementi.', 6) };
  const p = await currentLocation();
  const l = p.location!;
  return { atts: [{ id: uid(), kind: 'location', name: l.label ?? t('Posizione attuale'), lat: l.lat, lng: l.lng, sub: `${l.lat.toFixed(4)}, ${l.lng.toFixed(4)}` }] };
}

export async function addContact(current: Att[]): Promise<Added> {
  if (current.length >= 6) return { atts: [], notice: t('Puoi allegare al massimo {0} elementi.', 6) };
  const p = await pickContact();
  if (!p?.contact) return { atts: [] };
  return { atts: [{ id: uid(), kind: 'contact', name: p.contact.name, sub: p.contact.phone }] };
}

export function noteAtt(n: Note): Att {
  const tr = truncateText(n.text);
  return { id: uid(), kind: 'note', name: noteTitle(n.text), text: tr.text, truncated: tr.truncated, sub: notePreview(n.text).slice(0, 60) };
}

export async function driveAtt(f: DriveFile): Promise<Att> {
  const mime = undefined;
  let text: string | undefined, truncated: boolean | undefined;
  if (f.uri && canExtractLocally(f.n, mime)) {
    const raw = await readTextFile(f.uri);
    if (raw != null && raw.trim()) { const tr = truncateText(raw); text = tr.text; truncated = tr.truncated; }
  }
  return { id: uid(), kind: 'document', name: f.n, uri: f.uri, docType: docTypeOf(f.n), sub: f.s ? fmtBytes(parseSize(f.s)) || f.s : undefined, text, truncated, billish: looksLikeBill(f.n, text) };
}

/** "1,2 MB" / "340 kB" di LifeDrive -> byte (solo per mostrare la dimensione). */
function parseSize(s: string): number | undefined {
  const m = /([\d.,]+)\s*(kb|mb|gb)/i.exec(s);
  if (!m) return undefined;
  const n = parseFloat(m[1].replace(',', '.'));
  const mult = m[2].toLowerCase() === 'kb' ? 1024 : m[2].toLowerCase() === 'mb' ? 1048576 : 1073741824;
  return Number.isFinite(n) ? Math.round(n * mult) : undefined;
}

export function eventAtt(day: string, ev: { time: string; title: string; place?: string }): Att {
  return { id: uid(), kind: 'event', name: ev.title, sub: `${day} ${ev.time}${ev.place ? `, ${ev.place}` : ''}` };
}

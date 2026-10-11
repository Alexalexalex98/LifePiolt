import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { persistFile } from '@/lib/chatMedia';
import { uid } from '@/lib/format';
import { t } from '@/i18n/core';
import { fitSize, JPEG_QUALITY, MAX_IMAGES } from '@/lib/assistant/imageCore';
import type { ExtImage } from '@/lib/assistant/theiaExt';

export { MAX_IMAGES } from '@/lib/assistant/imageCore';

export type Attachment = ExtImage & { id: string };

/** Riduce e comprime (JPEG 0.8, max 1600 px) e copia nella memoria dell'app. Se la compressione fallisce tiene l'originale. */
async function prepare(a: ImagePicker.ImagePickerAsset): Promise<Attachment> {
  const w = a.width ?? 0, h = a.height ?? 0;
  const fit = fitSize(w, h);
  let uri = a.uri, width = w, height = h;
  try {
    const actions = fit.scaled ? [{ resize: w >= h ? { width: fit.width } : { height: fit.height } }] : [];
    const out = await manipulateAsync(a.uri, actions, { compress: JPEG_QUALITY, format: SaveFormat.JPEG });
    uri = out.uri; width = out.width; height = out.height;
  } catch { /* resta l'originale */ }
  return { id: uid(), uri: persistFile(uri, 'img.jpg'), mime: 'image/jpeg', width, height };
}

/** Messaggi d'errore (testo sorgente italiano). */
export const DENIED_CAMERA = 'Permesso fotocamera negato: abilitalo dalle impostazioni del telefono.';
export const DENIED_PHOTOS = 'Permesso foto negato: abilitalo dalle impostazioni del telefono.';

export async function pickFromGallery(room: number): Promise<Attachment[]> {
  if (room <= 0) throw new Error(t('Puoi allegare al massimo {0} immagini.', MAX_IMAGES));
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted && perm.accessPrivileges !== 'limited') throw new Error(t(DENIED_PHOTOS));
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: room > 1, selectionLimit: room, quality: 1, exif: false });
  if (r.canceled) return [];
  return Promise.all(r.assets.slice(0, room).map(prepare));
}

export async function takePhoto(room: number): Promise<Attachment[]> {
  if (room <= 0) throw new Error(t('Puoi allegare al massimo {0} immagini.', MAX_IMAGES));
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error(t(DENIED_CAMERA));
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
  if (r.canceled) return [];
  return Promise.all(r.assets.slice(0, 1).map(prepare));
}

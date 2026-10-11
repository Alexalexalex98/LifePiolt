import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { persistFile } from '@/lib/chatMedia';
import { PICK_TYPES, checkSize, type LessonKind } from '@/lib/club';

export type PickedFile = { uri: string; fileName: string; size?: number; mime?: string; durationSec?: number };

/**
 * Sceglie un file dal telefono e lo copia nella memoria dell'app (nessun upload).
 * Ritorna null se si annulla; lancia Error con un messaggio in italiano per permessi negati o file troppo grandi.
 * Su web il file resta valido finche' la pagina e' aperta (limite del browser).
 */
export async function pickClubFile(kind: LessonKind | 'image'): Promise<PickedFile | null> {
  if (kind === 'video' || kind === 'image') {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) throw new Error(perm.canAskAgain === false ? 'Permesso alla libreria negato: abilitalo da Impostazioni del telefono.' : 'Senza il permesso alla libreria non posso mostrarti i file. Riprova e consenti l\'accesso.');
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: kind === 'video' ? ['videos'] : ['images'], allowsMultipleSelection: false, quality: 0.85 });
    if (r.canceled || !r.assets[0]) return null;
    const a = r.assets[0];
    const err = checkSize(kind, a.fileSize);
    if (err) throw new Error(err);
    return { uri: persistFile(a.uri, a.fileName ?? undefined), fileName: a.fileName ?? (kind === 'video' ? 'video' : 'immagine'), size: a.fileSize, mime: a.mimeType, durationSec: a.duration ? a.duration / 1000 : undefined };
  }
  const types = kind === 'audio' || kind === 'pdf' || kind === 'file' ? PICK_TYPES[kind] : ['*/*'];
  const r = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  const err = checkSize(kind, a.size);
  if (err) throw new Error(err);
  return { uri: persistFile(a.uri, a.name), fileName: a.name, size: a.size ?? undefined, mime: a.mimeType ?? undefined };
}

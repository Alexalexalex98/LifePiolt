import * as ImagePicker from 'expo-image-picker';
import { persistFile } from '@/lib/chatMedia';

/** La foto scelta si copia nello spazio dell'app: l'indirizzo del selettore è temporaneo e dopo un po' non esiste più (foto del profilo e copertina sparivano). */
const keepUri = (u: string | null | undefined): string | null => (u ? persistFile(u) : null);

/** Sceglie una foto da galleria o fotocamera. Ritorna l'uri oppure null (annullato o permesso negato: l'errore è un messaggio italiano). */
export async function pickImage(source: 'gallery' | 'camera', opts?: { aspect?: [number, number]; quality?: number }): Promise<{ uri: string | null; error?: string }> {
  try {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return { uri: null, error: 'Per scattare serve il permesso alla fotocamera: puoi attivarlo dalle impostazioni del telefono o scegliere dalla galleria.' };
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: opts?.quality ?? 0.7, exif: false, aspect: opts?.aspect });
      return { uri: r.canceled ? null : keepUri(r.assets[0]?.uri) };
    }
    const r = await ImagePicker.launchImageLibraryAsync({ preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible, mediaTypes: ['images'], quality: opts?.quality ?? 0.7, exif: false, aspect: opts?.aspect });
    return { uri: r.canceled ? null : keepUri(r.assets[0]?.uri) };
  } catch {
    return { uri: null, error: source === 'camera' ? 'Fotocamera non disponibile su questo dispositivo: scegli dalla galleria.' : 'Non riesco ad aprire la galleria.' };
  }
}

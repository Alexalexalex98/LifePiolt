import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const REMOTE = /^(https?:|data:|blob:)/i;

/**
 * Legge i byte di un file del telefono SENZA passare da fetch: in Expo Go il fetch nativo puo' mancare («ExpoFetchModule»)
 * e fa cadere l'operazione. Prima legge il file; se il telefono non lo lascia leggere dall'indirizzo originale lo copia nella cache e legge la copia.
 */
export async function readUriBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS === 'web' || REMOTE.test(uri)) return new Uint8Array(await (await fetch(uri)).arrayBuffer());
  try { return await new File(uri).bytes(); }
  catch {
    const copy = new File(Paths.cache, `rd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
    new File(uri).copy(copy);
    try { return await copy.bytes(); } finally { try { copy.delete(); } catch { /* la cache si svuota da sola */ } }
  }
}

export const bytesToBase64 = (buf: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
};

import { Platform } from 'react-native';

/**
 * Rotazione schermo. L'app resta in verticale ovunque (lockPortrait all'avvio) e la stanza live
 * la sblocca (unlockRotation) per permettere video verticale e orizzontale.
 * app.json ha orientation "default": senza questo blocco iOS/Android ruoterebbero tutte le schermate.
 * Non funziona su web ne' in Expo Go se il modulo manca: ogni chiamata e' difensiva.
 */
type SO = typeof import('expo-screen-orientation');
async function mod(): Promise<SO | null> {
  if (Platform.OS === 'web') return null;
  try { return await import('expo-screen-orientation'); } catch { return null; }
}

export async function lockPortrait(): Promise<void> {
  const so = await mod();
  if (!so) return;
  try { await so.lockAsync(so.OrientationLock.PORTRAIT_UP); } catch (e) { console.warn('lockPortrait', e); }
}
export async function unlockRotation(): Promise<void> {
  const so = await mod();
  if (!so) return;
  try { await so.lockAsync(so.OrientationLock.DEFAULT); } catch (e) { console.warn('unlockRotation', e); }
}

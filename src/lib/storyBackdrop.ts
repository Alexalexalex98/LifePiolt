import { captureScreen } from 'react-native-view-shot';

/** Istantanea della schermata da cui si apre un recap: si vede dietro mentre lo si tira giù per chiuderlo. */
let uri: string | null = null;
export const backdropUri = () => uri;
export const clearBackdrop = () => { uri = null; };

/** Scatta la schermata (al massimo 400 ms di attesa, poi si apre comunque). */
export async function snapBackdrop(): Promise<void> {
  try {
    const shot = captureScreen({ format: 'jpg', quality: 0.5, result: 'tmpfile' }).then((u) => { uri = u; }).catch(() => { uri = null; });
    await Promise.race([shot, new Promise<void>((r) => setTimeout(r, 400))]);
  } catch { uri = null; }
}

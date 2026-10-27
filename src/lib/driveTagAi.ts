/**
 * Capire cos'è una foto o un file di LifeDrive e dargli il tag giusto. Prima si prova dal nome (gratis, sul telefono); se non basta e
 * hai dato il permesso («Consenti sempre» ai file, oppure lo concedi tu in quel momento) lo guarda l'AI e risponde con una sola etichetta.
 */
import { askSend, logSend } from '@/lib/aiConsent';
import { aiReadFiles, aiServerConfigured } from '@/lib/aiServer';
import { setDriveTag } from '@/lib/driveSave';
import { GENERIC_TAGS, TAG_PROMPT, guessTagFromName, parseTag } from '@/lib/driveTag';
import { useAiRouter } from '@/store/aiRouter';
import { useLife } from '@/store/life';

const always = () => { const v = useAiRouter.getState().fileConsent.files as unknown; return v === true || v === 'always'; };
const mimeOf = (uri: string, photo?: boolean) => (/\.pdf(\?|$)/i.test(uri) ? 'application/pdf' : photo || /\.(jpe?g|png|heic|webp)(\?|$)/i.test(uri) ? 'image/jpeg' : '');

/** Tagga un file di LifeDrive. `ask`: se manca il permesso «sempre», chiede ora. Restituisce il tag scelto (o null se non si è capito). */
export async function aiTagFile(id: string, ask = false): Promise<string | null> {
  const f = useLife.getState().drive.find((d) => d.id === id);
  if (!f) return null;
  const byName = guessTagFromName(f.n);
  if (byName && GENERIC_TAGS.includes(f.tag ?? 'Altro')) { setDriveTag(id, byName, false); if (!aiServerConfigured || !f.uri) return byName; }
  const mime = f.uri ? mimeOf(f.uri, f.photo) : '';
  if (!aiServerConfigured || !f.uri || !mime) return byName;
  if (!always() && !(ask && (await askSend('files', f.n)))) return byName;
  try {
    logSend('files', 0, [mime]);
    const tag = parseTag(await aiReadFiles(TAG_PROMPT, [{ uri: f.uri, mime }], 60000, 800));
    if (tag) { setDriveTag(id, tag, true); return tag; }
  } catch { /* se l'AI non risponde resta il tag che c'era */ }
  return byName;
}

/** Appena una foto arriva da una chat: se hai già dato il permesso la guarda e la tagga da sola, altrimenti resta «Chat» (la puoi analizzare dal file). */
export async function autoTagUri(uri: string): Promise<void> {
  const f = useLife.getState().drive.find((d) => d.orig === uri || d.uri === uri);
  if (!f || f.tagChecked) return;
  if (!always()) { const g = guessTagFromName(f.n); if (g) setDriveTag(f.id, g, false); return; }
  await aiTagFile(f.id, false);
}

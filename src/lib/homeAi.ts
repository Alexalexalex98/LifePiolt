import { t } from '@/i18n/core';
import { askSend, logSend } from '@/lib/aiConsent';
import { AiServerError, aiServerConfigured, aiVision, imageForAi } from '@/lib/aiServer';
import { BEFORE_PROMPT, FLOORPLAN_PROMPT, afterPrompt, parseRoomsJson, parseVerdict, type Room, type Verdict } from '@/lib/homeCare';

/** AI per la casa: planimetria e prima/dopo. Sempre con il consenso e mai obbligatoria: senza AI si fa tutto a mano. */
type R<T> = { ok: true; data: T } | { ok: false; message: string };
const gate = async (what: string): Promise<string | null> => {
  if (!aiServerConfigured) return t('Theia con l\'AI non è collegata: puoi fare tutto a mano.');
  if (!(await askSend('files', what))) return t('Va bene, non invio la foto: la tieni solo sul telefono.');
  return null;
};
const fail = (e: unknown) => (e instanceof AiServerError ? e.message : t('Dammi un attimo e riproviamo.'));

export async function readFloorplan(uri: string): Promise<R<Omit<Room, 'id'>[]>> {
  const g = await gate(t('Foto della planimetria di casa')); if (g) return { ok: false, message: g };
  try {
    logSend('files', 0, ['image/jpeg']);
    const img = await imageForAi(uri); if (!img) return { ok: false, message: t('Non riesco a leggere la foto.') };
    const rooms = parseRoomsJson(await aiVision(img.base64, img.mime, FLOORPLAN_PROMPT));
    return rooms.length ? { ok: true, data: rooms } : { ok: false, message: t('Non ho riconosciuto stanze: prova con una foto più nitida o aggiungile a mano.') };
  } catch (e) { return { ok: false, message: fail(e) }; }
}
export async function describeBefore(uri: string): Promise<R<string>> {
  const g = await gate(t('Foto di una zona della casa prima del riordino')); if (g) return { ok: false, message: g };
  try { logSend('files', 0, ['image/jpeg']); const img = await imageForAi(uri); if (!img) return { ok: false, message: t('Non riesco a leggere la foto.') }; return { ok: true, data: (await aiVision(img.base64, img.mime, BEFORE_PROMPT)).trim().slice(0, 400) }; } catch (e) { return { ok: false, message: fail(e) }; }
}
export async function judgeAfter(uri: string, before: string): Promise<R<Verdict>> {
  const g = await gate(t('Foto della zona dopo il riordino')); if (g) return { ok: false, message: g };
  try { logSend('files', 0, ['image/jpeg']); const img = await imageForAi(uri); if (!img) return { ok: false, message: t('Non riesco a leggere la foto.') }; return { ok: true, data: parseVerdict(await aiVision(img.base64, img.mime, afterPrompt(before))) }; } catch (e) { return { ok: false, message: fail(e) }; }
}

/** Prima e dopo insieme: il permesso si chiede una volta sola, poi Theia guarda il prima e confronta con il dopo. */
export async function reviewTidy(beforeUri: string, afterUri: string, knownBefore?: string): Promise<R<{ note: string; verdict: Verdict }>> {
  const g = await gate(t('Foto del prima e del dopo di una zona della casa')); if (g) return { ok: false, message: g };
  try {
    logSend('files', 0, ['image/jpeg', 'image/jpeg']);
    let note = knownBefore ?? '';
    if (!note) { const b = await imageForAi(beforeUri); if (!b) return { ok: false, message: t('Non riesco a leggere la foto.') }; note = (await aiVision(b.base64, b.mime, BEFORE_PROMPT)).trim().slice(0, 400); }
    const a = await imageForAi(afterUri); if (!a) return { ok: false, message: t('Non riesco a leggere la foto.') };
    return { ok: true, data: { note, verdict: parseVerdict(await aiVision(a.base64, a.mime, afterPrompt(note))) } };
  } catch (e) { return { ok: false, message: fail(e) }; }
}

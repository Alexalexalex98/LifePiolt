/** Legge i turni di lavoro da un PDF o da una foto. Il testo del PDF si legge sul telefono; all'AI va solo dopo il consenso. */
import { t } from '@/i18n/core';
import { askSend, logSend } from '@/lib/aiConsent';
import { AiServerError, aiChatRaw, aiReadFiles, aiServerConfigured } from '@/lib/aiServer';
import { readLocally } from '@/lib/bills/files';
import { parseShiftsReply, shiftsPrompt, type NewShift } from '@/lib/shiftsImport';
import { useApp } from '@/store/app';

export type ShiftsRead = { ok: true; shifts: NewShift[] } | { ok: false; error: string };

export async function readShiftsFile(file: { uri: string; name?: string; mime?: string; size?: number }): Promise<ShiftsRead> {
  if (!aiServerConfigured) return { ok: false, error: t('Per leggere i turni serve il servizio AI, che qui non è collegato.') };
  try {
    const mime = file.mime ?? 'application/pdf';
    const isImage = mime.startsWith('image/');
    const read = isImage ? null : await readLocally({ uri: file.uri, name: file.name ?? 'turni.pdf', mime, size: file.size });
    if (!(await askSend('files', `${file.name ?? t('Foto')} · ${t('turni di lavoro')}`))) return { ok: false, error: t('Non invio il file: senza il permesso non posso leggere i turni.') };
    logSend('files', 0, ['turni di lavoro']);
    const who = useApp.getState().account.name;
    const reply = read && read.kind === 'text' && read.text.trim().length > 120
      ? await aiChatRaw(shiftsPrompt(who, read.text), 'turni di lavoro')
      : await aiReadFiles(shiftsPrompt(who), [{ uri: file.uri, mime }], 120000, 1600);
    const shifts = parseShiftsReply(reply);
    if (!shifts.length) return { ok: false, error: t('Non riesco a leggere i turni da questo file. Controlla che si veda il tuo nome e le date, oppure scrivimeli tu.') };
    return { ok: true, shifts };
  } catch (e) { return { ok: false, error: e instanceof AiServerError ? e.message : t('Non sono riuscita a leggere il file: riprova tra poco.') }; }
}

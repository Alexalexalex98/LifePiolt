/** Carica il PDF del nutrizionista e ne fa il piano alimentare dell'app. Il testo si legge sul telefono; all'AI va solo il testo, dopo il consenso. */
import { t } from '@/i18n/core';
import { askSend, logSend } from '@/lib/aiConsent';
import { AiServerError, aiChatRaw, aiReadFiles, aiServerConfigured } from '@/lib/aiServer';
import { readLocally } from '@/lib/bills/files';
import { applyMealPlan } from '@/lib/assistant/planDelivery';
import { PLAN_PDF_PROMPT, parsePlanReply } from './planPdf';

export type PlanPdfResult = { ok: true; title: string; days: number; avg: number; skipped: number } | { ok: false; error: string };

export async function importPlanPdf(file: { uri: string; name?: string; mime?: string; size?: number }): Promise<PlanPdfResult> {
  if (!aiServerConfigured) return { ok: false, error: t('Per leggere il piano serve il servizio AI, che qui non è collegato.') };
  try {
    const read = await readLocally({ uri: file.uri, name: file.name ?? 'piano.pdf', mime: file.mime ?? 'application/pdf', size: file.size });
    if (!(await askSend('files', `${file.name ?? 'PDF'} · ${t('piano alimentare')}`))) return { ok: false, error: t('Non invio il file: senza il permesso non posso leggere il piano.') };
    logSend('files', 0, ['piano alimentare']);
    /* PDF con il testo: si legge qui e all'AI va solo il testo; scansione o foto: la legge l'AI come immagine */
    const reply = read.kind === 'text' && read.text.trim().length > 150
      ? await aiChatRaw(PLAN_PDF_PROMPT(read.text), 'piano nutrizionista')
      : await aiReadFiles(PLAN_PDF_PROMPT('(il piano e\' nel file allegato)'), [{ uri: file.uri, mime: file.mime ?? 'application/pdf' }], 120000, 1400);
    const json = parsePlanReply(reply);
    const r = applyMealPlan(json, 'nutrizionista', true);
    if (!r.ok) return { ok: false, error: t('Non sono riuscita a leggere pasti e alimenti da questo file. Controlla che sia il piano del nutrizionista, oppure raccontami a voce cosa c\'è scritto.') };
    return { ok: true, title: r.title, days: r.days.length, avg: r.avg, skipped: r.skipped };
  } catch (e) { return { ok: false, error: e instanceof AiServerError ? e.message : t('Non sono riuscita a leggere il file: riprova tra poco.') }; }
}

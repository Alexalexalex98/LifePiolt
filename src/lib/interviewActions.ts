import { t } from '@/i18n/core';
import { confirmDelete } from '@/lib/confirm';
import { dayKeyOf, fmtDateTime, fmtRange, hhmm } from '@/lib/when';
import { addToPlanWithCheck, removeFromPlan, restoreToPlan } from '@/lib/planBooking';
import { companyView, displayName, type Interview, type Share, type Slot } from '@/lib/interview';
import { useApp } from '@/store/app';
import { useJobs, type Application, type Job } from '@/store/jobs';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

/**
 * Azioni del flusso colloquio con i loro effetti collaterali (notifiche, Plan, promemoria).
 * Le regole stanno in lib/interview.ts; qui si orchestrano store, notifiche e Plan.
 *
 * ONESTA': senza server le notifiche arrivano solo a chi usa questo telefono. Se l'altra parte e' un utente demo,
 * la sua risposta si simula dalle schede "Anteprima" (vedi simulate*).
 */
export const refOf = (appId: string) => `job:${appId}`;
export const meName = () => useApp.getState().account.name;
export const fmtSlot = (s: Slot) => fmtRange(s.start, s.durationMin);
export const tzNow = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } };
export const LANGS = ['Italiano', 'English', 'Deutsch', 'Français', 'Español', 'Português'];

const find = (appId: string): { app: Application; job: Job } | null => {
  const st = useJobs.getState();
  const app = st.applications.find((a) => a.id === appId);
  const job = app ? st.jobs.find((j) => j.id === app.jobId) : undefined;
  return app && job ? { app, job } : null;
};
const notifyMe = (text: string, appId: string, urgent = false) => useNet.getState().notify('job', text, urgent, { kind: 'lavoro', ref: refOf(appId) });

/** Colloquio nel Plan di chi usa questo telefono (candidato o azienda). Il ref `job:<id>` permette di toglierlo. */
function placeInMyPlan(app: Application, job: Job, slot: Slot) {
  const me = meName();
  const title = job.owner === me ? t('Colloquio con {0} · {1}', displayName(app.candidate), job.title) : t('Colloquio · {0} ({1})', job.title, job.company);
  addToPlanWithCheck({ day: dayKeyOf(slot.start), time: hhmm(slot.start), durationMin: slot.durationMin, title, ref: refOf(app.id), verb: t('Conferma') });
}

export function inviteCandidate(appId: string, input: { slots: Slot[]; tz: string; lang: string; message?: string }): boolean {
  const f = find(appId); if (!f) return false;
  const ok = useJobs.getState().inviteInterview(appId, input);
  if (!ok) return false;
  if (f.app.candidate === meName()) notifyMe(t('{0} ti invita a un colloquio conoscitivo in videochiamata per “{1}”.', f.job.company, f.job.title), appId);
  return true;
}

export function acceptInvite(appId: string, slotIdx: number, share: Share): boolean {
  const f = find(appId); if (!f) return false;
  const ok = useJobs.getState().acceptInterview(appId, slotIdx, share);
  if (!ok) return false;
  const iv = find(appId)!.app.iv!;
  if (iv.chosen && (meName() === f.app.candidate || meName() === f.job.owner)) placeInMyPlan(f.app, f.job, iv.chosen);
  if (f.job.owner === meName()) notifyMe(t('{0} ha accettato il colloquio: {1}.', displayName(f.app.candidate), fmtSlot(iv.chosen!)), appId);
  return true;
}

export function proposeAnother(appId: string, slot: Slot): boolean {
  const f = find(appId); if (!f) return false;
  const ok = useJobs.getState().proposeOther(appId, slot);
  if (ok && f.job.owner === meName()) notifyMe(t('{0} propone un’altra fascia: {1}.', displayName(f.app.candidate), fmtSlot(slot)), appId);
  return ok;
}

export function acceptCounterSlot(appId: string): boolean {
  const f = find(appId); if (!f) return false;
  const ok = useJobs.getState().acceptCounter(appId);
  if (!ok) return false;
  const chosen = find(appId)!.app.iv!.chosen!;
  placeInMyPlan(f.app, f.job, chosen);
  if (f.app.candidate === meName()) notifyMe(t('{0} ha accettato la fascia che hai proposto: {1}.', f.job.company, fmtSlot(chosen)), appId);
  return true;
}

export function declineInvite(appId: string, reason: string): boolean {
  const f = find(appId); if (!f) return false;
  const ok = useJobs.getState().declineInterview(appId, reason);
  if (!ok) return false;
  removeFromPlan(refOf(appId));
  if (f.job.owner === meName()) notifyMe(t('{0} non può partecipare al colloquio.', displayName(f.app.candidate)), appId);
  return true;
}

/** L'azienda chiama: il candidato riceve "chiamata in arrivo". */
export function callCandidate(appId: string): boolean {
  const f = find(appId); if (!f) return false;
  const ok = useJobs.getState().callCandidate(appId);
  if (ok && f.app.candidate === meName()) notifyMe(t('Chiamata in arrivo da {0} per il colloquio “{1}”.', f.job.company, f.job.title), appId, true);
  return ok;
}

/** Il candidato risponde: SBLOCCA il contatto con la scelta fatta in accettazione. */
export function answerIncoming(appId: string): boolean {
  const f = find(appId); if (!f) return false;
  const ok = useJobs.getState().answerCall(appId);
  if (ok && f.job.owner === meName()) notifyMe(t('{0} ha risposto: il contatto scelto è sbloccato.', displayName(f.app.candidate)), appId);
  return ok;
}

export function rejectIncoming(appId: string): boolean {
  const f = find(appId); if (!f) return false;
  const ok = useJobs.getState().declineCall(appId);
  if (ok && f.job.owner === meName()) notifyMe(t('{0} non ha risposto alla chiamata.', displayName(f.app.candidate)), appId);
  return ok;
}

export const cancelCallNow = (appId: string): boolean => useJobs.getState().cancelCall(appId);

export function finishWith(appId: string, result: 'next' | 'rejected', reasons: string[], note: string): boolean {
  const f = find(appId); if (!f) return false;
  const ok = useJobs.getState().finishInterview(appId, result, reasons, note);
  if (ok && f.app.candidate === meName()) notifyMe(result === 'next' ? t('{0}: si va avanti dopo il colloquio.', f.job.company) : t('{0}: esito del colloquio disponibile.', f.job.company), appId);
  return ok;
}

/** Ritiro della candidatura: sempre possibile, con conferma e annulla. Toglie anche il colloquio dal Plan. */
let planUndo: ReturnType<typeof removeFromPlan> = null;
export function withdrawApplication(appId: string, after?: () => void) {
  const f = find(appId); if (!f) return;
  confirmDelete(t('la candidatura per “{0}”', f.job.title), () => {
    const removed = useJobs.getState().removeApplication(appId);
    planUndo = removeFromPlan(refOf(appId));
    if (removed) after?.();
  }, () => {
    useJobs.getState().restoreApplication(f.app);
    restoreToPlan(planUndo);
  }, { title: t('Ritirare la candidatura?'), okLabel: t('Ritira'), undoMessage: t('Candidatura ritirata') });
}

/** Cosa mostrare all'azienda del candidato (nome e, solo se sbloccato e consentito, il contatto). */
export const companyViewOf = (app: Application) => companyView(app.candidate, app.iv);

/* ---------- anteprima: simula l'altra parte quando e' un utente demo su questo telefono ---------- */
export const isDemo = () => useApp.getState().demo;
/** Contatti d'esempio di un candidato demo (dati inventati, segnati come tali nella UI). */
export const demoShare = (full: string): Share => {
  const base = full.toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/);
  return { fullName: true, email: `${base[0] ?? 'candidato'}@esempio.test`, phone: '+41 79 000 00 00' };
};
export function simulateCandidateAccepts(appId: string): boolean {
  const f = find(appId); const iv = f?.app.iv;
  if (!f || !iv) return false;
  return acceptInvite(appId, 0, demoShare(f.app.candidate));
}
export function simulateCandidateAnswers(appId: string): boolean { return answerIncoming(appId); }
export function simulateCandidateRejects(appId: string): boolean { return rejectIncoming(appId); }
export function simulateCompanyCalls(appId: string): boolean { return callCandidate(appId); }

export const when = (ts: number) => fmtDateTime(ts);
export type { Interview };

/** Solo anteprima/demo: porta il colloquio fissato a tra 2 minuti, per provare chiamata e sblocco senza aspettare. */
export function demoStartSoon(appId: string): boolean {
  const f = find(appId); const iv = f?.app.iv;
  if (!f || !iv?.chosen || !isDemo() || (iv.stage !== 'accepted' && iv.stage !== 'missed')) return false;
  const chosen: Slot = { ...iv.chosen, start: Date.now() + 2 * 60000 };
  useJobs.setState((s) => ({ applications: s.applications.map((x) => (x.id === appId && x.iv ? { ...x, iv: { ...x.iv, chosen, stage: 'accepted', firstCallAt: undefined } } : x)) }));
  removeFromPlan(refOf(appId));
  placeInMyPlan(f.app, f.job, chosen);
  return true;
}

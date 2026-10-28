/** Analisi delle 4 foto del corpo con l'AI: la stessa dalla pagina e dalla chat con Theia. Le foto restano solo sul telefono. */
import { askSend, logSend } from '@/lib/aiConsent';
import { tidy } from '@/lib/aiPersona';
import { AiServerError, aiReadFiles, aiServerConfigured } from '@/lib/aiServer';
import { BODY_REPEAT_DAYS, BODY_SLOTS, bodyPrompt } from '@/lib/fitness/bodyCheck';
import { scheduleAt } from '@/lib/notify';
import { useBodyCheck } from '@/store/bodyCheck';
import { useFitness } from '@/store/fitness';

export type BodyRunResult = { ok: true; text: string; id: string } | { ok: false; error: string };

export async function runBodyAnalysis(): Promise<BodyRunResult> {
  const bc = useBodyCheck.getState();
  if (BODY_SLOTS.some((s) => !bc.photos[s.id])) return { ok: false, error: 'Servono tutte e 4 le foto: davanti, dietro, lato sinistro e lato destro.' };
  if (!aiServerConfigured) return { ok: false, error: 'L\'AI non è collegata in questa app.' };
  if (!(await askSend('body', 'Davanti, dietro, lato sinistro e lato destro'))) return { ok: false, error: 'Non invio niente: senza il tuo permesso l\'analisi non parte.' };
  try {
    const files = BODY_SLOTS.map((s) => ({ uri: bc.photos[s.id]!, mime: 'image/jpeg' }));
    logSend('body', 0, ['4 foto del corpo']);
    const b = useFitness.getState().body; const last = bc.reports[0];
    const reply = await aiReadFiles(bodyPrompt({ sex: b?.sex, age: b?.age, weightKg: b?.weightKg, heightCm: b?.heightCm, goal: b?.goal, activity: b?.activity }, last ? { ts: last.ts, text: last.text } : undefined), files, 120000, 1100);
    const text = tidy(reply);
    if (!text) return { ok: false, error: 'Non ho ricevuto una risposta: riprova tra poco.' };
    const id = useBodyCheck.getState().addReport(text, { ...bc.photos });
    /* tra un po' ti ricordo di rifare le foto, per vedere i progressi */
    void scheduleAt('body-photos', new Date(Date.now() + BODY_REPEAT_DAYS * 86400000), 'Foto del corpo', 'Sono passate 4 settimane: rifai le 4 foto per vedere i tuoi progressi.', undefined, 'promemoria').catch(() => undefined);
    return { ok: true, text, id };
  } catch (e) { return { ok: false, error: e instanceof AiServerError ? e.message : 'Non sono riuscito a contattare il servizio AI.' }; }
}

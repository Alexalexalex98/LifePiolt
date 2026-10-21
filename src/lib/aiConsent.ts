/**
 * Consenso prima di mandare foto o file al servizio AI (Google Gemini, dal nostro server).
 *  - 'food': la foto di un piatto; 'files': foto e documenti in chat (bollette, PDF...); 'summary': solo il testo di un pasto o i valori medi dell'alimentazione.
 *  Per entrambi: consenti una volta / consenti sempre / non consentire (si cambia nelle impostazioni).
 * Senza consenso il file resta sul telefono e Theia non lo legge. Il contenuto non viene mai registrato: nel registro finiscono solo tipo e dimensione.
 */
import { alertT } from '@/lib/alert';
import { useAiRouter } from '@/store/aiRouter';

export type SendKind = 'food' | 'files' | 'summary';

const WARN = 'Se non consenti, Theia non potrà capire file, foto e documenti: li terrò solo sul telefono.';

/** Vecchio valore salvato (true/false) -> nuova scelta. */
const modeOf = (v: unknown): 'ask' | 'always' | 'never' => (v === true || v === 'always' ? 'always' : v === 'never' ? 'never' : 'ask');

/** Vero se si puo' inviare. Mostra la domanda solo quando serve: Consenti una volta / Consenti sempre / Non consentire. */
export function askSend(kind: SendKind, what?: string): Promise<boolean> {
  const st = useAiRouter.getState();
  const mode = modeOf(st.fileConsent[kind]);
  if (mode === 'always') return Promise.resolve(true);
  if (mode === 'never') return Promise.resolve(false);
  return new Promise((resolve) => {
    const head = kind === 'food' ? 'Inviare la foto del piatto al servizio AI?' : kind === 'summary' ? 'Inviare questi valori al servizio AI?' : 'Inviare questo file al servizio AI?';
    const body = `${what ? `${what}\n\n` : ''}${kind === 'summary'
      ? 'Per darti un parere più dettagliato devo mandare al servizio AI (Google Gemini), tramite il server di LifePilot, solo il testo con i valori del pasto o le medie dei nutrienti. Niente foto, nome, salute in generale, finanze o contatti.'
      : kind === 'food'
      ? 'Per riconoscere gli alimenti devo mandare la foto al servizio AI (Google Gemini), tramite il server di LifePilot. Non invio altro: né salute, né finanze, né contatti.'
      : 'Per leggerlo devo mandarlo al servizio AI (Google Gemini), tramite il server di LifePilot. Non invio altro: né salute, né finanze, né contatti.'}\n\n${WARN}`;
    alertT(head, body, [
      { text: 'Non consentire', style: 'cancel', onPress: () => { st.setFileConsent({ [kind]: 'never' }); resolve(false); } },
      { text: 'Consenti sempre', onPress: () => { st.setFileConsent({ [kind]: 'always' }); resolve(true); } },
      { text: 'Consenti una volta', onPress: () => resolve(true) },
    ]);
  });
}

/** Registro "Cosa è stato inviato": solo tipo e dimensione, mai il contenuto. */
export function logSend(kind: SendKind, bytes: number, parts: string[]) {
  useAiRouter.getState().addLog({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), kind: 'vision_read', provider: 'Google Gemini', bytes, parts, redacted: 0 });
}

/**
 * Per il vecchio percorso (senza server AI collegato) chiede PRIMA il consenso e, se arriva, apre l'AI esterna per quella richiesta
 * anche se in Intelligenza di Theia era su «Solo sul telefono». Con «Consenti una volta» la scelta torna com'era a richiesta finita.
 * Chiamare `restore()` alla fine (anche in caso di errore).
 */
export async function askSendRouted(kind: SendKind, what?: string): Promise<{ ok: boolean; restore: () => void }> {
  if (!(await askSend(kind, what))) return { ok: false, restore: () => {} };
  const st = useAiRouter.getState();
  const was = st.prefs.phoneOnly;
  if (was) st.setPrefs({ phoneOnly: false });
  const always = modeOf(useAiRouter.getState().fileConsent[kind]) === 'always';
  return { ok: true, restore: () => { if (was && !always) useAiRouter.getState().setPrefs({ phoneOnly: true }); } };
}

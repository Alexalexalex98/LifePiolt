/**
 * Consenso prima di mandare foto o file al servizio AI (Google Gemini, dal nostro server).
 *  - 'food': la foto di un piatto; 'files': foto e documenti in chat (bollette, PDF...).
 *  Per entrambi: consenti una volta / consenti sempre / non consentire (si cambia nelle impostazioni).
 * Senza consenso il file resta sul telefono e Theia non lo legge. Il contenuto non viene mai registrato: nel registro finiscono solo tipo e dimensione.
 */
import { alertT } from '@/lib/alert';
import { useAiRouter } from '@/store/aiRouter';

export type SendKind = 'food' | 'files';

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
    const head = kind === 'food' ? 'Inviare la foto del piatto al servizio AI?' : 'Inviare questo file al servizio AI?';
    const body = `${what ? `${what}\n\n` : ''}${kind === 'food'
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

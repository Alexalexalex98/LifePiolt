/**
 * Consenso prima di mandare foto o file al servizio AI (modelli aperti su Cloudflare, dal nostro server).
 *  - 'food': la foto di un piatto; 'files': foto e documenti in chat (bollette, PDF...); 'summary': solo il testo di un pasto o i valori medi dell'alimentazione.
 *  Per entrambi: consenti una volta / consenti sempre / non consentire (si cambia nelle impostazioni).
 * Senza consenso il file resta sul telefono e Theia non lo legge. Il contenuto non viene mai registrato: nel registro finiscono solo tipo e dimensione.
 */
import { alertT } from '@/lib/alert';
import { translateText } from '@/i18n/core';
import { CATS, gate, labelOf, pushConsent } from '@/lib/privacyCenter';
import { useAiRouter } from '@/store/aiRouter';

export type SendKind = 'food' | 'files' | 'summary' | 'data' | 'body';

const WARN = 'Se non consenti, Theia non potrà capire file, foto e documenti: li terrò solo sul telefono.';
const WARN_DATA = 'Se non consenti, rispondo senza guardare i tuoi dati: restano solo sul telefono.';

/** Vecchio valore salvato (true/false) -> nuova scelta. */
const modeOf = (v: unknown): 'ask' | 'always' | 'never' => (v === true || v === 'always' ? 'always' : v === 'never' ? 'never' : 'ask');

/** Vero se si puo' inviare. Mostra la domanda solo quando serve: Consenti una volta / Consenti sempre / Non consentire. */
export function askSend(kind: SendKind, what?: string): Promise<boolean> {
  const st = useAiRouter.getState();
  /* foto del corpo: dato critico, il permesso vale una volta sola, mai «sempre» */
  const mode = kind === 'body' ? (modeOf(st.fileConsent[kind]) === 'never' ? 'never' : 'ask') : modeOf(st.fileConsent[kind]);
  if (mode === 'always') return Promise.resolve(true);
  if (mode === 'never') return Promise.resolve(false);
  return new Promise((resolve) => {
    const head = kind === 'body' ? 'Inviare le foto del corpo al servizio AI?' : kind === 'data' ? 'Mandare questi tuoi dati al servizio AI?' : kind === 'food' ? 'Inviare la foto del piatto al servizio AI?' : kind === 'summary' ? 'Inviare questi valori al servizio AI?' : 'Inviare questo file al servizio AI?';
    const body = kind === 'body' ? `${what ? `${what}\n\n` : ''}Sono foto molto personali: le mando al nostro server solo per questa analisi, il server non le conserva, non le usa per addestrare niente e non le vede nessun altro. Le foto restano solo sul tuo telefono e puoi cancellarle quando vuoi.\n\nSe non consenti, non le invio e l'analisi non parte.` : `${what ? `${what}\n\n` : ''}${kind === 'data'
      ? 'Theia vede tutto sul telefono. Per rispondere alla tua domanda devo però mandare le parti elencate sopra al servizio AI (modelli aperti, su Cloudflare), tramite il server di LifePilot. Non mando nient\'altro, e nel registro "Cosa è stato inviato" resta solo il tipo di dati, mai il contenuto. I dati possono essere trattati fuori da UE e Svizzera (Google): il consenso è facoltativo e lo puoi revocare quando vuoi in Impostazioni > Intelligenza di Theia (GDPR / nLPD). L\'AI può sbagliare: verifica sempre le cifre.'
      : kind === 'summary'
      ? 'Per darti un parere più dettagliato devo mandare al servizio AI (modelli aperti, su Cloudflare), tramite il server di LifePilot, solo il testo con i valori del pasto o le medie dei nutrienti. Niente foto, nome, salute in generale, finanze o contatti.'
      : kind === 'food'
      ? 'Per riconoscere gli alimenti devo mandare la foto al servizio AI (modelli aperti, su Cloudflare), tramite il server di LifePilot. Non invio altro: né salute, né finanze, né contatti.'
      : 'Per leggerlo devo mandarlo al servizio AI (modelli aperti, su Cloudflare), tramite il server di LifePilot. Non invio altro: né salute, né finanze, né contatti.'}\n\n${kind === 'data' ? WARN_DATA : WARN}`;
    alertT(head, body, [
      { text: 'Non consentire', style: 'cancel', onPress: () => { st.setFileConsent({ [kind]: 'never' }); resolve(false); } },
      ...(kind === 'body' ? [] : [{ text: 'Consenti sempre', onPress: () => { st.setFileConsent({ [kind]: 'always' }); resolve(true); } }]),
      { text: 'Consenti una volta', onPress: () => resolve(true) },
    ]);
  });
}

/** Registro "Cosa è stato inviato": solo tipo e dimensione, mai il contenuto. */
export function logSend(kind: SendKind, bytes: number, parts: string[]) {
  useAiRouter.getState().addLog({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), kind: 'vision_read', provider: 'Cloudflare Workers AI', bytes, parts, redacted: 0 });
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

/**
 * Consenso per categoria prima di mandare dati dell'app all'AI esterna (GDPR/nLPD: specifico, informato, revocabile, registrato).
 * Ritorna le categorie che si possono mandare: quelle su «sempre» + quelle su «chiedi» se l'utente consente adesso. Quelle su «mai» restano fuori.
 */
export async function askData(cats: string[]): Promise<string[]> {
  const st = useAiRouter.getState();
  const g = gate(cats, st.dataConsent);
  if (!g.ask.length) return g.send;
  const names = g.ask.map(labelOf);
  const special = g.ask.some((c) => CATS.find((x) => x.id === c)?.special);
  const answer = await new Promise<'once' | 'always' | 'no'>((resolve) => {
    alertT('Mandare questi tuoi dati al servizio AI?', [
      names.map((n) => translateText(n)).join(', '),
      translateText('Theia vede tutto sul telefono. Per rispondere devo però mandare queste parti al servizio AI (modelli aperti, su Cloudflare), tramite il server di LifePilot. Non mando nient\'altro.'),
      special ? translateText('Sono dati particolarmente sensibili (finanze, salute): li mando solo con il tuo consenso esplicito.') : '',
      translateText('I dati possono essere trattati fuori da UE e Svizzera. Il consenso è facoltativo e lo cambi quando vuoi in Centro Privacy. Nel registro resta solo il tipo di dati, mai il contenuto. L\'AI può sbagliare: verifica le cifre.'),
      translateText('Se non consenti, rispondo senza guardare questi dati.'),
    ].filter(Boolean).join('\n\n'), [
      { text: 'Non adesso', style: 'cancel', onPress: () => resolve('no') },
      { text: 'Consenti sempre', onPress: () => resolve('always') },
      { text: 'Consenti una volta', onPress: () => resolve('once') },
    ]);
  });
  if (answer === 'always') st.setDataConsent(g.ask, 'always', 'Dal dialogo di Theia');
  else useAiRouter.setState((s) => ({ consentLog: g.ask.reduce((l, c) => pushConsent(l, { ts: Date.now(), cat: c, mode: answer === 'once' ? 'ask' : 'never', note: answer === 'once' ? 'Consentito una volta' : 'Non consentito' }), s.consentLog ?? []) }));
  return answer === 'no' ? g.send : [...g.send, ...g.ask];
}

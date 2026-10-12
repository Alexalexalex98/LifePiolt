/**
 * Collega il privacy gate (puro) alle scelte "Cosa condivido" e al registro di uscita dell'app.
 * I canali in uscita importano da qui, cosi' il gate e' sempre configurato.
 */
import { bindGate } from './privacyGate';
import { makeEntry } from './privacyLog';
import { usePrivacyLog } from '@/store/privacyLog';
import { readChoices } from '@/store/sharing';

bindGate({
  choices: () => readChoices(),
  record: (e) => {
    const entry = makeEntry(e);
    if (entry) usePrivacyLog.getState().add(entry);
  },
});

export { canShare, guardedPayload, logOutflow, evaluate, type Audience, type GateCtx } from './privacyGate';

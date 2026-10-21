import { useState } from 'react';

import { Body, Btn, Card, H, Pill, Row } from '@/components/ui';
import { aiServerConfigured, aiServerHost, pingAiServer } from '@/lib/aiServer';
import { useAiRouter } from '@/store/aiRouter';

/** Consenso a mandare foto e file al servizio AI: si cambia o si toglie quando si vuole. */
export function FileConsentCard() {
  const c = useAiRouter((s) => s.fileConsent);
  const set = useAiRouter((s) => s.setFileConsent);
  return (
    <Card>
      <H>Foto e file inviati all'AI</H>
      <Body small muted style={{ marginTop: 4 }}>Per leggere foto, documenti e bollette Theia deve mandarli al servizio AI (Google Gemini), tramite il server di LifePilot. Se non lo permetti, Theia non può capire file, foto e documenti: restano solo sul telefono.</Body>
      <Body bold style={{ marginTop: 10 }}>Foto dei piatti</Body>
      <Row gap={8} style={{ marginTop: 6 }}>
        <Pill label="Chiedi ogni volta" on={c.food === 'ask'} onPress={() => set({ food: 'ask' })} />
        <Pill label="Consenti sempre" on={c.food === 'always' || (c.food as unknown) === true} onPress={() => set({ food: 'always' })} />
        <Pill label="Non consentire" on={c.food === 'never'} onPress={() => set({ food: 'never' })} />
      </Row>
      <Body bold style={{ marginTop: 12 }}>File e foto in chat, bollette e screenshot</Body>
      <Row gap={8} style={{ marginTop: 6 }}>
        <Pill label="Chiedi ogni volta" on={c.files === 'ask'} onPress={() => set({ files: 'ask' })} />
        <Pill label="Consenti sempre" on={c.files === 'always'} onPress={() => set({ files: 'always' })} />
        <Pill label="Non consentire" on={c.files === 'never'} onPress={() => set({ files: 'never' })} />
      </Row>
      <Body bold style={{ marginTop: 12 }}>Pareri dell'AI su pasti e alimentazione (solo testo e valori)</Body>
      <Row gap={8} style={{ marginTop: 6 }}>
        <Pill label="Chiedi ogni volta" on={(c.summary ?? 'ask') === 'ask'} onPress={() => set({ summary: 'ask' })} />
        <Pill label="Consenti sempre" on={c.summary === 'always'} onPress={() => set({ summary: 'always' })} />
        <Pill label="Non consentire" on={c.summary === 'never'} onPress={() => set({ summary: 'never' })} />
      </Row>
    </Card>
  );
}

/** Stato del collegamento al server AI di questa versione dell'app: serve a capire subito se in una build mancano indirizzo e token. */
export function AiServerStatus() {
  const [res, setRes] = useState<{ ok: boolean; ms: number; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <H>Server AI di questa app</H>
      <Body small style={{ marginTop: 4 }}>{aiServerConfigured ? `Collegato a ${aiServerHost}` : 'Non collegato: in questa versione mancano l\'indirizzo e il token del server AI, quindi l\'analisi dei piatti e le risposte dell\'AI non funzionano.'}</Body>
      {res ? <Body small bold style={{ marginTop: 6 }}>{`${res.ok ? 'OK' : 'Problema'} · ${res.message}${res.ms ? ` (${(res.ms / 1000).toFixed(1)} s)` : ''}`}</Body> : null}
      <Btn style={{ marginTop: 8 }} ghost title={busy ? 'Provo…' : 'Prova il collegamento'} disabled={busy} onPress={async () => { setBusy(true); setRes(await pingAiServer()); setBusy(false); }} />
    </Card>
  );
}

import { useState } from 'react';
import { View } from 'react-native';

import { Body, Btn, Card, H, Input, Pill, Row } from '@/components/ui';
import { useAiServerCfg } from '@/store/aiServerCfg';
import { toast } from '@/store/toast';
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

/** Collegamento al server AI di questa app: si può inserire qui indirizzo e token (valgono anche in una build senza variabili) e provare che risponda. */
export function AiServerStatus() {
  const cfg = useAiServerCfg();
  const [res, setRes] = useState<{ ok: boolean; ms: number; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(cfg.url);
  const [token, setToken] = useState(cfg.token);
  const [edit, setEdit] = useState(!aiServerConfigured);
  const save = () => {
    const u = url.trim();
    if (u && !/^https:\/\/\S+$/.test(u)) { toast('L\'indirizzo deve iniziare con https://'); return; }
    cfg.set({ url: u, token: token.trim() });
    toast('Salvato');
    setEdit(false);
    setRes(null);
  };
  const test = async () => { setBusy(true); setRes(await pingAiServer()); setBusy(false); };
  return (
    <Card>
      <H>Server AI di questa app</H>
      <Body small style={{ marginTop: 4 }}>{aiServerConfigured ? `Collegato a ${aiServerHost}${cfg.url ? ' (inserito nell\'app)' : ' (dalla build)'}` : 'Non collegato: mancano l\'indirizzo e la parola d\'ordine del server AI. Inseriscili qui sotto: restano solo su questo telefono.'}</Body>
      {edit ? (
        <View style={{ marginTop: 8, gap: 8 }}>
          <Input placeholder="Indirizzo, es. https://nome.account.workers.dev" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <Input placeholder="Parola d'ordine (token)" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <Btn title="Salva" onPress={save} />
        </View>
      ) : null}
      {res ? <Body small bold style={{ marginTop: 6 }}>{`${res.ok ? 'OK' : 'Problema'} · ${res.message}${res.ms ? ` (${(res.ms / 1000).toFixed(1)} s)` : ''}`}</Body> : null}
      <Row style={{ marginTop: 8, justifyContent: 'flex-start' }} gap={8}>
        <Btn small ghost title={busy ? 'Provo…' : 'Prova il collegamento'} disabled={busy} onPress={() => void test()} />
        {!edit ? <Btn small ghost title="Cambia indirizzo e token" onPress={() => { setUrl(cfg.url); setToken(cfg.token); setEdit(true); }} /> : null}
      </Row>
    </Card>
  );
}

import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { InfoTip } from '@/components/InfoTip';
import { decodeLinkCode, encodeLinkCode } from '@/lib/aiLinkCode';
import { View } from 'react-native';

import { Body, Btn, Card, H, Input, Pill, Row } from '@/components/ui';
import { useAiServerCfg } from '@/store/aiServerCfg';
import { useApp } from '@/store/app';
import { toast } from '@/store/toast';
import { aiServerConfigured, aiServerHost, pingAiServer } from '@/lib/aiServer';
import { useAiRouter } from '@/store/aiRouter';
import { go } from '@/lib/nav';

/** Il pulsante di Theia che si muove sullo schermo: si può togliere (Theia resta nella chat e nel menu). */
export function FabCard() {
  const on = useApp((s) => s.theiaFab !== false);
  const set = useApp((s) => s.set);
  return (
    <Card>
      <H>Pulsante di Theia sullo schermo</H>
      <Body small muted style={{ marginTop: 4 }}>Il pulsante che si sposta sullo schermo e ti fa chiedere a Theia di una pagina, di una foto o di un testo copiato. Se lo togli, Theia resta sempre disponibile dalla chat e dal menu.</Body>
      <Row gap={8} style={{ marginTop: 8 }}>
        <Pill label="Mostra" on={on} onPress={() => set({ theiaFab: true })} />
        <Pill label="Nascondi" on={!on} onPress={() => set({ theiaFab: false })} />
      </Row>
    </Card>
  );
}

/** Ricerca sul web: se Theia non sa una cosa la cerca online. Parte solo la tua domanda, resa generica, senza i tuoi dati. */
export function WebSearchCard() {
  const web = useAiServerCfg((s) => s.web !== false);
  const set = useAiServerCfg((s) => s.set);
  return (
    <Card>
      <H>Ricerca sul web</H>
      <Body small muted style={{ marginTop: 4 }}>Se Theia non conosce una cosa (orari, luoghi, notizie, prezzi) la cerca online e ti risponde con le fonti. Dal server parte solo una frase di ricerca generica ricavata dalla tua domanda: mai i tuoi dati, i tuoi nomi, i tuoi importi o la tua salute.</Body>
      <Row gap={8} style={{ marginTop: 8 }}>
        <Pill label="Attiva" on={web} onPress={() => set({ web: true })} />
        <Pill label="Disattiva" on={!web} onPress={() => set({ web: false })} />
      </Row>
    </Card>
  );
}

/** Consenso a mandare foto e file al servizio AI: si cambia o si toglie quando si vuole. */
export function FileConsentCard() {
  const c = useAiRouter((s) => s.fileConsent);
  const set = useAiRouter((s) => s.setFileConsent);
  return (
    <Card>
      <H>Foto e file inviati all'AI</H>
      <Body small muted style={{ marginTop: 4 }}>Per leggere foto, documenti e bollette Theia deve mandarli al servizio AI (modelli aperti, su Cloudflare), tramite il server di LifePilot. Se non lo permetti, Theia non può capire file, foto e documenti: restano solo sul telefono.</Body>
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
      <Btn small ghost style={{ marginTop: 12 }} title="Scegli per ogni categoria di dati (Centro Privacy)" onPress={() => go('privacyCenter')} />
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
      <Row><H>Server AI di questa app</H><InfoTip title="Un solo collegamento per tutti i dispositivi" body={['Indirizzo e token restano su ogni dispositivo. Per non scriverli due volte: su quello già collegato tocca «Copia il codice», poi sull’altro «Incolla il codice» (puoi mandarti il codice con un messaggio a te stesso).', 'Il codice contiene la parola d’ordine: non condividerlo con altri.']} /></Row>
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
        {aiServerConfigured && cfg.url && cfg.token ? <Btn small ghost title="Copia il codice" onPress={() => { void Clipboard.setStringAsync(encodeLinkCode(cfg.url, cfg.token)).then(() => toast('Codice copiato: incollalo sull\'altro dispositivo. Non condividerlo con altri')); }} /> : null}
        <Btn small ghost title="Incolla il codice" onPress={() => { void Clipboard.getStringAsync().then((x) => { const d = decodeLinkCode(x); if (!d) { toast('Negli appunti non c\'è un codice di collegamento valido'); return; } cfg.set({ url: d.url, token: d.token }); setUrl(d.url); setToken(d.token); setEdit(false); setRes(null); toast('Collegato: provo il collegamento'); void pingAiServer().then(setRes); }); }} />
        {!edit ? <Btn small ghost title="Cambia indirizzo e token" onPress={() => { setUrl(cfg.url); setToken(cfg.token); setEdit(true); }} /> : null}
      </Row>
    </Card>
  );
}

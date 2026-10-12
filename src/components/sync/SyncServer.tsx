import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Body, Btn, Card, H, Input, Toggle } from '@/components/ui';
import { useSync } from '@/store/sync';
import { toast } from '@/store/toast';
import { applyTransport, ensureEngine, getEngine } from '@/sync/bindings';
import { resetDevMock, simulateOtherDevice } from '@/sync/devMock';
import { loadServerConfig, saveServerConfig } from '@/sync/secure';
import { useLife } from '@/store/life';

/** Sezione "Server": URL e chiave pubblica nel portachiavi, pulsante Collega, strumenti di sviluppo. */
export function SyncServer() {
  const devMock = useSync((s) => s.devMock);
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { void loadServerConfig().then((c) => { setUrl(c.url); setKey(c.anonKey); }); }, []);
  const connect = async () => {
    setBusy(true);
    try {
      const saved = await saveServerConfig({ url: url.trim(), anonKey: key.trim() });
      if (!saved) setMsg('Non sono riuscito a salvare nel portachiavi del telefono.');
      useSync.setState({ serverUrl: url.trim() });
      await ensureEngine();
      const r = await applyTransport();
      setMsg(r.message);
      toast(r.ok ? 'Collegato' : 'Non collegato');
    } catch { setMsg('Errore imprevisto durante il collegamento.'); } finally { setBusy(false); }
  };
  const wipe = async () => {
    const e = getEngine() ?? (await ensureEngine());
    const r = await e.deactivateAndWipe();
    setMsg(r.message);
    toast(r.ok ? 'Sincronizzazione disattivata' : 'Operazione non riuscita');
  };
  return (
    <Card>
      <H>Server</H>
      <Body small muted style={{ marginTop: 6 }}>Nessun server collegato: la sincronizzazione si attiva quando colleghi un server in Impostazioni &gt; Avanzate. L’indirizzo e la chiave pubblica (anon key) restano nel portachiavi del telefono, fuori dal backup.</Body>
      <View style={{ gap: 8, marginTop: 10 }}>
        <Input placeholder="Indirizzo del server (https://...)" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Indirizzo del server" />
        <Input placeholder="Chiave pubblica (anon key)" value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Chiave pubblica" />
        <Btn small title={busy ? 'Collego...' : 'Collega'} disabled={busy} onPress={() => void connect()} />
        {msg ? <Body small>{msg}</Body> : null}
      </View>
      <View style={{ marginTop: 14, gap: 8 }}>
        <Btn small ghost danger title="Disattiva e cancella i dati dal server" onPress={() => void wipe()} />
        <Body small muted>Toglie la sincronizzazione da questo telefono e, se un server e’ collegato, cancella anche i dati sincronizzati. I dati sul telefono restano.</Body>
      </View>
      <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: 'transparent' }}>
        <Toggle label="Sviluppo: server finto in memoria" hint="Solo per provare. Nessun dato esce dal telefono; si azzera alla chiusura dell’app." value={devMock} onChange={(v) => { useSync.setState({ devMock: v }); void ensureEngine().then(() => applyTransport()).then((r) => setMsg(r.message)); if (!v) resetDevMock(); }} />
        {devMock && (
          <View style={{ gap: 8, marginTop: 6 }}>
            <Btn small ghost title="Simula un altro dispositivo" onPress={() => { const n = useLife.getState().notes[0]; void simulateOtherDevice(n?.id).then((m) => toast(m)).catch(() => toast('Simulazione non riuscita')); }} />
            <Body small muted>Il "Tablet di prova" aggiunge un task e modifica la prima nota: premi poi Sincronizza ora per vederli arrivare.</Body>
          </View>
        )}
      </View>
    </Card>
  );
}

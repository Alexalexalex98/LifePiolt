import { useState } from 'react';
import { View } from 'react-native';

import { Body, Btn, Card, H, IL, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { getEngine, syncNow } from '@/sync/bindings';
import { useSync, useSyncStatus } from '@/store/sync';
import { toast } from '@/store/toast';

/** Etichetta ONESTA dello stato: mai "sincronizzato" se non c'e' un server. */
export function statusLabel(phase: string, hasEnabled: boolean, lastOk?: number): { label: string; tone: 'ok' | 'warn' | 'bad' | 'muted'; detail: string } {
  switch (phase) {
    case 'disconnected': return { label: 'Non collegato', tone: 'muted', detail: 'Nessun server collegato: la sincronizzazione si attiva quando colleghi un server in Impostazioni > Avanzate.' };
    case 'offline': return { label: 'Offline', tone: 'warn', detail: 'Sei offline: le modifiche restano sul telefono e partiranno al ritorno della rete.' };
    case 'error': return { label: 'Errore', tone: 'bad', detail: 'L’ultimo tentativo non e’ riuscito. Riprovo da solo con attese crescenti.' };
    case 'syncing': return { label: 'Sincronizzazione in corso', tone: 'muted', detail: 'Invio e ricezione delle modifiche.' };
    case 'paused': return { label: 'In pausa', tone: 'warn', detail: 'La sincronizzazione e’ in pausa: nulla viene inviato.' };
    default: return hasEnabled && lastOk ? { label: 'Sincronizzato', tone: 'ok', detail: 'Le categorie abilitate sono allineate con il server.' } : { label: hasEnabled ? 'In attesa del primo invio' : 'Solo sul telefono', tone: 'muted', detail: hasEnabled ? 'Categorie abilitate: premi Sincronizza ora quando un server e’ collegato.' : 'Nessuna categoria abilitata: tutto resta sul telefono.' };
  }
}

const when = (ts?: number) => (ts ? new Date(ts).toLocaleString() : 'mai');

export function SyncStatusCard() {
  const t = useTheme();
  const st = useSyncStatus();
  const enabled = useSync((s) => s.enabled);
  const last = useSync((s) => s.lastResult);
  const paused = useSync((s) => s.paused);
  const [busy, setBusy] = useState(false);
  const any = Object.values(enabled).some(Boolean);
  const info = statusLabel(st.phase, any, st.lastOkAt);
  const color = info.tone === 'ok' ? t.positive : info.tone === 'bad' ? t.danger : info.tone === 'warn' ? t.warn : t.muted;
  const run = async () => {
    setBusy(true);
    try {
      const r = await syncNow();
      toast(r.skipped === 'disconnected' ? 'Nessun server collegato' : r.skipped === 'nothing-enabled' ? 'Abilita almeno una categoria' : r.skipped === 'offline' ? 'Sei offline' : r.ok ? `Fatto: ${r.pushed} inviate, ${r.pulled} ricevute` : r.error ?? 'Errore');
    } catch { toast('Errore imprevisto'); } finally { setBusy(false); }
  };
  return (
    <Card>
      <Row>
        <H>Stato</H>
        <Pill label={info.label} icon={info.tone === 'ok' ? 'check' : info.tone === 'bad' ? 'alert' : 'clock'} color={color} />
      </Row>
      <Body small style={{ marginTop: 8 }}>{info.detail}</Body>
      <View style={{ gap: 4, marginTop: 10 }}>
        <IL icon="repeat" small muted>{`Modifiche in attesa: ${st.pending}`}</IL>
        {st.blocked > 0 && <IL icon="lock" small muted>{`${st.blocked} categorie aspettano la cifratura end-to-end`}</IL>}
        <IL icon="clock" small muted>{last ? `Ultimo tentativo: ${when(last.at)} (${last.ok ? `${last.pushed} inviate, ${last.pulled} ricevute` : last.error ?? 'errore'})` : 'Nessun tentativo finora'}</IL>
        {st.lastError && st.phase === 'error' && <IL icon="alert" small color={t.danger}>{st.lastError}</IL>}
      </View>
      <View style={{ gap: 8, marginTop: 12 }}>
        <Btn small icon="repeat" title={busy ? 'Sincronizzo...' : 'Sincronizza ora'} disabled={busy} onPress={() => void run()} />
        <Btn small ghost title={paused ? 'Riprendi la sincronizzazione' : 'Metti in pausa'} onPress={() => { const e = getEngine(); if (paused) { if (e) e.resume(); else useSync.setState({ paused: false }); } else if (e) e.pause(); else useSync.setState({ paused: true }); }} />
      </View>
    </Card>
  );
}

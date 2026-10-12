import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { Body, Btn, Card, H, Item, Row } from '@/components/ui';
import { fmtDateTime } from '@/i18n/format';
import { t } from '@/i18n/core';
import { refreshBgStatus, runAllNow, triggerForTesting, useBgStatus } from '@/lib/background';
import { collect } from '@/lib/diagnostics';
import { groupScheduled, type DiagInfo } from '@/lib/diagnosticsReport';
import { listScheduled, type ScheduledInfo } from '@/lib/notify';
import { toast } from '@/store/toast';

/** Versione, piattaforma, storage e permessi. Nessun dato personale. */
export function InfoCard({ info, onVersionTap }: { info: DiagInfo | null; onVersionTap: () => void }) {
  if (!info) return <Card><H>Questo telefono</H><Body small muted>Leggo lo stato…</Body></Card>;
  const rows: [string, string][] = [
    ['Versione app', `${info.app.version} (build ${info.app.build})`],
    ['Expo SDK', info.app.sdk],
    ['Esecuzione', info.app.runtime],
    ['Piattaforma', `${info.device.platform} ${info.device.os}`],
    ['Dispositivo', info.device.model],
    ['Lingua e fuso', `${info.device.locale} · ${info.device.tz}`],
    ['Storage', `${info.storage.engine} · ${info.storage.keys} archivi · ${info.storage.kb} KB`],
  ];
  return (
    <>
      <Card>
        <H>Questo telefono</H>
        {rows.map(([k, v], i) => (
          <Item key={k} last={i === rows.length - 1} onPress={k === 'Versione app' ? onVersionTap : undefined}>
            <Row><Body muted small style={{ width: 110 }}>{k}</Body><Body small style={{ flex: 1 }}>{v}</Body></Row>
          </Item>
        ))}
      </Card>
      <Card>
        <H>Permessi</H>
        <Body small muted style={{ marginBottom: 8 }}>Se una funzione non va (microfono, notifiche), controlla qui che il permesso sia concesso. Si cambia da Impostazioni del telefono, nelle impostazioni di LifePilot.</Body>
        {Object.entries(info.permissions).map(([k, v], i, a) => (
          <Item key={k} last={i === a.length - 1}><Row><Body small style={{ flex: 1, textTransform: 'capitalize' }}>{k}</Body><Body small bold muted={v !== 'concesso'}>{v}</Body></Row></Item>
        ))}
        {info.voice ? (
          <Body small muted style={{ marginTop: 8 }}>{t('Voce: riconoscimento {0}, microfono {1}', info.voice.disponibile === null ? 'n/d' : info.voice.disponibile ? 'disponibile' : 'non disponibile', info.voice.microfono === null ? 'n/d' : info.voice.microfono ? 'concesso' : 'non concesso')}</Body>
        ) : null}
      </Card>
    </>
  );
}

/** Notifiche programmate sul telefono: elenco (solo sullo schermo, mai nell'esportazione). */
export function NotificationsCard() {
  const [items, setItems] = useState<ScheduledInfo[] | null>(null);
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const r = await listScheduled();
    setItems(r.ok ? r.items : null);
    setMsg(r.ok ? '' : r.message ?? 'Non disponibile.');
  }, []);
  useEffect(() => { void load(); }, [load]);
  const groups = items ? groupScheduled(items.map((i) => ({ id: i.id, at: i.at }))) : [];
  return (
    <Card>
      <H>Notifiche programmate</H>
      {items === null ? <Body small muted>{msg || 'Leggo…'}</Body> : (
        <>
          <Body small muted style={{ marginBottom: 8 }}>{t('{0} su questo telefono. Su iPhone il sistema ne accetta al massimo 64.', items.length)}</Body>
          {groups.map((g) => <Row key={g.kind} style={{ marginBottom: 4 }}><Body small style={{ flex: 1 }}>{g.kind}</Body><Body small bold>{g.count}</Body></Row>)}
          {items.slice(0, 12).map((n, i, a) => (
            <Item key={n.id} last={i === a.length - 1}>
              <Body small numberOfLines={1}>{n.title || n.id}</Body>
              <Body small muted>{n.at ? fmtDateTime(n.at) : 'ripetuta'}</Body>
            </Item>
          ))}
          {items.length > 12 ? <Body small muted>{t('…e altre {0}', items.length - 12)}</Body> : null}
        </>
      )}
      <View style={{ marginTop: 10 }}><Btn small ghost icon="repeat" title="Aggiorna l'elenco" onPress={() => void load()} /></View>
    </Card>
  );
}

/** Task in background: stato e ultimo esito. */
export function BackgroundCard({ dev }: { dev: boolean }) {
  const s = useBgStatus();
  const [busy, setBusy] = useState(false);
  useEffect(() => { void refreshBgStatus(); }, []);
  const l = s.last;
  const sys = s.system === 'available' ? 'disponibile' : s.system === 'restricted' ? 'limitato dal sistema' : 'sconosciuto';
  return (
    <Card>
      <H>Lavoro in background</H>
      <Body small muted style={{ marginBottom: 8 }}>Ricalcola promemoria, scadenze e briefing, anche dopo un riavvio o un cambio di fuso orario. Il sistema decide quando farlo (risparmio energetico, Doze): non è a orari esatti.</Body>
      <Row style={{ marginBottom: 4 }}><Body small muted style={{ flex: 1 }}>Supportato</Body><Body small bold>{s.supported ? 'sì' : 'no'}</Body></Row>
      <Row style={{ marginBottom: 4 }}><Body small muted style={{ flex: 1 }}>Registrato</Body><Body small bold>{s.registered ? 'sì' : 'no'}</Body></Row>
      <Row style={{ marginBottom: 4 }}><Body small muted style={{ flex: 1 }}>Stato del sistema</Body><Body small bold>{sys}</Body></Row>
      {s.reason ? <Body small muted style={{ marginTop: 4 }}>{s.reason}</Body> : null}
      <Body small bold style={{ marginTop: 8 }}>Ultimo esito</Body>
      {l ? (
        <Body small muted>{t('{0} · {1} · {2}. Eseguiti: {3}{4}', fmtDateTime(l.ts), l.source === 'background' ? 'in background' : 'aprendo l\'app', l.ok ? 'ok' : 'errore', l.ran.join(', ') || 'nessuno', l.clock ? ` · ${l.clock === 'timezone' ? 'cambio di fuso orario' : 'cambio ora legale'}` : '')}{l.error ? `\n${l.error}` : ''}</Body>
      ) : <Body small muted>Nessuna esecuzione registrata su questo telefono.</Body>}
      <View style={{ gap: 8, marginTop: 10 }}>
        <Btn small ghost icon="repeat" disabled={busy} title="Ricalcola ora promemoria e notifiche" onPress={() => { setBusy(true); void runAllNow().then((o) => { setBusy(false); toast(o.ok ? 'Ricalcolato' : 'Ricalcolo con errori: vedi il log'); }); }} />
        {dev ? <Btn small ghost title="Chiedi al sistema di eseguire il task (sviluppo)" onPress={() => void triggerForTesting().then((ok) => toast(ok ? 'Richiesto' : 'Non disponibile (serve una build di sviluppo)'))} /> : null}
      </View>
    </Card>
  );
}

export function useDiagnostics() {
  const [info, setInfo] = useState<DiagInfo | null>(null);
  const reload = useCallback(() => { void collect().then(setInfo).catch(() => undefined); }, []);
  useEffect(() => { reload(); }, [reload]);
  return { info, reload };
}

export const runtimeLabel = () => (Platform.OS === 'web' ? 'web' : Constants.executionEnvironment === 'storeClient' ? 'Expo Go' : 'app installata');

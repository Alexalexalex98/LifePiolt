import { View } from 'react-native';

import { Body, Btn, Card, Empty, H, IL, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useSync, useSyncData } from '@/store/sync';
import { toast } from '@/store/toast';
import { getEngine, resolveConflict } from '@/sync/bindings';
import { collectionOf } from '@/sync/registry';

const dt = (ts: number) => new Date(ts).toLocaleString();

/** Dispositivi, cronologia degli invii (solo tipo, collezione, quantita', data) e copie in conflitto. */
export function SyncActivity() {
  const t = useTheme();
  const devices = useSync((s) => s.devices);
  const log = useSync((s) => s.sentLog);
  const conflicts = useSync((s) => s.conflicts);
  const hold = useSync((s) => s.massHold);
  const notes = useSync((s) => s.conflicts.length); void notes;
  const outboxSize = useSyncData((s) => s.outbox.length); void outboxSize;
  const open = conflicts.filter((c) => !c.resolved);
  return (
    <>
      {Object.values(hold).length > 0 && (
        <Card accent={t.danger}>
          <H>Cancellazione di massa trattenuta</H>
          {Object.values(hold).map((h) => (
            <View key={h.collection} style={{ marginTop: 8, gap: 8 }}>
              <Body small>{`${collectionOf(h.collection)?.label ?? h.collection}: ${h.count} elementi risultano eliminati su ${h.total}. Non li ho cancellati dal server.`}</Body>
              <Row>
                <Btn small danger title="Conferma la cancellazione" onPress={() => getEngine()?.resolveMassDelete(h.collection, true)} />
                <Btn small ghost title="Ignora" onPress={() => getEngine()?.resolveMassDelete(h.collection, false)} />
              </Row>
            </View>
          ))}
        </Card>
      )}
      <Card>
        <H>Conflitti risolti</H>
        <Body small muted style={{ marginTop: 6 }}>Se la stessa nota viene cambiata su due dispositivi, vince la modifica piu’ recente e l’altra versione resta come copia: nessun testo si perde.</Body>
        {open.length === 0 ? <Empty text="Nessuna copia in conflitto." /> : open.map((c) => (
          <View key={c.id} testID={'conflict-' + c.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.item, gap: 6 }}>
            <Body bold>{`Nota con due versioni (${dt(c.at)})`}</Body>
            <Body small muted>{`Copia salvata: "${c.preview}"`}</Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Btn small ghost title="Tieni la versione attuale" onPress={() => { resolveConflict(c.id, 'current'); toast('Copia eliminata'); }} />
              <Btn small ghost title="Usa la copia" onPress={() => { resolveConflict(c.id, 'copy'); toast('Nota sostituita con la copia'); }} />
              <Btn small ghost title="Tieni entrambe" onPress={() => { resolveConflict(c.id, 'both'); toast('Entrambe conservate'); }} />
            </View>
          </View>
        ))}
      </Card>
      <Card>
        <H>I miei dispositivi</H>
        <Body small muted style={{ marginTop: 6 }}>L’elenco e l’ultimo accesso arrivano dal server.</Body>
        {devices.length === 0 ? <Empty text="Nessun dispositivo noto: serve un server collegato." /> : devices.map((d) => (
          <View key={d.id} style={{ paddingVertical: 8 }}>
            <IL icon="phone" bold={!!d.current}>{d.name + (d.current ? ' (questo)' : '')}</IL>
            <Body small muted>{`Ultimo accesso: ${dt(d.lastSeen)}`}</Body>
          </View>
        ))}
      </Card>
      <Card>
        <H>Cosa e’ stato inviato</H>
        <Body small muted style={{ marginTop: 6 }}>Solo tipo, collezione, quantita’ e data: mai il contenuto.</Body>
        {log.length === 0 ? <Empty text="Nulla e’ stato inviato." /> : [...log].reverse().slice(0, 30).map((l, i) => (
          <View key={i} style={{ paddingVertical: 6 }}>
            <Body small>{`${l.dir === 'invio' ? 'Inviate' : 'Ricevute'} ${l.count} · ${collectionOf(l.collection)?.label ?? l.collection}`}</Body>
            <Body small muted>{dt(l.at)}</Body>
          </View>
        ))}
      </Card>
    </>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Body, Btn, Card, H, Progress, Row, Sheet, Tag } from '@/components/ui';
import { loadSpaceReport, runCleanup } from '@/db/diagnostics';
import { formatBytes } from '@/db/space';
import { confirmDelete } from '@/lib/confirm';
import { toast } from '@/store/toast';
import { t as tr } from '@/i18n/core';

type Rep = Awaited<ReturnType<typeof loadSpaceReport>>;

/** Spazio occupato per categoria e per file, file orfani, ripulitura con anteprima. */
export function SpaceSection() {
  const [r, setR] = useState<Rep | null>(null);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { void loadSpaceReport().then(setR).catch(() => undefined); }, []);
  useEffect(() => { load(); }, [load]);

  const removable = r ? r.orphanBytes + r.cacheBytes : 0;
  const max = r?.stores[0]?.bytes || 1;

  function confirmClean() {
    if (!r) return;
    confirmDelete(tr('{0} file ({1}) non più usati', r.orphans.length + r.cacheFiles.length, formatBytes(removable)), () => {
      setBusy(true); setSheet(false);
      void runCleanup({ orphans: true, cache: true, quarantine: true }, r).then((x) => { toast(tr('Ripulito: {0} liberati', formatBytes(x.freed))); }).catch(() => toast('Ripulitura non completata')).finally(() => { setBusy(false); load(); });
    }, undefined, { title: 'Ripulire?', okLabel: 'Ripulisci' });
  }

  return (
    <Card>
      <H>Spazio occupato</H>
      {!r ? <Body small muted>Calcolo in corso…</Body> : (
        <>
          {r.low && r.disk ? <Body small bold style={{ marginBottom: 8 }}>Lo spazio libero sul telefono è poco: {formatBytes(r.disk.available)}. Libera spazio per non rischiare di perdere salvataggi.</Body> : null}
          <Row><Body muted style={{ flex: 1 }}>Totale LifePilot</Body><Body bold>{formatBytes(r.totalBytes)}</Body></Row>
          {r.disk ? <Row><Body muted style={{ flex: 1 }}>Libero sul telefono</Body><Body bold>{formatBytes(r.disk.available)}</Body></Row> : null}
          <Tag>Dati per categoria</Tag>
          {r.stores.length === 0 ? <Body small muted>Ancora nessun dato salvato.</Body> : r.stores.slice(0, 10).map((s) => (
            <View key={s.name} style={{ marginBottom: 8 }}>
              <Row><Body small style={{ flex: 1 }}>{s.name}</Body><Body small muted>{formatBytes(s.bytes)}</Body></Row>
              <Progress value={Math.max(2, Math.round((s.bytes / max) * 100))} />
            </View>
          ))}
          {r.biggest.length > 0 ? (
            <>
              <Tag>File più grandi</Tag>
              {r.biggest.slice(0, 5).map((f) => <Row key={f.uri}><Body small style={{ flex: 1 }} numberOfLines={1}>{f.name}</Body><Body small muted>{formatBytes(f.bytes)}</Body></Row>)}
            </>
          ) : <Body small muted style={{ marginTop: 8 }}>Nessun allegato salvato nella memoria dell'app.</Body>}
          <Row style={{ marginTop: 12 }}>
            <Btn small ghost style={{ flex: 1 }} title="Aggiorna" onPress={load} />
            <Btn small style={{ flex: 1 }} disabled={busy} title="Ripulisci…" onPress={() => setSheet(true)} />
          </Row>
        </>
      )}
      <Sheet visible={sheet} title="Ripulisci" onClose={() => setSheet(false)}>
        {r ? (
          <>
            <Body small muted style={{ marginBottom: 10 }}>Cosa verrà eliminato. I tuoi dati (task, note, messaggi, finanze…) non vengono toccati.</Body>
            <Row><Body style={{ flex: 1 }}>Allegati non più collegati a nessun messaggio ({r.orphans.length})</Body><Body bold>{formatBytes(r.orphanBytes)}</Body></Row>
            <Row><Body style={{ flex: 1 }}>File temporanei ({r.cacheFiles.length})</Body><Body bold>{formatBytes(r.cacheBytes)}</Body></Row>
            <Row><Body style={{ flex: 1 }}>Dati messi da parte per diagnosi</Body><Body bold>azzera</Body></Row>
            <Row><Body style={{ flex: 1 }}>Compattazione dell'archivio</Body><Body bold>sì</Body></Row>
            {r.orphans.slice(0, 5).map((f) => <Body key={f.uri} small muted numberOfLines={1}>{f.name} · {formatBytes(f.bytes)}</Body>)}
            <Row style={{ marginTop: 14 }}>
              <Btn ghost style={{ flex: 1 }} title="Annulla" onPress={() => setSheet(false)} />
              <Btn danger style={{ flex: 1 }} title="Ripulisci" onPress={confirmClean} />
            </Row>
          </>
        ) : null}
      </Sheet>
    </Card>
  );
}

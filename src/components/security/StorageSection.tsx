import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { useStorageInfo } from '@/components/security/hooks';
import { Body, Btn, Card, H, Row } from '@/components/ui';
import { archiveStats, optimizeNow, type ArchiveStats } from '@/db/diagnostics';
import { formatBytes } from '@/db/space';
import { toast } from '@/store/toast';

/** Archivio dei dati: motore, dimensioni, copie di sicurezza, ottimizzazione. */
export function StorageSection() {
  const info = useStorageInfo();
  const [s, setS] = useState<ArchiveStats | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { void archiveStats().then(setS).catch(() => undefined); }, []);
  useEffect(() => { load(); }, [load, info.mode]);

  async function optimize() {
    setBusy(true);
    try { const r = await optimizeNow(); toast(r.vacuumed ? 'Archivio ottimizzato' : 'Niente da ottimizzare'); } catch { toast('Ottimizzazione non riuscita'); }
    setBusy(false); load();
  }

  const engine = info.mode === 'sqlite' ? 'SQLite (WAL)' : info.mode === 'asyncstorage' ? (info.dbName === 'localStorage' ? 'Archivio del browser' : 'Archivio semplice del telefono') : 'Apertura in corso';
  return (
    <Card>
      <H>Archivio dati</H>
      <Row><Body muted style={{ flex: 1 }}>Motore</Body><Body bold>{engine}</Body></Row>
      <Row><Body muted style={{ flex: 1 }}>Dati salvati</Body><Body bold>{s ? formatBytes(s.dbBytes) : '…'}</Body></Row>
      {s && s.fileBytes > 0 ? <Row><Body muted style={{ flex: 1 }}>File del database</Body><Body bold>{formatBytes(s.fileBytes)}</Body></Row> : null}
      <Row><Body muted style={{ flex: 1 }}>Scritture in attesa</Body><Body bold>{s ? s.pending : '…'}</Body></Row>
      <Row><Body muted style={{ flex: 1 }}>Dati messi da parte per diagnosi</Body><Body bold>{s ? s.quarantine : '…'}</Body></Row>
      <Body small muted style={{ marginVertical: 8 }}>I dati sono salvati solo su questo telefono. Se un'informazione risulta danneggiata, LifePilot ripristina l'ultima copia valida e ti avvisa; nulla viene perso in silenzio.</Body>
      {info.mode === 'sqlite' ? <View><Btn small ghost disabled={busy} title="Ottimizza l'archivio" onPress={() => void optimize()} /></View> : null}
    </Card>
  );
}

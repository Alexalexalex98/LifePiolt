import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Body, Card, H, Seg, Toggle } from '@/components/ui';
import { authenticate, lockCapability } from '@/db/appLock';
import { canEnableLock, methodLabel, LOCK_TIMEOUTS, timeoutLabel, type LockCapability } from '@/db/lockPolicy';
import { useSecurity } from '@/db/securityStore';
import { alertT } from '@/lib/alert';
import { toast } from '@/store/toast';
import { t as tr } from '@/i18n/core';

/** Blocco app con Face ID / impronta / PIN del telefono. Spento di default. */
export function LockSection() {
  const enabled = useSecurity((s) => s.lockEnabled);
  const timeout = useSecurity((s) => s.lockTimeoutMin);
  const set = useSecurity((s) => s.set);
  const [cap, setCap] = useState<LockCapability | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void lockCapability().then(setCap); }, []);

  async function toggle(v: boolean) {
    if (!v) { set({ lockEnabled: false }); toast('Blocco disattivato'); return; }
    const c = await lockCapability();
    setCap(c);
    const can = canEnableLock(c);
    if (!can.ok) { alertT('Blocco non disponibile', can.reason); return; }
    // prima prova: attivo il blocco solo se lo sblocco funziona davvero, cosi' non resti fuori
    setBusy(true);
    const out = await authenticate();
    setBusy(false);
    if (out === 'ok') { set({ lockEnabled: true }); toast('Blocco attivato'); }
    else if (out === 'no_device_lock') alertT('Blocco non disponibile', canEnableLock({ ...c, level: 'none' }).reason);
    else toast(tr('Blocco non attivato: la verifica non è andata a buon fine'));
  }

  const labels = LOCK_TIMEOUTS.map((m) => timeoutLabel(m).replace('Dopo ', '').replace('minuti', 'min').replace('minuto', 'min'));
  const idx = Math.max(0, LOCK_TIMEOUTS.indexOf(timeout as (typeof LOCK_TIMEOUTS)[number]));
  return (
    <Card>
      <H>Blocco dell'app</H>
      <Body small muted style={{ marginBottom: 10 }}>Chiede Face ID, impronta o il PIN del telefono quando riapri LifePilot. {cap ? methodLabel(cap) + '.' : ''}</Body>
      <Toggle label="Blocca l'app" hint={cap && cap.level === 'none' ? 'Serve un blocco schermo sul telefono' : 'Spento di default'} value={enabled} onChange={(v) => { if (!busy) void toggle(v); }} />
      {enabled ? (
        <View style={{ marginTop: 12 }}>
          <Body small muted style={{ marginBottom: 8 }}>Quando bloccare dopo che l'app va in background</Body>
          <Seg options={labels} value={labels[idx]} onChange={(l) => set({ lockTimeoutMin: LOCK_TIMEOUTS[Math.max(0, labels.indexOf(l))] })} />
          <Body small muted>Se la biometria non ti riconosce puoi sempre usare il PIN del telefono. L'anteprima nell'elenco delle app recenti viene nascosta.</Body>
        </View>
      ) : null}
    </Card>
  );
}

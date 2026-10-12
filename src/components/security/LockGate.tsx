import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/T';
import { Btn } from '@/components/ui';
import { authenticate, lockCapability, setPrivacyShield } from '@/db/appLock';
import { lockStillPossible, shouldLockOnResume } from '@/db/lockPolicy';
import { useLockRuntime, useSecurity } from '@/db/securityStore';
import { pushNotice } from '@/db/status';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { t as tr } from '@/i18n/core';

/**
 * Schermata di blocco: copre TUTTO e non mostra alcun dato. Si attiva all'avvio e quando l'app torna in primo piano
 * dopo il tempo scelto. Se il telefono perde il blocco schermo (o l'autenticazione non e' disponibile) NON blocca mai:
 * l'utente non puo' restare fuori. Mentre l'app non e' in primo piano la copertura nasconde anche l'anteprima nell'elenco app.
 */
export function LockGate() {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const enabled = useSecurity((s) => s.lockEnabled);
  const timeoutMin = useSecurity((s) => s.lockTimeoutMin);
  const locked = useLockRuntime((s) => s.locked);
  const busy = useLockRuntime((s) => s.busy);
  const message = useLockRuntime((s) => s.message);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const bgAt = useRef<number | null>(null);
  const authBusy = useRef(false);
  const started = useRef(false);

  const unlockSafely = useCallback((why?: string) => {
    useLockRuntime.getState().setLocked(false);
    useLockRuntime.getState().setMessage('');
    if (why) pushNotice({ kind: 'no_encryption', level: 'warn', message: why });
  }, []);

  const tryAuth = useCallback(async () => {
    if (authBusy.current) return;
    authBusy.current = true;
    const rt = useLockRuntime.getState();
    rt.setBusy(true); rt.setMessage('');
    try {
      const cap = await lockCapability();
      if (!lockStillPossible(cap)) {
        // il telefono non ha piu' un blocco schermo: niente blocco (e lo spengo), cosi' non resti fuori
        useSecurity.getState().set({ lockEnabled: false });
        unlockSafely('Il telefono non ha più un blocco schermo: ho disattivato il blocco di LifePilot. Reimposta un PIN e riattivalo da Sicurezza.');
        return;
      }
      const out = await authenticate();
      if (out === 'ok') { unlockSafely(); return; }
      if (out === 'no_device_lock') {
        useSecurity.getState().set({ lockEnabled: false });
        unlockSafely('Il telefono non ha un blocco schermo configurato: ho disattivato il blocco di LifePilot.');
        return;
      }
      if (out === 'unavailable') { useLockRuntime.getState().setMessage(tr('Autenticazione non disponibile ora. Riprova tra poco.')); return; }
      if (out === 'locked_out') { useLockRuntime.getState().setMessage(tr('Troppi tentativi. Attendi un momento oppure usa il PIN del telefono.')); return; }
      if (out === 'retry') useLockRuntime.getState().setMessage(tr('Non riconosciuto. Riprova o usa il PIN del telefono.'));
    } finally {
      // l'AppState passa da inattivo mentre c'e' la finestra di sistema: ignoro quei cambi per un attimo
      setTimeout(() => { authBusy.current = false; useLockRuntime.getState().setBusy(false); }, 400);
    }
  }, [unlockSafely]);

  // schermo protetto nell'elenco app + copertura immediata quando si attiva
  useEffect(() => { void setPrivacyShield(enabled); }, [enabled]);

  // all'avvio con il blocco attivo: parte bloccata
  useEffect(() => {
    if (enabled && !started.current) { started.current = true; useLockRuntime.getState().setLocked(true); }
    if (!enabled) { started.current = false; useLockRuntime.getState().setLocked(false); }
  }, [enabled]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (authBusy.current) return;
      if (st !== 'active') {
        if (bgAt.current == null) bgAt.current = Date.now();
        setActive(false);
        return;
      }
      setActive(true);
      const lockNow = shouldLockOnResume({ enabled: useSecurity.getState().lockEnabled, timeoutMin: useSecurity.getState().lockTimeoutMin, backgroundedAt: bgAt.current, now: Date.now() });
      bgAt.current = null;
      if (lockNow) useLockRuntime.getState().setLocked(true);
    });
    return () => sub.remove();
  }, []);

  // appena bloccata e in primo piano: chiedo subito lo sblocco
  useEffect(() => { if (enabled && locked && active) void tryAuth(); }, [enabled, locked, active, tryAuth, timeoutMin]);

  if (!enabled || (!locked && active)) return null;
  return (
    <View accessibilityViewIsModal style={[StyleSheet.absoluteFill, { backgroundColor: th.bg, alignItems: 'center', justifyContent: 'center', padding: 32, paddingTop: insets.top + 32, zIndex: 1000 }]}>
      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: th.chip, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Icon name="lock" size={38} color={th.text} />
      </View>
      <Text style={{ color: th.text, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>LifePilot</Text>
      <Text style={{ color: th.muted, fontSize: 15, textAlign: 'center', marginTop: 8 }}>App bloccata</Text>
      {locked && active ? (
        <View style={{ marginTop: 28, alignSelf: 'stretch', gap: 10, maxWidth: 360 }}>
          {message ? <Text style={{ color: th.muted, fontSize: 13, textAlign: 'center' }}>{message}</Text> : null}
          <Btn icon="unlock" title="Sblocca" disabled={busy} onPress={() => void tryAuth()} />
        </View>
      ) : null}
    </View>
  );
}

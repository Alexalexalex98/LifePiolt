import { t } from '../i18n/core.ts';

/** Politica del blocco app: pura, nessun import nativo. */
export const LOCK_TIMEOUTS = [0, 1, 5, 15] as const;
export type LockTimeout = (typeof LOCK_TIMEOUTS)[number];

export const LOCK_LABELS: Record<number, string> = { 0: 'Subito', 1: '1 minuto', 5: '5 minuti', 15: '15 minuti' };

/** Va bloccata l'app al ritorno in primo piano? timeoutMin 0 = ogni volta. */
export function shouldLockOnResume(o: { enabled: boolean; timeoutMin: number; backgroundedAt: number | null; now: number }): boolean {
  if (!o.enabled) return false;
  if (o.backgroundedAt == null) return false;
  if (o.timeoutMin <= 0) return true;
  // orologio riportato indietro (o dato anomalo): nel dubbio, blocca
  if (o.now < o.backgroundedAt) return true;
  return o.now - o.backgroundedAt >= o.timeoutMin * 60_000;
}

export type AuthOutcome = 'ok' | 'retry' | 'cancelled' | 'no_device_lock' | 'locked_out' | 'unavailable';

/** Traduce l'esito di expo-local-authentication. Niente qui puo' mai lasciare fuori l'utente per sempre: ogni esito non-ok permette di riprovare o usa il PIN del telefono. */
export function interpretAuth(r: { success: boolean; error?: string }): AuthOutcome {
  if (r.success) return 'ok';
  switch (r.error) {
    case 'user_cancel': case 'system_cancel': case 'app_cancel': case 'user_fallback': return 'cancelled';
    case 'passcode_not_set': case 'not_enrolled': return 'no_device_lock';
    case 'lockout': return 'locked_out';
    case 'not_available': case 'invalid_context': case 'unable_to_process': case 'no_space': return 'unavailable';
    default: return 'retry';
  }
}

export type LockCapability = { hasHardware: boolean; level: 'none' | 'secret' | 'biometric'; types: ('face' | 'fingerprint' | 'iris')[] };

/** Il blocco si puo' attivare solo se il telefono ha un blocco schermo (PIN, schema o biometria): altrimenti non ci sarebbe un modo di sbloccare. */
export function canEnableLock(c: LockCapability): { ok: boolean; reason?: string } {
  if (c.level === 'none') return { ok: false, reason: 'Il telefono non ha nessun blocco schermo. Impostane uno (PIN, schema o impronta) nelle impostazioni del telefono, poi torna qui.' };
  return { ok: true };
}

/** All'avvio del blocco: se nel frattempo il telefono ha perso il blocco schermo, l'app NON resta chiusa. */
export function lockStillPossible(c: LockCapability): boolean { return c.level !== 'none'; }

export function methodLabel(c: LockCapability): string {
  if (c.level === 'none') return t('Nessun blocco sul telefono');
  const ty = c.types.map((x) => (x === 'face' ? t('Face ID / riconoscimento del volto') : x === 'fingerprint' ? t('impronta') : t('iride')));
  return ty.length ? t('{0} o PIN del telefono', ty.join(', ')) : t('PIN del telefono');
}

import * as LocalAuthentication from 'expo-local-authentication';
import * as ScreenCapture from 'expo-screen-capture';
import { Platform } from 'react-native';

import { t } from '@/i18n/core';

import { interpretAuth, type AuthOutcome, type LockCapability } from './lockPolicy.ts';

/** Blocco app con l'autenticazione di sistema (Face ID / impronta / PIN del telefono). Non testabile in Node: vedi docs/storage.md. */
export async function lockCapability(): Promise<LockCapability> {
  if (Platform.OS === 'web') return { hasHardware: false, level: 'none', types: [] };
  try {
    const [hasHardware, level, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.getEnrolledLevelAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    return {
      hasHardware,
      level: level === LocalAuthentication.SecurityLevel.NONE ? 'none' : level === LocalAuthentication.SecurityLevel.SECRET ? 'secret' : 'biometric',
      types: types.map((x) => (x === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION ? 'face' : x === LocalAuthentication.AuthenticationType.IRIS ? 'iris' : 'fingerprint')),
    };
  } catch {
    return { hasHardware: false, level: 'none', types: [] };
  }
}

/** Chiede lo sblocco. Il PIN/schema del telefono resta sempre disponibile come alternativa (disableDeviceFallback: false). */
export async function authenticate(): Promise<AuthOutcome> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: t('Sblocca LifePilot'),
      cancelLabel: t('Annulla'),
      fallbackLabel: t('Usa il PIN del telefono'),
      disableDeviceFallback: false,
    });
    return interpretAuth(r.success ? { success: true } : { success: false, error: r.error });
  } catch {
    return 'unavailable';
  }
}

/** Nasconde l'anteprima nell'elenco delle app recenti: sfocatura su iOS, FLAG_SECURE su Android (blocca anche gli screenshot). */
export async function setPrivacyShield(on: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (on) {
      await ScreenCapture.enableAppSwitcherProtectionAsync(1);
      if (Platform.OS === 'android') await ScreenCapture.preventScreenCaptureAsync('lp-lock');
    } else {
      await ScreenCapture.disableAppSwitcherProtectionAsync();
      if (Platform.OS === 'android') await ScreenCapture.allowScreenCaptureAsync('lp-lock');
    }
  } catch { /* modulo non disponibile: resta la copertura in JS */ }
}

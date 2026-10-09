import * as Clipboard from 'expo-clipboard';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { logError } from '@/lib/errorLog';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { translateText } from '@/i18n/core';

const useErr = create<{ msg: string | null; set: (m: string | null) => void }>((set) => ({ msg: null, set: (msg) => set({ msg }) }));

let installed = false;
/**
 * Un errore dentro un pulsante non deve più mostrare la schermata rossa con il codice o bloccare l'app:
 * compare un avviso con il messaggio (si può copiare e mandare al supporto).
 */
export function installGlobalErrors() {
  if (installed) return;
  installed = true;
  const show = (e: unknown) => {
    const m = e instanceof Error ? e.message : String(e);
    if (/Text strings must be rendered|Hydration|#418/.test(m)) return;
    logError(e);
    useErr.getState().set(m.slice(0, 280));
  };
  try {
    // sul web gli errori degli handler non passano da ErrorUtils
    const w = globalThis as unknown as { addEventListener?: (t: string, h: (e: { error?: unknown; reason?: unknown }) => void) => void; document?: unknown };
    if (w.document && w.addEventListener) {
      w.addEventListener('error', (e) => show(e.error ?? 'Errore'));
      w.addEventListener('unhandledrejection', (e) => show(e.reason ?? 'Errore'));
    }
  } catch { /* ignora */ }
  // sul web non esiste ErrorUtils: si ascoltano gli eventi del browser
  try {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('error', (ev) => { if (/ResizeObserver/.test(ev.message ?? '')) return; show(ev.error ?? ev.message); });
      window.addEventListener('unhandledrejection', (ev) => show(ev.reason));
    }
  } catch { /* ignore */ }
  const EU = (globalThis as unknown as { ErrorUtils?: { setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } }).ErrorUtils;
  EU?.setGlobalHandler((e) => show(e));
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({ allRejections: true, onUnhandled: (_id: number, e: unknown) => show(e) });
  } catch { /* non disponibile (web) */ }
}

export function ErrorBanner() {
  const msg = useErr((s) => s.msg);
  const set = useErr((s) => s.set);
  const insets = useSafeAreaInsets();
  const t = useTheme();
  // l'avviso sta sopra la barra superiore (Menu, Notifiche): se resta lì copre i pulsanti, quindi sparisce da solo
  useEffect(() => {
    if (!msg) return;
    const h = setTimeout(() => set(null), 9000);
    return () => clearTimeout(h);
  }, [msg, set]);
  if (!msg) return null;
  const light = t.mode === 'light';
  const fg = light ? '#5c1010' : '#ffd9d9';
  const ic = light ? t.danger : '#ff9d9d';
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 10, right: 10, top: insets.top + 6, zIndex: 100 }}>
      <View accessibilityRole="alert" style={{ backgroundColor: t.dangerBg, borderColor: ic, borderWidth: 1, borderRadius: 14, padding: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="alert" size={18} color={ic} />
          <Text style={{ color: fg, fontWeight: '800', flex: 1 }}>Qualcosa non ha funzionato</Text>
          <Pressable onPress={() => void Clipboard.setStringAsync(msg)} hitSlop={14} accessibilityRole="button" accessibilityLabel={translateText("Copia il messaggio di errore")}><Text style={{ color: fg, fontSize: 12, textDecorationLine: 'underline' }}>Copia</Text></Pressable>
          <Pressable onPress={() => set(null)} hitSlop={14} accessibilityRole="button" accessibilityLabel={translateText("Chiudi avviso")}><Icon name="x" size={18} color={fg} /></Pressable>
        </View>
        <Text style={{ color: fg, fontSize: 12, marginTop: 6 }} selectable>{msg}</Text>
      </View>
    </View>
  );
}

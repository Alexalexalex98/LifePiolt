import * as Clipboard from 'expo-clipboard';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { logError } from '@/lib/errorLog';
import { Icon } from '@/lib/icons';

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
  if (!msg) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 10, right: 10, top: insets.top + 6, zIndex: 100 }}>
      <View style={{ backgroundColor: '#3b1f24', borderColor: '#ff9d9d', borderWidth: 1, borderRadius: 14, padding: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="alert" size={18} color="#ff9d9d" />
          <Text style={{ color: '#ffd9d9', fontWeight: '800', flex: 1 }}>Qualcosa non ha funzionato</Text>
          <Pressable onPress={() => void Clipboard.setStringAsync(msg)} hitSlop={10}><Text style={{ color: '#ffd9d9', fontSize: 12, textDecorationLine: 'underline' }}>Copia</Text></Pressable>
          <Pressable onPress={() => set(null)} hitSlop={10}><Icon name="x" size={18} color="#ffd9d9" /></Pressable>
        </View>
        <Text style={{ color: '#ffd9d9', fontSize: 12, marginTop: 6 }} selectable>{msg}</Text>
      </View>
    </View>
  );
}

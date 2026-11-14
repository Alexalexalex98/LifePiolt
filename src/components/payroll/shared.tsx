import { View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Input, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { formatMoney } from '@/i18n/format';
import { monthNames } from '@/lib/format';
import { fromFile, fromPhoto, scanDocument, type Captured } from '@/lib/warrantyScan';

export const eur = (n: number, currency: 'EUR' | 'CHF' = 'EUR') => formatMoney(n, { decimals: 2, currency });
export const WD = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
export const monthTitle = (m: string) => `${tl(monthNames[Number(m.slice(5, 7)) - 1] ?? '')} ${m.slice(0, 4)}`;
/** «12,5» o «12.5» → numero; vuoto → 0 */
export const toNum = (s: string): number => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : 0; };
export const fromNum = (n: number | undefined): string => (n ? String(n).replace('.', ',') : '');

/** Un campo con la sua etichetta. */
export function Field({ label, value, onChange, placeholder, numeric, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; numeric?: boolean; hint?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Body small muted>{tl(label)}</Body>
      <Input value={value} onChangeText={onChange} placeholder={placeholder} keyboardType={numeric ? 'decimal-pad' : 'default'} />
      {hint ? <Body small muted>{tl(hint)}</Body> : null}
    </View>
  );
}

export function Big({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  const th = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: color ?? th.text, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      <Body small muted>{tl(label)}</Body>
      {sub ? <Body small muted>{sub}</Body> : null}
    </View>
  );
}

/** Come aggiungere un documento: scansione, foto, galleria, file o a mano. Le foto vanno all'AI solo con il permesso. */
export function CaptureSheet({ visible, title, onClose, onCaptured, onManual }: { visible: boolean; title: string; onClose: () => void; onCaptured: (c: Captured) => void; onManual?: () => void }) {
  const go = (f: () => Promise<Captured | null>) => { onClose(); void f().then((c) => { if (c) onCaptured(c); }); };
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <View style={{ gap: 8 }}>
        <Btn icon="camera" title="Scansiona" onPress={() => go(scanDocument)} />
        <Btn ghost icon="camera" title="Scatta una foto" onPress={() => go(() => fromPhoto('camera'))} />
        <Btn ghost icon="image" title="Scegli dalla galleria" onPress={() => go(() => fromPhoto('gallery'))} />
        <Btn ghost icon="file" title="Scegli un PDF o un file" onPress={() => go(fromFile)} />
        {onManual ? <Btn ghost icon="edit" title="Inserisci a mano" onPress={() => { onClose(); onManual(); }} /> : null}
      </View>
      <Body small muted style={{ marginTop: 10 }}>{tl('Theia legge il documento solo con il tuo permesso. Controlla sempre i numeri prima di salvare: li puoi correggere.')}</Body>
    </Sheet>
  );
}

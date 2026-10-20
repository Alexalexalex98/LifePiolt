import { useState, type ReactNode } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Text } from '@/components/T';
import { Body } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { translateText } from '@/i18n/core';
import { Icon } from '@/lib/icons';

/** Pezzi condivisi dei moduli di inserimento dati: stesso stile LifePilot (una sola tinta, angoli morbidi, niente campi nudi). */

/** Intestazione di un modulo: icona in un tondo, titolo e a cosa serve. */
export function FormHead({ icon, title, text }: { icon: string; title: string; text: string }) {
  const th = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 14 }}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: th.accent + '24', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} color={th.accent} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: th.text, fontSize: 17, fontWeight: '800' }}>{translateText(title)}</Text>
        <Body small muted>{text}</Body>
      </View>
    </View>
  );
}

/** Importo grande e centrato con la sigla, al posto del campo di testo nudo. */
export function AmountField({ value, onChange, unit = 'CHF', label, hint }: { value: string; onChange: (v: string) => void; unit?: string; label: string; hint?: string }) {
  const th = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: th.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginBottom: 6 }}>{translateText(label).toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8, paddingVertical: 18, borderRadius: 20, backgroundColor: th.item, borderWidth: 1.5, borderColor: focus ? th.accent : 'transparent' }}>
        <TextInput
          value={value} onChangeText={onChange} keyboardType="numbers-and-punctuation" placeholder="0.00" placeholderTextColor={th.muted}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} accessibilityLabel={translateText(label)}
          style={{ color: th.text, fontSize: 38, fontWeight: '800', letterSpacing: -1, minWidth: 90, textAlign: 'center', padding: 0 }}
        />
        <Text style={{ color: th.muted, fontSize: 16, fontWeight: '700' }}>{unit}</Text>
      </View>
      {hint ? <Body small muted style={{ marginTop: 6, textAlign: 'center' }}>{hint}</Body> : null}
    </View>
  );
}

/** Numero con tasti meno/più: niente tastiera per valori piccoli (giorni, mesi). */
export function Stepper({ value, onChange, min, max, label, suffix }: { value: number; onChange: (n: number) => void; min: number; max: number; label: string; suffix?: string }) {
  const th = useTheme();
  const btn = (name: string, d: number, off: boolean) => (
    <Pressable onPress={() => onChange(Math.min(max, Math.max(min, value + d)))} disabled={off} accessibilityRole="button" accessibilityLabel={translateText(d > 0 ? 'Aumenta' : 'Diminuisci')} hitSlop={6}
      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: th.accent + (off ? '10' : '24'), alignItems: 'center', justifyContent: 'center', opacity: off ? 0.5 : 1 }}>
      <Icon name={name} size={18} color={th.accent} stroke={2.4} />
    </Pressable>
  );
  return (
    <View style={{ flex: 1, backgroundColor: th.item, borderRadius: 18, padding: 12, alignItems: 'center' }}>
      <Text style={{ color: th.muted, fontSize: 12, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>{translateText(label)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {btn('minus', -1, value <= min)}
        <View style={{ minWidth: 44, alignItems: 'center' }}>
          <Text style={{ color: th.text, fontSize: 28, fontWeight: '800' }}>{value}</Text>
          {suffix ? <Text style={{ color: th.muted, fontSize: 11 }}>{translateText(suffix)}</Text> : null}
        </View>
        {btn('plus', 1, value >= max)}
      </View>
    </View>
  );
}

/** Scelta tra poche opzioni, a pillole. */
export function Segments<T extends string | number>({ options, value, onChange, label }: { options: { v: T; label: string }[]; value: T; onChange: (v: T) => void; label?: string }) {
  const th = useTheme();
  return (
    <View style={{ marginBottom: 10 }}>
      {label ? <Text style={{ color: th.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginBottom: 6 }}>{translateText(label).toUpperCase()}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const on = o.v === value;
          return (
            <Pressable key={String(o.v)} onPress={() => onChange(o.v)} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, backgroundColor: on ? th.accent : th.item, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {on ? <Icon name="check" size={14} color={th.onText} stroke={2.6} /> : null}
              <Text style={{ color: on ? th.onText : th.text, fontWeight: '700', fontSize: 13.5 }}>{translateText(o.label)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Riquadro «ecco cosa succede» con il risultato in anteprima. */
export function Preview({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  const th = useTheme();
  return (
    <View style={{ backgroundColor: th.accent + '14', borderRadius: 18, padding: 14, marginTop: 4, marginBottom: 4 }}>
      <Text style={{ color: th.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>{translateText(label).toUpperCase()}</Text>
      <Text style={{ color: th.text, fontSize: 24, fontWeight: '800', marginTop: 2 }}>{value}</Text>
      {children}
    </View>
  );
}

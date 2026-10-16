import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { pickNetMedia, type NetMedia } from '@/lib/netMedia';
import { toast } from '@/store/toast';
import { translateText } from '@/i18n/core';

/** Scelta di foto o video con anteprima e possibilità di rimuoverli prima di pubblicare. */
export function MediaPickerField({ value, onChange, detach }: { value: NetMedia | null; onChange: (v: NetMedia | null) => void; /** dentro una finestra (Modal) su iPhone il selettore non si apre: chi usa il campo chiude la finestra, sceglie e la riapre */ detach?: (kind: 'photo' | 'video') => void }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  async function pick(kind: 'photo' | 'video') {
    if (busy) return;
    if (detach) { detach(kind); return; }
    setBusy(true);
    try {
      const m = await pickNetMedia(kind);
      if (m) onChange(m);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Non riesco ad aprire la libreria');
    } finally { setBusy(false); }
  }
  if (value) {
    return (
      <View style={{ marginBottom: 10 }}>
        <View style={{ height: 180, borderRadius: 14, overflow: 'hidden', backgroundColor: t.item, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={translateText(value.media === 'video' ? 'Anteprima del video scelto' : 'Anteprima della foto scelta')}>
          {value.media === 'photo'
            ? <Image source={{ uri: value.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            : <View style={{ alignItems: 'center', gap: 6 }}><Icon name="play" size={34} color={t.text} fill={t.text} /><Text style={{ color: t.muted, fontSize: 12 }}>Video scelto{value.durationMs ? ` · ${Math.round(value.durationMs / 1000)} s` : ''}</Text></View>}
          <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel={translateText("Rimuovi")} style={{ position: 'absolute', top: 8, end: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: '#000c', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={16} color="#fff" stroke={2.4} /></Pressable>
        </View>
        <Body small muted style={{ marginTop: 4 }}>Anteprima: così apparirà nel post. Tocca la X per toglierla.</Body>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
      {([['photo', 'image', 'Foto', 'Dalla galleria'], ['video', 'video', 'Video', 'Fino a 30 secondi']] as const).map(([k, ic, label, sub]) => (
        <Pressable key={k} onPress={() => void pick(k)} disabled={busy} accessibilityRole="button" accessibilityLabel={translateText(k === 'photo' ? 'Aggiungi foto' : 'Aggiungi video')} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: t.chip, opacity: busy ? 0.5 : pressed ? 0.85 : 1 })}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.accent + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name={ic} size={20} color={t.accent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontWeight: '800', fontSize: 15 }}>{translateText(label)}</Text>
            <Text numberOfLines={1} style={{ color: t.muted, fontSize: 11.5, marginTop: 1 }}>{translateText(sub)}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

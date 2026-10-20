import { StoryFx } from '@/components/stories/StoryFx';
import type { PostFx } from '@/lib/editorHandoff';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { pickNetMedia, takeNetPhoto, type NetMedia } from '@/lib/netMedia';
import { toast } from '@/store/toast';
import { translateText } from '@/i18n/core';

/** Scelta di foto o video con anteprima e possibilità di rimuoverli prima di pubblicare. */
export function MediaPickerField({ value, onChange, detach, onEdit, fx }: { value: NetMedia | null; onChange: (v: NetMedia | null) => void; /** apre l'editor, lo stesso dei recap */ onEdit?: () => void; fx?: PostFx; /** dentro una finestra (Modal) su iPhone il selettore non si apre: chi usa il campo chiude la finestra, sceglie e la riapre */ detach?: (kind: 'photo' | 'video' | 'camera') => void }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  async function pick(kind: 'photo' | 'video' | 'camera') {
    if (busy) return;
    if (detach) { detach(kind); return; }
    setBusy(true);
    try {
      const m = kind === 'camera' ? await takeNetPhoto() : await pickNetMedia(kind);
      if (m) onChange(m);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Non riesco ad aprire la libreria');
    } finally { setBusy(false); }
  }
  if (value) {
    return (
      <View style={{ marginBottom: 12 }}>
        <View style={{ height: 380, borderRadius: 22, overflow: 'hidden', backgroundColor: t.item, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={translateText(value.media === 'video' ? 'Anteprima del video scelto' : 'Anteprima della foto scelta')}>
          {value.media === 'photo'
            ? <Image source={{ uri: value.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            : <View style={{ alignItems: 'center', gap: 6 }}><Icon name="play" size={44} color={t.text} fill={t.text} /><Text style={{ color: t.muted, fontSize: 13 }}>Video scelto{value.durationMs ? ` · ${Math.round(value.durationMs / 1000)} s` : ''}</Text></View>}
          <StoryFx s={{ filter: fx?.filter, adj: fx?.adj }} uri={value.media === 'photo' ? value.uri : undefined} />
          <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel={translateText('Rimuovi')} style={{ position: 'absolute', top: 12, end: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={18} color="#fff" stroke={2.4} /></Pressable>
          <View style={{ position: 'absolute', bottom: 12, start: 12, end: 12, flexDirection: 'row', gap: 10 }}>
            {onEdit ? <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={translateText(value.media === 'photo' ? 'Ritocca la foto' : 'Modifica')} style={{ flex: 1.4, height: 46, borderRadius: 23, backgroundColor: t.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Icon name="sun" size={19} color={t.onText} stroke={2.1} /><Text style={{ color: t.onText, fontWeight: '900', fontSize: 15 }}>{translateText(value.media === 'photo' ? 'Ritocca' : 'Modifica')}</Text></Pressable> : null}
            <Pressable onPress={() => void pick(value.media === 'video' ? 'video' : 'photo')} accessibilityRole="button" accessibilityLabel={translateText('Cambia')} style={{ flex: 1, height: 46, borderRadius: 23, backgroundColor: '#000b', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Icon name="image" size={18} color="#fff" stroke={2} /><Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{translateText('Cambia')}</Text></Pressable>
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={{ borderRadius: 22, backgroundColor: t.item, padding: 16, marginBottom: 12 }}>
      <Text style={{ color: t.text, fontWeight: '800', fontSize: 17 }}>{translateText('Aggiungi una foto o un video')}</Text>
      <Text style={{ color: t.muted, fontSize: 13, marginTop: 2, marginBottom: 14 }}>{translateText('Poi la ritocchi con luce, colori e look, prima di pubblicare.')}</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {([['photo', 'image', 'Galleria'], ['camera', 'camera', 'Fotocamera'], ['video', 'video', 'Video']] as const).map(([k, ic, label]) => (
          <Pressable key={k} onPress={() => void pick(k)} disabled={busy} accessibilityRole="button" accessibilityLabel={translateText(label)} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 18, backgroundColor: pressed ? t.accent + '33' : t.accent + '1c', opacity: busy ? 0.5 : 1 })}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.accent + '30', alignItems: 'center', justifyContent: 'center' }}><Icon name={ic} size={23} color={t.accent} stroke={2} /></View>
            <Text style={{ color: t.text, fontWeight: '800', fontSize: 14 }}>{translateText(label)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

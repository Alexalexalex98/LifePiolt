import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/T';

import { Press } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { translateText } from '@/i18n/core';
import type { Cover } from '@/lib/club';

/** Copertina del club: immagine scelta dal creatore oppure sfumatura con icona. */
export function CoverArt({ cover, size = 56, icon = 'lifeclub', style, height, radius = 14 }: { cover: Cover; size?: number; icon?: string; style?: StyleProp<ViewStyle>; height?: number; radius?: number }) {
  const h = height ?? size;
  return (
    <View style={[{ width: height ? '100%' : size, height: h, borderRadius: radius, overflow: 'hidden' }, style]}>
      {cover.uri
        ? <Image source={{ uri: cover.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        : (
          <LinearGradient colors={[cover.c1, cover.c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={Math.max(22, Math.min(size, h) * 0.5)} color="#ffffff" stroke={1.7} />
          </LinearGradient>
        )}
    </View>
  );
}

/** Stelle cliccabili (1-5). */
export function Stars({ value, onChange, size = 22 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityRole={onChange ? 'adjustable' : 'image'} accessibilityLabel={translateText(`${Math.round(value * 10) / 10} stelle su 5`)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} disabled={!onChange} onPress={() => onChange?.(i)} hitSlop={4} accessibilityLabel={translateText(`${i} stelle`)}>
          <Icon name="star" size={size} color={i <= Math.round(value) ? '#f5b301' : t.border} fill={i <= Math.round(value) ? '#f5b301' : 'none'} />
        </Pressable>
      ))}
    </View>
  );
}

/** Etichetta piccola tonda (es. FREE, PREMIUM). */
export function Chip({ label, icon, color, on }: { label: string; icon?: string; color?: string; on?: boolean }) {
  const t = useTheme();
  const c = color ?? t.muted;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: on ? c : t.chip }}>
      {icon ? <Icon name={icon} size={11} color={on ? '#fff' : c} stroke={2.2} /> : null}
      <Text style={{ color: on ? '#fff' : c, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

/** Banner onesto: spiega che in questa versione tutto e' locale. */
export function PreviewNote({ text }: { text?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 10, borderRadius: 12, backgroundColor: t.chip, marginBottom: 12 }}>
      <Icon name="info" size={16} color={t.muted} />
      <Text style={{ flex: 1, color: t.muted, fontSize: 12, lineHeight: 17 }}>{text ?? 'Anteprima: contenuti e pagamenti reali si attivano col server. Per ora tutto resta su questo telefono e non viene addebitato nulla.'}</Text>
    </View>
  );
}

export function IconBtn({ icon, label, onPress, color, size = 20 }: { icon: string; label: string; onPress: () => void; color?: string; size?: number }) {
  const t = useTheme();
  return (
    <Press onPress={onPress} accessibilityLabel={label} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size} color={color ?? t.text} />
    </Press>
  );
}

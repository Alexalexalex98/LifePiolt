import { LinearGradient } from 'expo-linear-gradient';
import { Linking, Platform, Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { Icon } from '@/lib/icons';
import { mapsUrl } from '@/lib/maps';
import { go } from '@/lib/nav';
import { TEXT_SIZES, adjustLayers, tintOfFilter, type Story } from '@/lib/stories';
import { toast } from '@/store/toast';

const FILL = { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 } as const;

/** Filtro e ritocchi: veli di colore sopra la foto o il video (stessa resa in anteprima, nel recap e nell'editor). */
export function StoryFx({ s }: { s: Pick<Story, 'filter' | 'adj'> }) {
  const tint = tintOfFilter(s.filter);
  const layers = adjustLayers(s.adj);
  const vign = s.adj?.vign ?? 0;
  if (!tint && !layers.length && !vign) return null;
  return (
    <View pointerEvents="none" style={FILL}>
      {tint ? <View style={[FILL, { backgroundColor: tint }]} /> : null}
      {layers.map((c, i) => <View key={i} style={[FILL, { backgroundColor: c }]} />)}
      {vign ? <LinearGradient colors={[`rgba(0,0,0,${vign * 0.7})`, 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', `rgba(0,0,0,${vign * 0.7})`]} locations={[0, 0.3, 0.7, 1]} style={FILL} /> : null}
    </View>
  );
}

/** La scritta sul momento, con dimensione e stile scelti. */
export function storyTextStyle(s: Pick<Story, 'textColor' | 'textSize' | 'textStyle'>, base = 1) {
  const size = TEXT_SIZES[s.textSize ?? 'M'] * base;
  const color = s.textColor ?? '#fff';
  const common = { color, fontSize: size, fontWeight: '900' as const, textAlign: 'center' as const };
  if (s.textStyle === 'riquadro') return { ...common, color: '#111', backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' as const, alignSelf: 'center' as const };
  if (s.textStyle === 'evidenziato') return { ...common, backgroundColor: color === '#ffffff' || !s.textColor ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' as const, alignSelf: 'center' as const };
  return { ...common, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 8 };
}

/** Adesivi sul momento: persone, hashtag, link e ciò che è collegato (impegno, seminario, idea, luogo). Chi guarda ci tocca e va. */
export function StoryStickers({ s, bottom }: { s: Story; bottom: number }) {
  const chips: { key: string; icon: string; label: string; onPress?: () => void }[] = [];
  if (s.attach) {
    const a = s.attach;
    chips.push({ key: 'att', icon: a.kind === 'place' ? 'location' : a.kind === 'event' ? 'calendar' : a.kind === 'idea' ? 'sparkle' : 'users', label: a.label, onPress: a.kind === 'seminar' && a.ref ? () => go('seminarPage', { id: a.ref! }) : a.kind === 'idea' && a.ref ? () => go('ideaProfile', { id: a.ref! }) : a.kind === 'event' ? () => go('plan') : a.kind === 'place' ? () => { Linking.openURL(mapsUrl(a.label, Platform.OS)).catch(() => toast('Non riesco ad aprire le mappe')); } : undefined });
  }
  for (const p of s.people ?? []) chips.push({ key: 'p' + p, icon: 'profile', label: p, onPress: () => go('userProfile', { name: p }) });
  for (const t of s.tags ?? []) chips.push({ key: 't' + t, icon: 'search', label: '#' + t });
  if (s.link) chips.push({ key: 'l', icon: 'link', label: s.link.replace(/^https?:\/\//, '').slice(0, 28), onPress: () => { Linking.openURL(s.link!).catch(() => toast('Non riesco ad aprire il link')); } });
  if (!chips.length) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', start: 12, end: 12, bottom, flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
      {chips.map((c) => (
        <Pressable key={c.key} disabled={!c.onPress} onPress={c.onPress} accessibilityRole={c.onPress ? 'link' : 'text'} accessibilityLabel={c.label} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}>
          <Icon name={c.icon} size={13} color="#fff" />
          <Text numberOfLines={1} style={{ color: '#fff', fontSize: 12.5, fontWeight: '700', maxWidth: 220 }}>{c.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/T';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { CAT_COLOR, DIFF_LABEL, fmtMin, nutritionPer, totalMin, type FullRecipe } from '@/lib/recipes/book';

export function Dots({ n, color }: { n: number; color: string }) {
  return <View style={{ flexDirection: 'row', gap: 3 }}>{[1, 2, 3].map((i) => <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i <= n ? color : color + '44' }} />)}</View>;
}

/** Scheda di una ricetta nell'elenco: colore della categoria, tempo, difficoltà, calorie a porzione e cuore dei preferiti. */
export function RecipeCard({ r, onPress, fav, onFav, width, note }: { r: FullRecipe; onPress: () => void; fav?: boolean; onFav?: () => void; width?: number; note?: string }) {
  const th = useTheme(); const c = CAT_COLOR[r.cat];
  const kcal = nutritionPer(r).kcal;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={r.name} style={{ width, flexGrow: width ? 0 : 1, backgroundColor: th.card, borderRadius: 20, borderWidth: 1, borderColor: th.border, overflow: 'hidden' }}>
      <LinearGradient colors={[c + 'cc', c + '33']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 74, padding: 10, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>{tl(r.cat)}</Text>
          {onFav ? <Pressable onPress={onFav} hitSlop={10} accessibilityRole="button" accessibilityLabel={fav ? tl('Togli dai preferiti') : tl('Aggiungi ai preferiti')}><Icon name="heart" size={18} color="#fff" fill={fav ? '#fff' : 'none'} /></Pressable> : null}
        </View>
        {r.region ? <Text style={{ color: '#ffffffd0', fontSize: 11 }}>{r.region}</Text> : null}
      </LinearGradient>
      <View style={{ padding: 12, gap: 6 }}>
        <Text numberOfLines={2} style={{ color: th.text, fontSize: 15.5, fontWeight: '800', minHeight: 40 }}>{r.name}</Text>
        {note ? <Text numberOfLines={1} style={{ color: th.accent, fontSize: 12, fontWeight: '700' }}>{note}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="clock" size={13} color={th.muted} /><Text style={{ color: th.muted, fontSize: 12 }}>{fmtMin(totalMin(r))}</Text></View>
          <Dots n={r.diff} color={th.accent} />
          <Text style={{ color: th.muted, fontSize: 12 }}>{`${kcal} kcal`}</Text>
        </View>
        <Text style={{ color: th.muted, fontSize: 11 }}>{tl(DIFF_LABEL[r.diff]!)}{r.basic ? ` · ${tl('passaggi essenziali')}` : ''}</Text>
      </View>
    </Pressable>
  );
}

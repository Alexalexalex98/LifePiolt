import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/T';

import { UserAvatar } from '@/components/network';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { addSignal } from '@/lib/relevance';
import { SWIPE_SIGNAL, nextCard, record, remaining, undoLast, type DeckCard } from '@/lib/swipeDeck';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';
import { go } from '@/lib/nav';

export type SwipeCandidate = DeckCard & { tag?: string; uri?: string; media?: 'photo' | 'video' | null };
const buzz = () => { if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined); };
const THRESHOLD = 90;

/** Un post alla volta: scorri a sinistra se ti interessa, a destra se non ti interessa. Così il feed impara cosa vuoi vedere. */
export function SwipeDeck({ cards }: { cards: SwipeCandidate[] }) {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const swipes = useNet((s) => s.swipes);
  const weights = useNet((s) => s.themeWeights);
  const { width } = useWindowDimensions();
  const [help, setHelp] = useState(false);
  const x = useRef(new Animated.Value(0)).current;
  const card = useMemo(() => nextCard(cards, swipes, weights, me) as SwipeCandidate | null, [cards, swipes, weights, me]);
  const left = remaining(cards, swipes, weights, me);
  const cardRef = useRef(card); cardRef.current = card;

  const decide = (dir: 'yes' | 'no') => {
    const c = cardRef.current; if (!c) return;
    buzz();
    const st = useNet.getState();
    st.patch({ swipes: record(st.swipes, c.key, dir, Date.now()), themeWeights: addSignal(st.themeWeights, `${c.text} ${c.tag ?? ''}`, dir === 'yes' ? SWIPE_SIGNAL : -SWIPE_SIGNAL) });
    if (dir === 'yes') st.bumpReach(c.key, 'like');
    x.setValue(0);
  };
  const fling = (dir: 'yes' | 'no') => Animated.timing(x, { toValue: dir === 'yes' ? -width : width, duration: 190, useNativeDriver: Platform.OS !== 'web' }).start(() => decide(dir));
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
    onPanResponderMove: Animated.event([null, { dx: x }], { useNativeDriver: false }),
    onPanResponderRelease: (_e, g) => {
      if (g.dx <= -THRESHOLD || g.vx < -0.9) fling('yes');
      else if (g.dx >= THRESHOLD || g.vx > 0.9) fling('no');
      else Animated.spring(x, { toValue: 0, useNativeDriver: false, friction: 7 }).start();
    },
  })).current;
  const rot = x.interpolate({ inputRange: [-width, 0, width], outputRange: ['-14deg', '0deg', '14deg'] });
  const yesOp = x.interpolate({ inputRange: [-THRESHOLD, -20, 0], outputRange: [1, 0.2, 0], extrapolate: 'clamp' });
  const noOp = x.interpolate({ inputRange: [0, 20, THRESHOLD], outputRange: [0, 0.2, 1], extrapolate: 'clamp' });
  const undo = () => { const st = useNet.getState(); const u = undoLast(st.swipes); if (u.undone) { st.patch({ swipes: u.swipes, themeWeights: addSignal(st.themeWeights, `${u.undone.key}`, 0) }); buzz(); } };

  if (!card) {
    return (
      <View style={{ margin: 16, padding: 24, borderRadius: 24, backgroundColor: t.card, alignItems: 'center', gap: 8 }}>
        <Icon name="sparkle" size={30} color={t.accent} />
        <Text style={{ color: t.text, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>{tl('Per ora hai visto tutto')}</Text>
        <Text style={{ color: t.muted, textAlign: 'center' }}>{tl('Quando ci saranno nuovi post che potrebbero interessarti, li trovi qui. I tuoi preferiti sono già in «Per te».')}</Text>
        {(swipes ?? []).length ? <Pressable accessibilityRole="button" onPress={undo} style={{ marginTop: 8 }}><Text style={{ color: t.accent, fontWeight: '800' }}>{tl('Annulla l’ultima scelta')}</Text></Pressable> : null}
      </View>
    );
  }
  const W = Math.min(width - 32, 420);
  return (
    <View style={{ alignItems: 'center', paddingVertical: 8 }}>
      <Text style={{ color: t.muted, fontSize: 12.5, marginBottom: 8 }}>{tl('{0} post da scoprire', left)}</Text>
      <Animated.View {...pan.panHandlers} style={{ width: W, transform: [{ translateX: x }, { rotate: rot }] }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Post di {0}. Tocca per vedere come funziona lo swipe', card.author)} onPress={() => setHelp(true)} style={{ borderRadius: 26, overflow: 'hidden', backgroundColor: t.card, borderWidth: t.mode === 'light' ? 1 : 0, borderColor: t.border }}>
          {card.uri ? <Image source={{ uri: card.uri }} style={{ width: '100%', height: W * 1.05 }} contentFit="cover" /> : (
            <LinearGradient colors={['#4a3bd1', '#1b1f3a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: W * 0.75, padding: 22, justifyContent: 'center' }}>
              <Text numberOfLines={7} style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{card.text}</Text>
            </LinearGradient>
          )}
          <View style={{ padding: 14, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <UserAvatar name={card.author} size={34} />
              <Text onPress={() => go('userProfile', { name: card.author })} style={{ color: t.text, fontWeight: '800', fontSize: 15, flex: 1 }}>{card.author}</Text>
              {card.tag ? <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, backgroundColor: t.chip }}><Text style={{ color: t.muted, fontSize: 11.5, fontWeight: '700' }}>{card.tag}</Text></View> : null}
            </View>
            {card.uri ? <Text numberOfLines={3} style={{ color: t.text, fontSize: 15 }}>{card.text}</Text> : null}
          </View>
          <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 24, end: 18, opacity: yesOp, borderWidth: 3, borderColor: '#2fd58a', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, transform: [{ rotate: '10deg' }] }}><Text style={{ color: '#2fd58a', fontWeight: '900', fontSize: 20 }}>{tl('MI INTERESSA')}</Text></Animated.View>
          <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 24, start: 18, opacity: noOp, borderWidth: 3, borderColor: '#ff5d6c', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, transform: [{ rotate: '-10deg' }] }}><Text style={{ color: '#ff5d6c', fontWeight: '900', fontSize: 20 }}>{tl('NON MI INTERESSA')}</Text></Animated.View>
          {help ? (
            <Pressable onPress={() => setHelp(false)} accessibilityRole="button" accessibilityLabel={tl('Chiudi la spiegazione')} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Icon name="arrow-left" size={30} color="#2fd58a" /><Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>{tl('Swipe a sinistra: mi interessa')}</Text></View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>{tl('Swipe a destra: non mi interessa')}</Text><Icon name="arrow-right" size={30} color="#ff5d6c" /></View>
              <Text style={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center', fontSize: 13 }}>{tl('Quelli che ti interessano tornano in «Per te», nell’ordine in cui li scegli. Gli altri, e quelli simili, non te li propongo più.')}</Text>
              <Text style={{ color: '#8fa4ff', fontWeight: '800' }}>{tl('Tocca per continuare')}</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Animated.View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: 16 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Mi interessa')} onPress={() => fling('yes')} style={({ pressed }) => ({ width: 62, height: 62, borderRadius: 31, backgroundColor: '#2fd58a', alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.92 : 1 }] })}><Icon name="heart" size={28} color="#fff" /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Torna all’ultimo')} onPress={undo} disabled={!(swipes ?? []).length} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center', opacity: (swipes ?? []).length ? 1 : 0.4 }}><Icon name="repeat" size={20} color={t.text} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Non mi interessa')} onPress={() => fling('no')} style={({ pressed }) => ({ width: 62, height: 62, borderRadius: 31, backgroundColor: '#ff5d6c', alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.92 : 1 }] })}><Icon name="x" size={28} color="#fff" /></Pressable>
      </View>
      <Text style={{ color: t.muted, fontSize: 12, marginTop: 10 }}>{tl('← mi interessa    non mi interessa →')}</Text>
    </View>
  );
}

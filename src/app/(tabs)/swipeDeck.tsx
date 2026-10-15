import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
import { Animated, Easing, PanResponder, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SwipeDeck, type SwipeCandidate } from '@/components/feed/SwipeDeck';
import { goBack } from '@/lib/nav';
import { useVisible } from '@/lib/moderation';
import { byReach } from '@/lib/reach';
import { useSeedMedia } from '@/lib/seedMedia';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';

/** Swipe dei post a schermo intero: si vede solo il post. */
export default function SwipePage() {
  useSeedMedia();
  const { start } = useLocalSearchParams<{ start?: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const x = useRef(new Animated.Value(width)).current;
  const busy = useRef(false);
  /* la pagina resta montata: a ogni apertura entra da destra verso sinistra */
  useFocusEffect(useCallback(() => {
    busy.current = false;
    x.setValue(width);
    Animated.timing(x, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [x, width]));
  /** Esce con la stessa transizione: verso destra si torna a «Per te», verso sinistra si va su «Seguiti». */
  const leave = (to: 'Per te' | 'Seguiti' | null) => {
    if (busy.current) return; busy.current = true;
    Animated.timing(x, { toValue: to === 'Seguiti' ? -width : width, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: false }).start(() => {
      if (to) useNet.getState().setPref('homeFilter', to);
      goBack();
    });
  };
  /* due piccoli pallini trasparenti ai lati: si trascinano per passare a «Per te» (sinistra) o «Seguiti» (destra) */
  const dot = (side: 'left' | 'right') => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_e, g) => { if (!busy.current) x.setValue(side === 'left' ? Math.max(0, g.dx) : Math.min(0, g.dx)); },
    onPanResponderRelease: (_e, g) => {
      const d = side === 'left' ? g.dx : -g.dx;
      if (d > 70 || (d > 30 && Math.abs(g.vx) > 0.6)) leave(side === 'left' ? 'Per te' : 'Seguiti');
      else Animated.spring(x, { toValue: 0, useNativeDriver: false, friction: 8 }).start();
    },
  });
  const leftDot = useRef(dot('left')).current, rightDot = useRef(dot('right')).current;
  const me = useApp((s) => s.account.name);
  const visible = useVisible();
  const posts = useNet((s) => s.posts);
  const communities = useNet((s) => s.communities);
  const reach = useNet((s) => s.reach);
  const cards = useMemo<SwipeCandidate[]>(() => {
    const stand = posts.filter((p) => !p.hideFromFeed && p.author !== me && visible('post', 'standalone:' + p.id, p.author))
      .map((p) => ({ key: 'standalone:' + p.id, text: p.text, author: p.author, tag: p.tag, uri: p.uri ?? p.uris?.[0], media: p.media }));
    const comm = communities.filter((c) => c.members.includes(me) && visible('community', c.id, c.owner === 'system' ? undefined : c.owner))
      .flatMap((c) => c.posts.map((p, pi) => ({ key: `community:${c.id}:${pi}`, text: p.text, author: p.author, tag: c.name, uri: p.uri, media: p.media ?? null })).filter((x) => x.author !== me));
    return [...byReach(stand, (x) => x.key, reach), ...byReach(comm, (x) => x.key, reach)];
  }, [posts, communities, reach, me, visible]);
  const dotStyle = (side: 'start' | 'end') => ({ position: 'absolute' as const, [side]: 6, top: '46%' as const, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' });
  return (
    <View style={{ flex: 1, backgroundColor: '#000', overflow: 'hidden' }}>
      <Animated.View style={{ flex: 1, transform: [{ translateX: x }] }}>
        <SwipeDeck cards={cards} onClose={() => leave(null)} startKey={start} />
        <View accessibilityRole="button" accessibilityLabel="Trascina verso destra per tornare a Per te" {...leftDot.panHandlers} style={dotStyle('start')} hitSlop={{ top: 14, bottom: 14, left: 6, right: 14 }} />
        <View accessibilityRole="button" accessibilityLabel="Trascina verso sinistra per andare a Seguiti" {...rightDot.panHandlers} style={dotStyle('end')} hitSlop={{ top: 14, bottom: 14, left: 14, right: 6 }} />
      </Animated.View>
    </View>
  );
}

import { Tabs } from 'expo-router/js-tabs';
import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/T';
import { Icon } from '@/lib/icons';
import { useTheme } from '@/hooks/use-theme';
import { goKeep } from '@/lib/nav';
import { carouselBusy } from '@/lib/feedSwipe';
import { adjacentSection, sectionDirection } from '@/lib/sectionSwipe';
import { settleEscrow } from '@/lib/escrow';
import { ensureSampleParticipants, ensureSampleRecordings, ensureSampleShops } from '@/lib/shopSeed';
import { settleIdeas } from '@/lib/ideasActions';

import { DiscoverHost } from '@/components/Discover';
import { LifePayFab, LifePayHost } from '@/components/LifePay';
import { MenuSheet, NavBar, navLabelFor } from '@/components/NavBar';
import { NetSheetHost } from '@/components/NetSheets';
import { TheiaFab, TheiaHost, TheiaSelect } from '@/components/TheiaHost';
import { IncomingCallHost } from '@/components/call/IncomingCall';
import { useUI } from '@/components/ui';
import { unreadMessages } from '@/lib/network';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useNet } from '@/store/network';

export { ErrorScreen as ErrorBoundary } from '@/components/ErrorScreen';

export default function TabsLayout() {
  const me = useApp((s) => s.account.name);
  const chats = useChat((s) => s.chats);
  const messages = useChat((s) => s.messages);
  const notifications = useNet((s) => s.notifications);
  const setBadges = useUI((s) => s.setBadges);

  useEffect(() => { ensureSampleShops(); ensureSampleParticipants(useApp.getState().account.name, useApp.getState().demo); ensureSampleRecordings(useApp.getState().account.name, useApp.getState().demo); settleIdeas(); settleEscrow(); }, []);
  useEffect(() => {
    setBadges({ msg: unreadMessages(me), notif: notifications.filter((n) => !n.read).length });
  }, [me, chats, messages, notifications, setBadges]);

  const { width: W } = useWindowDimensions();
  const navItems = useApp((s) => s.navItems);
  const path = usePathname();
  const seg = path.split('/').filter(Boolean).pop() || 'index';
  const cur = seg === 'index' ? 'home' : seg;
  const curRef = useRef(cur); curRef.current = cur;
  /* se la pagina attuale non è in barra (es. Network dal menu) si comporta come se stesse subito dopo l'ultima sezione della barra visitata */
  const lastBar = useRef<string>(navItems[0] ?? 'home');
  if (navItems.includes(cur)) lastBar.current = cur;
  const virtual = navItems.includes(cur) ? navItems : (() => { const i = navItems.indexOf(lastBar.current); const a = navItems.slice(); a.splice(i < 0 ? a.length : i + 1, 0, cur); return a; })();
  const itemsRef = useRef(virtual); itemsRef.current = virtual;
  const EDGE = 24;
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const language = useApp((s) => s.language);
  const x = useRef(new Animated.Value(0)).current;
  const negX = useRef(Animated.multiply(x, -1)).current;
  const [peek, setPeek] = useState<string | null>(null);
  const [peekDir, setPeekDir] = useState<1 | -1>(1);
  const peekXr = useRef(x.interpolate({ inputRange: [-W, 0], outputRange: [0, W / 2], extrapolate: 'clamp' })).current;
  const peekXl = useRef(x.interpolate({ inputRange: [0, W], outputRange: [-W / 2, 0], extrapolate: 'clamp' })).current;
  const pending = useRef<{ from: string; dir: 1 | -1 } | null>(null);
  const busy = useRef(false);
  const peekSet = useRef(false);
  /* appena la sezione nuova è quella attiva, entra scorrendo dal lato giusto */
  useEffect(() => {
    const pd = pending.current;
    if (!pd || pd.from === cur) return;
    pending.current = null;
    x.setValue(pd.dir * W);
    Animated.timing(x, { toValue: 0, duration: 190, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => { setPeek(null); busy.current = false; peekSet.current = false; });
  }, [cur, x, W]);
  /* Swipe dal bordo: la sezione attuale segue il dito e sotto compare subito quella di destinazione (icona e nome), poi, al rilascio, il passaggio completa il movimento. */
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (e, g) => {
      /* Network ha le sue regole (recap, Per te, Swipe, Seguiti): lì il cambio sezione lo gestisce la pagina */
      if (busy.current || curRef.current === 'lifenetwork' || curRef.current === 'swipeDeck' || carouselBusy()) return false;
      if (Math.abs(g.dx) < 14 || Math.abs(g.dx) < Math.abs(g.dy) * 1.8) return false;
      const x0 = (e.nativeEvent.pageX ?? g.moveX) - g.dx;
      const fromLeft = x0 <= EDGE && g.dx > 0, fromRight = x0 >= W - EDGE && g.dx < 0;
      return (fromLeft || fromRight) && !!adjacentSection(itemsRef.current, curRef.current, g.dx < 0 ? 1 : -1);
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_e, g) => {
      /* alla presa dx vale 0: la destinazione si decide al primo movimento */
      if (g.dx !== 0 && !peekSet.current) { const d: 1 | -1 = g.dx < 0 ? 1 : -1; const to = adjacentSection(itemsRef.current, curRef.current, d); if (to) { peekSet.current = true; setPeekDir(d); setPeek(to); } }
      x.setValue(Math.max(-W, Math.min(W, g.dx)));
    },
    onPanResponderRelease: (_e, g) => {
      const d = sectionDirection(g.dx, g.dy, g.vx);
      const to = d ? adjacentSection(itemsRef.current, curRef.current, d) : null;
      if (!to) { peekSet.current = false; Animated.spring(x, { toValue: 0, useNativeDriver: true, friction: 8 }).start(() => setPeek(null)); return; }
      busy.current = true; peekSet.current = false;
      setPeekDir(d as 1 | -1);
      setPeek(to);
      const from = curRef.current;
      Animated.timing(x, { toValue: -d * W, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
        pending.current = { from, dir: d as 1 | -1 };
        goKeep(to);
        /* se per qualche motivo la sezione non cambia, si torna com'era */
        setTimeout(() => { if (pending.current && curRef.current === from) { pending.current = null; x.setValue(0); setPeek(null); busy.current = false; } }, 1500);
      });
    },
    onPanResponderTerminate: () => { peekSet.current = false; Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(() => setPeek(null)); },
  })).current;

  return (
    <>
      <View style={{ flex: 1, overflow: 'hidden', backgroundColor: th.bg }} {...pan.panHandlers}>
        {peek ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, start: 0, end: 0, bottom: 64 + insets.bottom, backgroundColor: th.bg, overflow: 'hidden' }}>
            <Animated.View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: peekDir === 1 ? peekXr : peekXl }] }}>
              <Icon name={peek} size={44} color={th.accent} stroke={1.8} />
              <Text style={{ color: th.text, fontSize: 20, fontWeight: '800', marginTop: 12 }}>{navLabelFor(peek, language)}</Text>
            </Animated.View>
          </View>
        ) : null}
        <Animated.View style={{ flex: 1, transform: [{ translateX: x }] }}>
          <Tabs backBehavior="history" tabBar={(p) => <Animated.View style={{ transform: [{ translateX: negX }] }}><NavBar {...p} /></Animated.View>} screenOptions={{ headerShown: false, lazy: true, animation: 'none' }} />
        </Animated.View>
      </View>
      <LifePayFab />
      <LifePayHost />
      <MenuSheet />
      <NetSheetHost />
      <TheiaFab />
      <TheiaHost />
      <IncomingCallHost />
      <TheiaSelect />
      <DiscoverHost />
    </>
  );
}

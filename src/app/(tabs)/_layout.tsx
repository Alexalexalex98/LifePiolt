import { Tabs } from 'expo-router/js-tabs';
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, PanResponder, View, useWindowDimensions } from 'react-native';
import { go } from '@/lib/nav';
import { adjacentSection, sectionDirection } from '@/lib/sectionSwipe';
import { settleEscrow } from '@/lib/escrow';
import { ensureSampleParticipants, ensureSampleRecordings, ensureSampleShops } from '@/lib/shopSeed';
import { settleIdeas } from '@/lib/ideasActions';

import { DiscoverHost } from '@/components/Discover';
import { LifePayFab, LifePayHost } from '@/components/LifePay';
import { MenuSheet, NavBar } from '@/components/NavBar';
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
  const itemsRef = useRef(navItems); itemsRef.current = navItems;
  const x = useRef(new Animated.Value(0)).current;
  const negX = useRef(Animated.multiply(x, -1)).current;
  const busy = useRef(false);
  /* trascini la sezione con il dito: se basta, esce da un lato e la nuova entra dall'altro */
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => !busy.current && Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8 && !!adjacentSection(itemsRef.current, curRef.current, g.dx < 0 ? 1 : -1),
    onPanResponderMove: (_e, g) => { const to = adjacentSection(itemsRef.current, curRef.current, g.dx < 0 ? 1 : -1); x.setValue(to ? g.dx * 0.9 : 0); },
    onPanResponderRelease: (_e, g) => {
      const d = sectionDirection(g.dx, g.dy, g.vx);
      const to = d ? adjacentSection(itemsRef.current, curRef.current, d) : null;
      if (!to) { Animated.spring(x, { toValue: 0, useNativeDriver: false, friction: 8 }).start(); return; }
      busy.current = true;
      Animated.timing(x, { toValue: -d * W, duration: 140, easing: Easing.in(Easing.quad), useNativeDriver: false }).start(() => {
        go(to);
        x.setValue(d * W);
        Animated.timing(x, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => { busy.current = false; });
      });
    },
    onPanResponderTerminate: () => { Animated.spring(x, { toValue: 0, useNativeDriver: false }).start(); },
  })).current;

  return (
    <>
      <View style={{ flex: 1, overflow: 'hidden' }} {...pan.panHandlers}>
        <Animated.View style={{ flex: 1, transform: [{ translateX: x }] }}>
          <Tabs backBehavior="history" tabBar={(p) => <Animated.View style={{ transform: [{ translateX: negX }] }}><NavBar {...p} /></Animated.View>} screenOptions={{ headerShown: false, lazy: true }} />
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

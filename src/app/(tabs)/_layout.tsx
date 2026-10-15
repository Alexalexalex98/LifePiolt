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
  const busy = useRef(false);
  const EDGE = 24;
  /* Pager reale: le sezioni della barra sono affiancate (quella accanto è già montata), la schermata segue il dito e si vede subito dove stai andando. */
  const pan = useRef(PanResponder.create({
    /* si parte solo dal bordo dello schermo (24 px): da sinistra verso destra = sezione precedente, da destra verso sinistra = successiva; un tocco normale non cambia sezione */
    onMoveShouldSetPanResponderCapture: (e, g) => {
      const x0 = (e.nativeEvent.pageX ?? g.moveX) - g.dx;
      if (busy.current || Math.abs(g.dx) < 12 || Math.abs(g.dx) < Math.abs(g.dy) * 1.8) return false;
      const fromLeft = x0 <= EDGE && g.dx > 0, fromRight = x0 >= W - EDGE && g.dx < 0;
      return (fromLeft || fromRight) && !!adjacentSection(itemsRef.current, curRef.current, g.dx < 0 ? 1 : -1);
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_e, g) => { const to = adjacentSection(itemsRef.current, curRef.current, g.dx < 0 ? 1 : -1); x.setValue(to ? Math.max(-W, Math.min(W, g.dx)) : 0); },
    onPanResponderRelease: (_e, g) => {
      const d = sectionDirection(g.dx, g.dy, g.vx);
      const to = d ? adjacentSection(itemsRef.current, curRef.current, d) : null;
      if (!to) { Animated.spring(x, { toValue: 0, useNativeDriver: false, friction: 8 }).start(); return; }
      busy.current = true;
      Animated.timing(x, { toValue: -d * W, duration: 170, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => {
        go(to);
        x.setValue(0);
        setTimeout(() => { busy.current = false; }, 60);
      });
    },
    onPanResponderTerminate: () => { Animated.spring(x, { toValue: 0, useNativeDriver: false }).start(); },
  })).current;
  /* le sezioni della barra restano montate (servono per vederle accanto durante il gesto) e si dispongono in fila */
  const screenOptions = ({ route }: { route: { name: string } }) => {
    const id = route.name === 'index' ? 'home' : route.name;
    const inBar = navItems.includes(id);
    return {
      headerShown: false,
      lazy: !inBar,
      animation: inBar ? ('shift' as const) : ('none' as const),
      transitionSpec: { animation: 'timing' as const, config: { duration: 0 } },
      /* posizione in fila secondo l'ordine della barra (non quello dei file): chi sta accanto alla sezione attuale è a un passo */
      sceneStyleInterpolator: () => {
        const ni = itemsRef.current.indexOf(id), fi = itemsRef.current.indexOf(curRef.current);
        const off = fi < 0 ? (ni + 1) * W : (ni - fi) * W;
        return { sceneStyle: { transform: [{ translateX: Animated.add(x, off) }] } };
      },
    };
  };

  return (
    <>
      <View style={{ flex: 1 }} {...pan.panHandlers}>
        <Tabs backBehavior="history" detachInactiveScreens={false} tabBar={(p) => <NavBar {...p} />} screenOptions={screenOptions as never} />
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

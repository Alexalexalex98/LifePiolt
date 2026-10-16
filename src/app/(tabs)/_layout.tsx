import { Tabs } from 'expo-router/js-tabs';
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { PanResponder, View, useWindowDimensions } from 'react-native';
import { goKeep } from '@/lib/nav';
import { carouselBusy } from '@/lib/feedSwipe';
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
  /* se la pagina attuale non è in barra (es. Network dal menu) si comporta come se stesse subito dopo l'ultima sezione della barra visitata */
  const lastBar = useRef<string>(navItems[0] ?? 'home');
  if (navItems.includes(cur)) lastBar.current = cur;
  const virtual = navItems.includes(cur) ? navItems : (() => { const i = navItems.indexOf(lastBar.current); const a = navItems.slice(); a.splice(i < 0 ? a.length : i + 1, 0, cur); return a; })();
  const itemsRef = useRef(virtual); itemsRef.current = virtual;
  const EDGE = 24;
  /* Swipe dal bordo dello schermo tra le sezioni: semplice e senza effetti sulla navigazione (nessuna schermata resta aperta in più). */
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (e, g) => {
      /* Network ha le sue regole (recap, Per te, Swipe, Seguiti): lì il cambio sezione lo gestisce la pagina */
      if (curRef.current === 'lifenetwork' || curRef.current === 'swipeDeck' || carouselBusy()) return false;
      if (Math.abs(g.dx) < 14 || Math.abs(g.dx) < Math.abs(g.dy) * 1.8) return false;
      const x0 = (e.nativeEvent.pageX ?? g.moveX) - g.dx;
      const fromLeft = x0 <= EDGE && g.dx > 0, fromRight = x0 >= W - EDGE && g.dx < 0;
      return (fromLeft || fromRight) && !!adjacentSection(itemsRef.current, curRef.current, g.dx < 0 ? 1 : -1);
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_e, g) => {
      const d = sectionDirection(g.dx, g.dy, g.vx);
      const to = d ? adjacentSection(itemsRef.current, curRef.current, d) : null;
      if (to) goKeep(to);
    },
  })).current;

  return (
    <>
      <View style={{ flex: 1 }} {...pan.panHandlers}>
        <Tabs backBehavior="history" tabBar={(p) => <NavBar {...p} />} screenOptions={{ headerShown: false, lazy: true }} />
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

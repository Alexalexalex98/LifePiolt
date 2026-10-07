import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';

import { MenuSheet, NavBar } from '@/components/NavBar';
import { NetSheetHost } from '@/components/NetSheets';
import { useUI } from '@/components/ui';
import { unreadMessages } from '@/lib/network';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useNet } from '@/store/network';

export default function TabsLayout() {
  const me = useApp((s) => s.account.name);
  const chats = useChat((s) => s.chats);
  const messages = useChat((s) => s.messages);
  const notifications = useNet((s) => s.notifications);
  const setBadges = useUI((s) => s.setBadges);

  useEffect(() => {
    setBadges({ msg: unreadMessages(me), notif: notifications.filter((n) => !n.read).length });
  }, [me, chats, messages, notifications, setBadges]);

  return (
    <>
      <Tabs backBehavior="history" tabBar={(p) => <NavBar {...p} />} screenOptions={{ headerShown: false, lazy: true }} />
      <MenuSheet />
      <NetSheetHost />
    </>
  );
}

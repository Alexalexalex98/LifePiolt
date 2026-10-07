import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';

import { MenuSheet, NavBar } from '@/components/NavBar';
import { NetSheetHost } from '@/components/NetSheets';
import { useUI } from '@/components/ui';
import { unreadMessages } from '@/lib/network';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';

export default function TabsLayout() {
  const me = useApp((s) => s.account.name);
  const conversations = useNet((s) => s.conversations);
  const groups = useNet((s) => s.groups);
  const convSeen = useNet((s) => s.convSeen);
  const groupSeen = useNet((s) => s.groupSeen);
  const notifications = useNet((s) => s.notifications);
  const setBadges = useUI((s) => s.setBadges);

  useEffect(() => {
    setBadges({ msg: unreadMessages(me), notif: notifications.filter((n) => !n.read).length });
  }, [me, conversations, groups, convSeen, groupSeen, notifications, setBadges]);

  return (
    <>
      <Tabs backBehavior="history" tabBar={(p) => <NavBar {...p} />} screenOptions={{ headerShown: false, lazy: true }} />
      <MenuSheet />
      <NetSheetHost />
    </>
  );
}

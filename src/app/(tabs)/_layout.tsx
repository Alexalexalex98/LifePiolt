import { Tabs } from 'expo-router/js-tabs';

import { MenuSheet, NavBar } from '@/components/NavBar';

export default function TabsLayout() {
  return (
    <>
      <Tabs backBehavior="history" tabBar={(p) => <NavBar {...p} />} screenOptions={{ headerShown: false, lazy: true }} />
      <MenuSheet />
    </>
  );
}

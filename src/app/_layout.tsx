import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';

import { autoSyncIfConnected } from '@/lib/healthkit';

import { ToastHost } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useApp } from '@/store/app';
import { useFin } from '@/store/finance';
import { useChat } from '@/store/chat';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import { useNet } from '@/store/network';
import { useTravel } from '@/store/travel';

SplashScreen.preventAutoHideAsync();

const stores = [useApp, useLife, useHealth, useFin, useTravel, useNet, useChat];
const allHydrated = () => stores.every((s) => s.persist.hasHydrated());

export default function RootLayout() {
  const t = useTheme();
  const onboarded = useApp((s) => s.onboarded);
  const [ready, setReady] = useState(allHydrated());

  useEffect(() => {
    const check = () => { if (allHydrated()) setReady(true); };
    const unsubs = stores.map((s) => s.persist.onFinishHydration(check));
    check();
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => {
    if (!ready) return;
    useFin.getState().rollMonth();
    SplashScreen.hideAsync();
    void autoSyncIfConnected();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') { useFin.getState().rollMonth(); void autoSyncIfConnected(); } });
    return () => sub.remove();
  }, [ready]);

  if (!ready) return null;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={t.bg === '#eef1f6' ? 'dark' : 'light'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
      </Stack>
      <ToastHost />
    </View>
  );
}

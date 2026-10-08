import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';

import { autoSyncIfConnected } from '@/lib/healthkit';
import { resyncCalendars } from '@/lib/calendarImport';
import { refreshBriefings } from '@/lib/notify';
import { refreshWeather } from '@/lib/weather';

import { ErrorBanner, installGlobalErrors } from '@/components/ErrorBanner';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ToastHost } from '@/components/ui';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { useApp } from '@/store/app';
import { useFin } from '@/store/finance';
import { useChat } from '@/store/chat';
import { useJobs } from '@/store/jobs';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import { useNet } from '@/store/network';
import { useTravel } from '@/store/travel';
import { useContext } from '@/store/context';
import { useAssistant } from '@/store/assistant';
import { useDiscover } from '@/store/discover';

SplashScreen.preventAutoHideAsync();
installGlobalErrors();

const stores = [useApp, useLife, useHealth, useFin, useTravel, useNet, useChat, useJobs, useContext, useAssistant, useDiscover];
const allHydrated = () => stores.every((s) => s.persist.hasHydrated());

export { ErrorScreen as ErrorBoundary } from '@/components/ErrorScreen';

export default function RootLayout() {
  const t = useTheme();
  const reduceMotion = useReduceMotion();
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
    void refreshWeather();
    void refreshBriefings();
    void resyncCalendars();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') { void refreshBriefings(); useFin.getState().rollMonth(); void autoSyncIfConnected(); } });
    return () => sub.remove();
  }, [ready]);

  if (!ready) return null;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={t.mode === 'light' ? 'dark' : 'light'} />
      <Stack screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'default', contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
      </Stack>
      <OfflineBanner />
      <ToastHost />
      <ErrorBanner />
    </View>
  );
}

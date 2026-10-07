import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const t = useTheme();
  const mode = useStore((s) => s.theme);
  const onboarded = useStore((s) => s.onboarded);
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());

  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync();
  }, [hydrated]);

  if (!hydrated) return null;

  return (
    <>
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="notes" />
          <Stack.Screen name="note/[id]" />
          <Stack.Screen name="health" />
          <Stack.Screen name="finance" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="legal/[doc]" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { AppState, View } from 'react-native';

import { registerDomainHandlers } from '@/domain/handlers';
import { defineBackgroundTask, onAppStart, onForeground } from '@/lib/background';
import { startLogStorage } from '@/lib/logStorage';
import { autoSyncIfConnected } from '@/lib/healthkit';
import { startSocialSync } from '@/social/socialSync';
import { startDmSync } from '@/social/dmSync';
import { resyncCalendars } from '@/lib/calendarImport';
import { settleIncoming } from '@/lib/lpIncomingActions';
import { refreshBriefings } from '@/lib/notify';
import { startPermissionWatch } from '@/lib/notifyPermission';
import { useNotificationTaps } from '@/lib/notifyOpen';
import { refreshWeather } from '@/lib/weather';

import { ErrorBanner, installGlobalErrors } from '@/components/ErrorBanner';
import { NotifPromptHost } from '@/components/NotifPrompt';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ToastHost } from '@/components/ui';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import * as Localization from 'expo-localization';
import { applyLanguage } from '@/i18n/apply';
import { setFormatPrefs } from '@/i18n/format';
import { detectLang, normalizeLang } from '@/i18n/languages';
import { useAccount } from '@/store/account';
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
import { useAiRouter } from '@/store/aiRouter';
import { useIdentity } from '@/store/identity';
import { useInterests } from '@/store/interests';
import { useSync } from '@/store/sync';
import { startSync } from '@/sync/bindings';
import { usePrivacyLog } from '@/store/privacyLog';
import { useClub } from '@/store/club';
import { useSharing } from '@/store/sharing';
import { useTour } from '@/store/tour';
import { useLive } from '@/store/live';
import { lockPortrait } from '@/lib/orientation';
import { DbNoticeBanner } from '@/components/security/DbNoticeBanner';
import { LockGate } from '@/components/security/LockGate';
import { MoodCheckinPrompt } from '@/components/MoodCheckinPrompt';
import { scheduleMaintenance } from '@/db/diagnostics';
import { useSecurity } from '@/db/securityStore';
import { startSearchSync } from '@/lib/search';
import { startLockScreenSync, syncLockScreen } from '@/lib/lockSync';

SplashScreen.preventAutoHideAsync();
installGlobalErrors();
startLogStorage();
// il task in background va definito nello scope globale (deve esistere anche quando il sistema avvia l'app senza interfaccia)
defineBackgroundTask();
// effetti collaterali delle operazioni di dominio (promemoria, notifiche in-app, registro di uscita): src/domain/handlers.ts
registerDomainHandlers();

const stores = [useApp, useAccount, useLife, useHealth, useFin, useTravel, useNet, useChat, useJobs, useContext, useAssistant, useDiscover, useInterests, useIdentity, useLive, useSharing, useSync, useTour, useAiRouter, usePrivacyLog, useSecurity];
const allHydrated = () => stores.every((s) => s.persist.hasHydrated());

export { ErrorScreen as ErrorBoundary } from '@/components/ErrorScreen';

export default function RootLayout() {
  const t = useTheme();
  const reduceMotion = useReduceMotion();
  const onboarded = useApp((s) => s.onboarded);
  const rawLang = useApp((s) => s.language);
  const lang = normalizeLang(rawLang);
  // i testi si traducono a runtime: attivo la lingua prima di disegnare e ridisegno tutto quando cambia (key={lang})
  useMemo(() => { applyLanguage(lang); }, [lang]);
  const currency = useApp((s) => s.currency) || 'CHF';
  const timeFormat = useApp((s) => s.timeFormat);
  // valuta e formato ora: li imposto prima del disegno; cambiandoli l'app si ridisegna (key)
  useMemo(() => { setFormatPrefs({ currency, timeFormat }); }, [currency, timeFormat]);
  const [ready, setReady] = useState(allHydrated());

  useEffect(() => {
    const check = () => { if (allHydrated()) setReady(true); };
    const unsubs = stores.map((s) => s.persist.onFinishHydration(check));
    check();
    return () => unsubs.forEach((u) => u());
  }, []);

  // tocco su una notifica di sistema (anche ad app chiusa) -> destinazione esatta, appena l'app e' pronta
  useNotificationTaps(ready, onboarded);

  useEffect(() => {
    if (!ready) return;
    useFin.getState().rollMonth();
    void lockPortrait();
    // versioni vecchie salvavano "Italiano": normalizzo; alla prima installazione uso la lingua del telefono
    const app = useApp.getState();
    if (!app.onboarded && !app.demo && app.language === 'it' && !app.account.name) {
      try { const tag = Localization.getLocales()[0]?.languageTag; if (tag) app.set({ language: detectLang(tag) }); } catch { /* ignore */ }
    } else if (normalizeLang(app.language) !== app.language) app.set({ language: normalizeLang(app.language) });
    SplashScreen.hideAsync();
    void autoSyncIfConnected();
    startDmSync(); // chat con gli amici veri (solo se sei collegato)
    startSocialSync(); // post pubblicati: gli stessi su iPhone e Android (solo se il server è collegato)
    startSync(); // sincronizzazione local-first: parte solo se l'utente l'ha abilitata, dopo un ritardo e senza bloccare
    void refreshWeather();
    void refreshBriefings();
    onAppStart();
    startPermissionWatch();
    void resyncCalendars();
    settleIncoming();
    startSearchSync();
    scheduleMaintenance();
    const stopLock = startLockScreenSync(); // blocco schermo e widget: turni, impegni, task
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') { void refreshBriefings(); void syncLockScreen(); onForeground(); /* riprogramma anche al cambio di fuso orario/ora legale */ useFin.getState().rollMonth(); void autoSyncIfConnected(); } });
    return () => { sub.remove(); stopLock(); };
  }, [ready]);

  if (!ready) return null;

  return (
    <View key={`${lang}|${currency}|${timeFormat}`} style={{ flex: 1, backgroundColor: t.bg }}>
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
      <NotifPromptHost />
      <ToastHost />
      <ErrorBanner />
      <DbNoticeBanner />
      <MoodCheckinPrompt ready={ready} />
      <LockGate />
    </View>
  );
}

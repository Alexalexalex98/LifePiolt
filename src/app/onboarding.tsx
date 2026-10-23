import { DEFAULT_USER_PHOTO, LOGO, LP_ICON_B, LP_ICON_W } from '@/lib/embeddedAssets';
import { useState } from 'react';
import { Mascot } from '@/components/mascot/Mascot';
import { Image, View } from 'react-native';
import { Text } from '@/components/T';

import { AccountFlow } from '@/components/AccountFlow';
import { LanguageButton } from '@/components/LanguagePicker';
import { PrivacyContent } from '@/components/PrivacyContent';
import { Body, Btn, Page, Sheet } from '@/components/ui';
import { type as fs } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { applyDemo } from '@/store/demo';
import { useApp } from '@/store/app';
import { go } from '@/lib/nav';
import { translateText } from '@/i18n/core';

type Screen = 'welcome' | 'create' | 'login';

/**
 * Primo avvio: crea un account, accedi, oppure esplora subito con i dati demo (senza account, senza documento).
 * Con i dati demo il nome non serve: si cambia dopo dalle Impostazioni, dove puoi anche creare l'account.
 */
export default function Onboarding() {
  const t = useTheme();
  const [screen, setScreen] = useState<Screen>('welcome');
  const [priv, setPriv] = useState(false);
  const set = useApp((s) => s.set);
  const account = useApp((s) => s.account);

  function demo() {
    applyDemo('Alex', account.email);
    set({ account: { ...account, name: 'Alex' }, demo: true, onboarded: true });
  }
  function done() {
    // account vero: nessun dato demo, l'app parte vuota con il nome dell'account
    set({ demo: false, onboarded: true });
  }

  return (
    <Page id="onboarding" noTop>
      <View style={{ paddingTop: 70 }}>
        <View style={{ position: 'absolute', top: 14, end: 0 }}><LanguageButton /></View>
        {screen === 'welcome' ? (
          <>
            <Mascot size={110} color={t.accent} expression="happy" style={{ marginBottom: 6 }} />
            <Image source={LOGO} style={{ width: 72, height: 72, marginBottom: 14, ...(t.mode === 'light' ? { tintColor: '#10151d' } : null) }} resizeMode="contain" accessibilityLabel={translateText("LifePilot")} />
            <Text accessibilityRole="header" style={{ color: t.text, fontSize: fs.display, fontWeight: '800', letterSpacing: -0.5 }}>LifePilot</Text>
            <Body muted style={{ marginTop: 8, marginBottom: 30 }}>
              Organizza giornate, salute, soldi, viaggi e persone in un posto solo, con un assistente che ti conosce.
            </Body>
            <View style={{ gap: 10 }}>
              <Btn title="Crea il tuo account" onPress={() => setScreen('create')} />
              <Btn ghost title="Accedi" onPress={() => setScreen('login')} />
              <Btn ghost title="Esplora con dati demo, senza account" onPress={demo} />
            </View>
            <Body muted small style={{ marginTop: 16 }}>
              Con l'account ritrovi i tuoi dati su un altro telefono e puoi parlare con gli amici. Con i dati demo l'app si riempie di esempi, senza account, documenti o email: li elimini quando vuoi dalle Impostazioni.
            </Body>
            <Btn small ghost style={{ alignSelf: 'flex-start', marginTop: 12 }} title="Come usiamo i tuoi dati" onPress={() => setPriv(true)} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <Btn small ghost title="Termini di servizio" onPress={() => go('legalDoc', { doc: 'terms' })} />
              <Btn small ghost title="Informativa sulla privacy" onPress={() => go('legalDoc', { doc: 'privacy' })} />
            </View>
          </>
        ) : (
          <AccountFlow key={screen} initial={screen === 'login' ? 'login' : 'create'} onDone={done} onBack={() => setScreen('welcome')} />
        )}
      </View>
      <Sheet visible={priv} title="Privacy e permessi" onClose={() => setPriv(false)}>
        <PrivacyContent />
      </Sheet>
    </Page>
  );
}

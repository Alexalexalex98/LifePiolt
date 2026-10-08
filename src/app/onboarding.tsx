import { useState } from 'react';
import { Image, Text, View } from 'react-native';

import { PrivacyContent } from '@/components/PrivacyContent';
import { Body, Btn, Input, Page, Sheet } from '@/components/ui';
import { type as fs } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { applyDemo } from '@/store/demo';
import { useApp } from '@/store/app';

/** Una sola schermata: il nome e la scelta tra "da zero" e "dati demo". Tutto il resto si imposta dopo, dalle Impostazioni. */
export default function Onboarding() {
  const t = useTheme();
  const [name, setName] = useState('');
  const [priv, setPriv] = useState(false);
  const set = useApp((s) => s.set);
  const account = useApp((s) => s.account);

  function start(demo: boolean) {
    if (demo) applyDemo(name.trim(), account.email);
    set({ account: { ...account, name: name.trim() }, demo, onboarded: true });
  }

  return (
    <Page id="onboarding" noTop>
      <View style={{ paddingTop: 70 }}>
        <Image source={require('../../assets/proto/app-logo.png')} style={{ width: 72, height: 72, marginBottom: 14, ...(t.mode === 'light' ? { tintColor: '#10151d' } : null) }} resizeMode="contain" accessibilityLabel="LifePilot" />
        <Text accessibilityRole="header" style={{ color: t.text, fontSize: fs.display, fontWeight: '800', letterSpacing: -0.5 }}>LifePilot</Text>
        <Body muted style={{ marginTop: 8, marginBottom: 30 }}>
          Salute, finanze, obiettivi, viaggi e persone in un posto solo, con un assistente che ti conosce.
        </Body>
        <Body style={{ marginBottom: 8 }}>Come ti chiami?</Body>
        <Input placeholder="Il tuo nome" value={name} onChangeText={setName} autoCapitalize="words" returnKeyType="done" onSubmitEditing={() => { if (name.trim()) start(false); }} />
        <View style={{ gap: 10, marginTop: 8 }}>
          <Btn title="Inizia da zero" disabled={!name.trim()} onPress={() => start(false)} />
          <Btn ghost title="Esplora con dati demo" disabled={!name.trim()} onPress={() => start(true)} />
        </View>
        <Body muted small style={{ marginTop: 16 }}>
          I dati restano su questo dispositivo. Con i dati demo l'app si riempie di esempi, eliminabili dalle Impostazioni.
        </Body>
        <Btn small ghost style={{ alignSelf: 'flex-start', marginTop: 12 }} title="Come usiamo i tuoi dati" onPress={() => setPriv(true)} />
      </View>
      <Sheet visible={priv} title="Privacy e permessi" onClose={() => setPriv(false)}>
        <PrivacyContent />
      </Sheet>
    </Page>
  );
}

import { useState } from 'react';
import { Image, Text, View } from 'react-native';

import { Body, Btn, Input, Page } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { applyDemo } from '@/store/demo';
import { useApp } from '@/store/app';

export default function Onboarding() {
  const t = useTheme();
  const [name, setName] = useState('');
  const set = useApp((s) => s.set);
  const account = useApp((s) => s.account);

  function start(demo: boolean) {
    if (demo) applyDemo();
    set({ account: { ...account, name: name.trim() }, demo, onboarded: true });
  }

  return (
    <Page id="onboarding" noTop>
      <View style={{ paddingTop: 70 }}>
        <Image source={require('../../assets/proto/app-logo.png')} style={{ width: 72, height: 72, marginBottom: 14 }} resizeMode="contain" />
        <Text style={{ color: t.text, fontSize: 38, fontWeight: '800', letterSpacing: -0.5 }}>LifePilot</Text>
        <Body muted style={{ marginTop: 8, marginBottom: 30 }}>
          Salute, finanze, obiettivi, viaggi e persone in un posto solo, con un assistente che ti conosce.
        </Body>
        <Body style={{ marginBottom: 8 }}>Come ti chiami?</Body>
        <Input placeholder="Il tuo nome" value={name} onChangeText={setName} autoCapitalize="words" returnKeyType="done" />
        <Body muted small style={{ marginBottom: 22 }}>
          I tuoi dati restano su questo dispositivo. Puoi esportarli o cancellarli in qualsiasi momento da Settings.
        </Body>
        <View style={{ gap: 10 }}>
          <Btn title="Inizia da zero" disabled={!name.trim()} onPress={() => start(false)} />
          <Btn ghost title="Esplora con dati demo" disabled={!name.trim()} onPress={() => start(true)} />
        </View>
        <Body muted small style={{ marginTop: 14 }}>
          I dati demo riempiono l'app con esempi (note, file, movimenti, salute) per vedere subito tutte le funzioni. Si possono eliminare dalle Impostazioni.
        </Body>
      </View>
    </Page>
  );
}

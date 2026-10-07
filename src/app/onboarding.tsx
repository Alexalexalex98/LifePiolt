import { useState } from 'react';
import { Text, View } from 'react-native';

import { Body, Button, Input, Screen } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store';

export default function Onboarding() {
  const t = useTheme();
  const setName = useStore((s) => s.setName);
  const finish = useStore((s) => s.finishOnboarding);
  const [name, setLocalName] = useState('');

  return (
    <Screen>
      <View style={{ paddingTop: 80 }}>
        <Text style={{ color: t.text, fontSize: 38, fontWeight: '800', letterSpacing: -0.5 }}>LifePilot</Text>
        <Body muted style={{ marginTop: 8, marginBottom: 32 }}>
          Salute, finanze, obiettivi e idee in un posto solo, con un assistente che ti conosce.
        </Body>
        <Body style={{ marginBottom: 8 }}>Come ti chiami?</Body>
        <Input placeholder="Il tuo nome" value={name} onChangeText={setLocalName} autoCapitalize="words" returnKeyType="done" />
        <Body muted small style={{ marginBottom: 20 }}>
          I tuoi dati restano su questo dispositivo. Puoi esportarli o cancellarli in qualsiasi momento dalle Impostazioni.
        </Body>
        <Button
          title="Inizia"
          disabled={!name.trim()}
          onPress={() => {
            setName(name.trim());
            finish();
          }}
        />
      </View>
    </Screen>
  );
}

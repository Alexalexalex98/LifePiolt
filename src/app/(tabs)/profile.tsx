import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Body, Card, H, Row, Screen } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store';

export default function Profile() {
  const t = useTheme();
  const name = useStore((s) => s.name);
  return (
    <Screen title="Profilo">
      <Card>
        <Row style={{ justifyContent: 'flex-start' }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.cardAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.border }}>
            <Text style={{ color: t.text, fontSize: 22, fontWeight: '800' }}>{name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View>
            <H>{name}</H>
            <Body muted small>I dati sono salvati su questo dispositivo</Body>
          </View>
        </Row>
      </Card>
      <Card onPress={() => router.push('/settings')}>
        <H>Impostazioni</H>
        <Body muted small>Aspetto, notifiche, privacy, dati e assistenza</Body>
      </Card>
    </Screen>
  );
}

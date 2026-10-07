import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Alert, Share, View } from 'react-native';

import { Body, Button, Card, H, Pill, Row, Screen, Toggle } from '@/components/ui';
import { useStore, type ThemeMode } from '@/store';

const themes: { v: ThemeMode; label: string }[] = [
  { v: 'dark', label: 'Scuro' },
  { v: 'light', label: 'Chiaro' },
  { v: 'system', label: 'Sistema' },
];

export default function Settings() {
  const { theme, setTheme, notifications, setNotif, deleteAllData } = useStore();

  async function togglePush(v: boolean) {
    if (v) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Notifiche disattivate', 'Per riceverle abilita le notifiche per LifePilot dalle impostazioni del telefono.');
        return;
      }
    }
    setNotif('push', v);
  }

  async function exportData() {
    const { name, tasks, goals, notes, health, salary, txs } = useStore.getState();
    await Share.share({ message: JSON.stringify({ name, tasks, goals, notes, health, salary, txs }, null, 2) });
  }

  function confirmDelete() {
    Alert.alert(
      'Eliminare tutti i dati?',
      'Cancella note, task, obiettivi, dati di salute e finanze da questo dispositivo. Non si può annullare.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina tutto',
          style: 'destructive',
          onPress: () => {
            deleteAllData();
          },
        },
      ],
    );
  }

  return (
    <Screen title="Impostazioni" back>
      <Card>
        <H>Aspetto</H>
        <View style={{ flexDirection: 'row' }}>
          {themes.map((x) => <Pill key={x.v} label={x.label} on={theme === x.v} onPress={() => setTheme(x.v)} />)}
        </View>
      </Card>

      <Card>
        <H>Notifiche</H>
        <Toggle label="Notifiche push" value={notifications.push} onChange={togglePush} />
        <Toggle label="Digest settimanale" value={notifications.digest} onChange={(v) => setNotif('digest', v)} />
      </Card>

      <Card>
        <H>I tuoi dati</H>
        <Body muted small style={{ marginBottom: 12 }}>Tutto è salvato solo su questo dispositivo, ti appartiene.</Body>
        <View style={{ gap: 8 }}>
          <Button ghost title="Esporta i miei dati" onPress={exportData} />
          <Button ghost danger title="Elimina tutti i dati e l'account" onPress={confirmDelete} />
        </View>
      </Card>

      <Card>
        <H>Assistenza e legale</H>
        {[
          ['help', 'Centro assistenza'],
          ['privacy', 'Informativa privacy'],
          ['terms', 'Termini di servizio'],
        ].map(([doc, label]) => (
          <Row key={doc} style={{ paddingVertical: 10 }}>
            <Body>{label}</Body>
            <Button small ghost title="Apri" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc } })} />
          </Row>
        ))}
      </Card>

      <Card>
        <Row><Body muted>Versione</Body><Body>LifePilot {Constants.expoConfig?.version}</Body></Row>
      </Card>
    </Screen>
  );
}

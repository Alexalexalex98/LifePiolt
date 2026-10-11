import { useState } from 'react';
import { View } from 'react-native';

import { Body, Btn, Card, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { refreshAll } from '@/lib/notify';
import { askPermission, noteAsked, offerNotifications, openSystemSettings, useNotifPrompt, usePermission } from '@/lib/notifyPermission';
import { useApp } from '@/store/app';
import { toast } from '@/store/toast';

/** Pre-prompt calmo: spiega a cosa servono le notifiche e solo dopo chiede il permesso di sistema. */
export function NotifPromptHost() {
  const t = useTheme();
  const { open, reason, hide } = useNotifPrompt();
  const perm = usePermission();
  const [busy, setBusy] = useState(false);

  const later = () => { if (reason !== 'manual') noteAsked(); hide(); };
  const enable = async () => {
    setBusy(true);
    const st = await askPermission();
    setBusy(false);
    noteAsked();
    hide();
    if (st === 'granted') {
      const a = useApp.getState();
      if (!a.notif.push) a.set({ notif: { ...a.notif, push: true } });
      void refreshAll();
      toast('Notifiche attive: ti avviserò prima degli impegni');
    } else if (st === 'unsupported') toast('Le notifiche funzionano solo sull\'app installata sul telefono');
    else toast('Notifiche non concesse: puoi attivarle quando vuoi da Impostazioni');
  };
  const blocked = perm === 'blocked';

  return (
    <Sheet visible={open} title="Vuoi ricevere gli avvisi?" onClose={later}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.accent + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name="bell" size={22} color={t.accent} stroke={2} /></View>
        <View style={{ flex: 1 }}>
          <Body bold>Ti avviso 15 minuti prima di un impegno e quando devi partire.</Body>
        </View>
      </View>
      <Body muted>Riceverai solo avvisi utili: prima di un impegno, all&apos;orario di partenza e quando inizia. Puoi scegliere quali, o spegnerli tutti, in Impostazioni &gt; Notifiche.</Body>
      {reason === 'event' && <Body small muted style={{ marginTop: 8 }}>Hai appena aggiunto un impegno con un orario: vuoi che ti avvisi?</Body>}
      <View style={{ gap: 8, marginTop: 16 }}>
        {blocked
          ? <Btn icon="settings" title="Apri impostazioni di sistema" onPress={() => { hide(); void openSystemSettings(); }} />
          : <Btn icon="check" title={busy ? 'Un momento…' : 'Attiva'} disabled={busy} onPress={() => void enable()} />}
        <Btn ghost title="Non ora" onPress={later} />
      </View>
    </Sheet>
  );
}

/** Banner discreto quando le notifiche sono spente e servirebbero (es. nel Plan). */
export function NotifBanner() {
  const t = useTheme();
  const perm = usePermission();
  const on = useApp((a) => a.reminders?.on !== false);
  const [hidden, setHidden] = useState(false);
  if (hidden || !on || perm === 'granted' || perm === 'unsupported') return null;
  const blocked = perm === 'blocked';
  return (
    <Card accent={t.danger} style={{ marginBottom: 12 }}>
      <Row gap={10} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Body bold>Le notifiche sono spente: non ti avviserò</Body>
          <Body small muted>{blocked ? 'Riattivale dalle impostazioni di sistema per ricevere i promemoria degli impegni.' : 'Attivale per ricevere i promemoria degli impegni.'}</Body>
        </View>
        <Btn small icon={blocked ? 'settings' : 'bell'} title={blocked ? 'Apri impostazioni' : 'Attiva'} onPress={() => (blocked ? void openSystemSettings() : offerNotifications('manual'))} />
      </Row>
      <View style={{ alignItems: 'flex-end', marginTop: 4 }}><Btn small ghost title="Nascondi" onPress={() => setHidden(true)} /></View>
    </Card>
  );
}

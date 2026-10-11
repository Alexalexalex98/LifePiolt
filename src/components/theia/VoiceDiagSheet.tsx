import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { translateText } from '@/i18n/core';
import { openAppSettings } from '@/lib/chatMedia';
import { diagLines, diagText, speechDiagnostics, type VoiceDiag } from '@/lib/speech';
import { toast } from '@/store/toast';
import { openSpeechServiceStore } from './VoiceNotice';

/** Pannello "Diagnostica voce" (pressione lunga sul microfono): cosa c'è e cosa manca, da mostrare e da copiare. */
export function VoiceDiagSheet({ visible, onClose, locale }: { visible: boolean; onClose: () => void; locale: string }) {
  const t = useTheme();
  const [d, setD] = useState<VoiceDiag | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    try { setD(await speechDiagnostics(locale)); } finally { setBusy(false); }
  }, [locale]);
  useEffect(() => { if (visible) void load(); }, [visible, load]);
  return (
    <Sheet visible={visible} title="Diagnostica voce" onClose={onClose}>
      <Body small muted style={{ marginBottom: 8 }}>Serve a capire perché il microfono non risponde. Non contiene dati personali: puoi copiarlo e mandarlo a chi ti aiuta.</Body>
      {!d ? <Body muted>Controllo in corso…</Body> : diagLines(d).map((l) => (
        <View key={l.label} style={{ flexDirection: 'row', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: t.item }}>
          <Text style={{ flex: 1, color: t.muted, fontSize: 13 }}>{translateText(l.label)}</Text>
          <Text selectable style={{ flex: 1.2, color: l.ok === false ? t.danger : l.ok ? t.positive : t.text, fontSize: 13, fontWeight: '600', textAlign: 'right' }}>{translateText(l.value)}</Text>
        </View>
      ))}
      <Row style={{ marginTop: 12, flexWrap: 'wrap' }} gap={6}>
        <Btn small ghost icon="repeat" title="Aggiorna" disabled={busy} onPress={() => void load()} />
        <Btn small ghost icon="copy" title="Copia" disabled={!d} onPress={() => { if (d) void Clipboard.setStringAsync(diagText(d)).then(() => toast('Diagnostica copiata')).catch(() => toast('Non riesco a copiare')); }} />
        {Platform.OS !== 'web' ? <Btn small ghost icon="gear" title="Apri impostazioni" onPress={() => void openAppSettings()} /> : null}
        {Platform.OS === 'android' ? <Btn small ghost icon="link" title="Servizio vocale di Google" onPress={() => void openSpeechServiceStore()} /> : null}
      </Row>
    </Sheet>
  );
}

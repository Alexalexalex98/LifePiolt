import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { Btn } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { translateText } from '@/i18n/core';
import { openAppSettings } from '@/lib/chatMedia';
import { Icon } from '@/lib/icons';
import { speechActions, speechErrorText, speechServicePackage, type SpeechAction, type SpeechErrorCode } from '@/lib/speech';
import { toast } from '@/store/toast';

/** Apre la pagina del servizio vocale di Google sul Play Store (o nel browser se il Play Store non c'è). */
export async function openSpeechServiceStore() {
  const pkg = speechServicePackage(Platform.OS === 'android' ? Number(Platform.Version) : undefined);
  try { await Linking.openURL(`market://details?id=${pkg}`); }
  catch {
    try { await Linking.openURL(`https://play.google.com/store/apps/details?id=${pkg}`); }
    catch { toast('Non riesco ad aprire il Play Store. Cerca «Servizi vocali di Google» o l\'app Google.'); }
  }
}

/**
 * Messaggio di errore della voce: dice cosa è successo e cosa fare, con pulsanti d'azione e "Dettagli" (codice grezzo, copiabile).
 */
export function VoiceNotice({ code, raw, onClose, onRetry, onRecord, onDiag }: {
  code: SpeechErrorCode; raw?: string; onClose: () => void; onRetry?: () => void; onRecord?: () => void; onDiag?: () => void;
}) {
  const t = useTheme();
  const [details, setDetails] = useState(false);
  const actions = speechActions(code).filter((a) => (a === 'record_note' ? !!onRecord : a === 'retry' ? !!onRetry : a === 'install_service' ? Platform.OS === 'android' : a === 'settings' ? Platform.OS !== 'web' : true));
  const run = (a: SpeechAction) => {
    if (a === 'settings') void openAppSettings();
    else if (a === 'install_service') void openSpeechServiceStore();
    else if (a === 'record_note') onRecord?.();
    else onRetry?.();
  };
  const label: Record<SpeechAction, string> = { settings: 'Apri impostazioni', install_service: 'Installa o abilita il servizio vocale di Google', record_note: 'Registra un audio', retry: 'Riprova' };
  const icon: Record<SpeechAction, string> = { settings: 'gear', install_service: 'link', record_note: 'mic', retry: 'repeat' };
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ backgroundColor: t.dangerBg, borderRadius: 12, padding: 10, marginBottom: 6, gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <Icon name="alert" size={16} color={t.danger} stroke={2} />
        <Text style={{ color: t.danger, fontSize: 13, lineHeight: 18, flex: 1 }}>{translateText(speechErrorText(code))}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={translateText('Chiudi')} onPress={onClose} hitSlop={10}><Icon name="x" size={16} color={t.danger} stroke={2.2} /></Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {actions.map((a) => <Btn key={a} small ghost icon={icon[a]} title={label[a]} onPress={() => run(a)} />)}
        <Btn small ghost icon="info" title={details ? 'Nascondi dettagli' : 'Dettagli'} onPress={() => setDetails((d) => !d)} />
      </View>
      {details ? (
        <View style={{ gap: 6 }}>
          <Text selectable style={{ color: t.text, fontSize: 12, lineHeight: 17, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) }}>{`codice: ${code}\n${raw || translateText('nessun dettaglio dal modulo')}`}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Btn small ghost icon="copy" title="Copia" onPress={() => { void Clipboard.setStringAsync(`codice: ${code}\n${raw ?? ''}`).then(() => toast('Dettagli copiati')).catch(() => toast('Non riesco a copiare')); }} />
            {onDiag ? <Btn small ghost icon="search" title="Diagnostica voce" onPress={onDiag} /> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

import { View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Item, Sheet, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { translateText } from '@/i18n/core';
import { LANGUAGES } from '@/i18n/languages';
import { Icon } from '@/lib/icons';
import { localeFor } from '@/lib/speechCore';

/**
 * Lingua del messaggio (e del riconoscimento vocale) per QUESTO messaggio. I nomi restano nella loro lingua.
 * `value` = lingua scelta; `appLang` = lingua dell'app (predefinita).
 */
export function LangSheet({ visible, onClose, value, appLang, onPick, auto, onAuto }: {
  visible: boolean; onClose: () => void; value: string; appLang: string; onPick: (code: string) => void; auto: boolean; onAuto: (v: boolean) => void;
}) {
  const t = useTheme();
  return (
    <Sheet visible={visible} title="Lingua di questo messaggio" onClose={onClose}>
      <Body muted small style={{ marginBottom: 6 }}>Vale per la voce e per il testo che scrivi ora. Dopo l'invio torna la lingua dell'app.</Body>
      {LANGUAGES.map((l, i) => (
        <Item key={l.code} last={i === LANGUAGES.length - 1} onPress={() => { onPick(l.code); onClose(); }}>
          <View accessible accessibilityRole="button" accessibilityState={{ selected: l.code === value }} accessibilityLabel={l.code === appLang ? `${l.native}, ${translateText('lingua dell\'app')}` : l.native} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 16 }}>{l.native}</Text>
              <Text style={{ color: t.muted, fontSize: 12, marginTop: 1 }}>{l.english} · {localeFor(l.code)}</Text>
            </View>
            {l.code === value ? <Icon name="check" size={18} color={t.positive} stroke={2.4} /> : null}
          </View>
        </Item>
      ))}
      <View style={{ marginTop: 12 }}>
        <Toggle label="Invia subito dopo che ho parlato" value={auto} onChange={onAuto} hint="Se è spento, la trascrizione compare nel campo di testo e la invii tu." />
      </View>
    </Sheet>
  );
}

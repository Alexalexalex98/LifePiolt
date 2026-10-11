import { Image } from 'expo-image';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { Pill } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { translateText } from '@/i18n/core';
import type { TheiaAction, TheiaExt } from '@/lib/assistant/theiaExt';

/** Immagini allegate a un messaggio (restano sul telefono). */
export function MessageImages({ uris, me }: { uris: string[]; me?: boolean }) {
  const t = useTheme();
  if (!uris.length) return null;
  const one = uris.length === 1;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
      {uris.map((u, i) => (
        <Image
          key={u + i}
          source={{ uri: u }}
          accessible accessibilityRole="image"
          accessibilityLabel={`${translateText('Immagine allegata')} ${i + 1}/${uris.length}`}
          style={{ width: one ? 200 : 96, height: one ? 150 : 96, borderRadius: 10, backgroundColor: me ? '#d4dbe8' : t.item }}
          contentFit="cover"
        />
      ))}
    </View>
  );
}

/** Parte sotto il testo di un messaggio di Theia: dettaglio, "Risposto da", pulsanti di azione. */
export function MessageFooter({ ext, me, onAction }: { ext?: TheiaExt; me?: boolean; onAction: (a: TheiaAction) => void }) {
  const t = useTheme();
  if (!ext || me) return null;
  const { detail, provider, actions } = ext;
  if (!detail && !provider && !actions?.length) return null;
  return (
    <View>
      {detail ? <Text style={{ color: t.muted, fontSize: 12, lineHeight: 17, marginTop: 6 }}>{detail}</Text> : null}
      {provider ? <Text style={{ color: t.muted, fontSize: 11, marginTop: 6 }}>{translateText('Risposto da')}: {provider}</Text> : null}
      {actions?.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
          {actions.map((a, i) => <Pill key={a.label + i} label={a.label} icon={a.kind === 'retry' ? 'repeat' : undefined} onPress={() => onAction(a)} />)}
        </View>
      ) : null}
    </View>
  );
}

import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/T';
import { Btn } from '@/components/ui';
import { dismissNotice } from '@/db/status';
import { useNotices } from '@/components/security/hooks';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';

/** Avviso dell'archivio dati (disco pieno, ripristino da copia, cifratura assente...). Mai in silenzio: resta finche' non lo chiudi. */
export function DbNoticeBanner() {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const notices = useNotices().filter((n) => n.level !== 'info' || n.kind === 'migrated_legacy');
  const n = notices[0];
  if (!n) return null;
  const color = n.level === 'error' ? th.danger ?? '#ff6b6b' : n.level === 'warn' ? th.warn ?? '#f5b942' : th.muted;
  return (
    <View accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 12, right: 12, top: insets.top + 8, zIndex: 900, backgroundColor: th.card, borderColor: color, borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Icon name={n.level === 'info' ? 'info' : 'shield'} size={18} color={color} />
        <Text style={{ color: th.text, fontSize: 13, lineHeight: 18, flex: 1 }}>{n.message}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
        <Btn small ghost title="Dettagli" onPress={() => { dismissNotice(n.id); go('security'); }} />
        <Btn small ghost title="Ok" onPress={() => dismissNotice(n.id)} />
      </View>
    </View>
  );
}

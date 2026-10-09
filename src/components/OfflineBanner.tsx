import { View } from 'react-native';
import { Text } from '@/components/T';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { OFFLINE_MESSAGE, useOnline } from '@/lib/offline';

/** Striscia discreta in alto quando manca la rete. Non intercetta i tocchi e non blocca nulla. */
export function OfflineBanner() {
  const online = useOnline();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View pointerEvents="none" accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 40 }}>
      <View style={{ marginHorizontal: 10, marginBottom: insets.bottom + 74, backgroundColor: t.chip, borderColor: t.border, borderWidth: 1, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="alert" size={14} color={t.warn} stroke={2.2} />
        <Text style={{ color: t.text, fontSize: 12, lineHeight: 16, flex: 1 }}>{OFFLINE_MESSAGE}</Text>
      </View>
    </View>
  );
}

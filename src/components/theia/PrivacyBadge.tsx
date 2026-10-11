import { View } from 'react-native';
import { Text } from '@/components/T';

import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { useAiRouter } from '@/store/aiRouter';

/** Piccolo indicatore di dove lavora Theia: "Solo sul telefono" oppure "AI esterna attiva" (si cambia nelle impostazioni dell'intelligenza di Theia). */
export function PrivacyBadge() {
  const t = useTheme();
  const phoneOnly = useAiRouter((s) => s.prefs.phoneOnly);
  const label = phoneOnly ? 'Solo sul telefono' : 'AI esterna attiva';
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: t.chip, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 9, alignSelf: 'flex-start' }}>
      <Icon name={phoneOnly ? 'lock' : 'link'} size={12} color={phoneOnly ? t.positive : t.warn} stroke={2.2} />
      <Text style={{ color: t.muted, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

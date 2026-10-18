import { View } from 'react-native';

import { Text } from '@/components/T';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';

/** Avviso da mostrare ovunque si usa l'AI: puo' sbagliare, si controlla su una fonte affidabile. */
export function AiNote({ style }: { style?: object }) {
  const t = useTheme();
  return (
    <View accessibilityRole="text" style={[{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 4 }, style]}>
      <Icon name="info" size={14} color={t.muted} />
      <Text style={{ color: t.muted, fontSize: 11.5, lineHeight: 16, flex: 1 }}>L’AI può sbagliare: controlla sempre quello che dice e verificalo su una fonte affidabile.</Text>
    </View>
  );
}

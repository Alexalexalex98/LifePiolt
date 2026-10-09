import { View } from 'react-native';

import { Text } from '@/components/T';
import { Press } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useSectionNames } from '@/lib/i18n';
import { go } from '@/lib/nav';

const tabs = [
  { page: 'stocks', n: 'Stock' },
  { page: 'lifefinance', n: 'Finanza personale' },
  { page: 'lifeforecast', n: 'Previsioni future' },
  { page: 'taxdecl', n: 'Dichiarazione fiscale' },
];

/** Quattro schede in griglia 2x2 con larghezze uguali: nessuna etichetta spezzata male a 320pt. */
export function FinTabs({ current }: { current: string }) {
  void useSectionNames;
  const t = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
      {tabs.map((x) => {
        const on = current === x.page;
        return (
          <Press key={x.page} role="tab" selected={on} accessibilityLabel={x.n} onPress={() => go(x.page)} style={{ flexBasis: '48%', flexGrow: 1, minHeight: 44, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.text : t.chip }}>
            <Text style={{ color: on ? t.bg : t.text, fontSize: 13, fontWeight: on ? '700' : '500', textAlign: 'center' }}>{x.n}</Text>
          </Press>
        );
      })}
    </View>
  );
}

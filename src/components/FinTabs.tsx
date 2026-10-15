import { ScrollView } from 'react-native';

import { Text } from '@/components/T';
import { Press } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useSectionNames } from '@/lib/i18n';
import { go } from '@/lib/nav';

const tabs = [
  { page: 'lifefinance', n: 'Finanza personale' },
  { page: 'lifeforecast', n: 'Previsioni future' },
  { page: 'taxdecl', n: 'Dichiarazione fiscale' },
  { page: 'stocks', n: 'Stock' }, // per chi investe: in fondo, non è la prima cosa che vede chi apre le Finanze
];

/** Schede in una sola riga scorrevole: più sobria, stile app di finanza. */
export function FinTabs({ current }: { current: string }) {
  void useSectionNames;
  const t = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" style={{ marginHorizontal: -16, marginBottom: 12 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
      {tabs.map((x) => {
        const on = current === x.page;
        return (
          <Press key={x.page} role="tab" selected={on} accessibilityLabel={x.n} onPress={() => go(x.page)} style={{ minHeight: 38, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.text : 'transparent', borderWidth: on ? 0 : 1, borderColor: t.border }}>
            <Text style={{ color: on ? t.bg : t.muted, fontSize: 13.5, fontWeight: on ? '800' : '600' }}>{x.n}</Text>
          </Press>
        );
      })}
    </ScrollView>
  );
}

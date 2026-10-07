import { View } from 'react-native';

import { Pill } from '@/components/ui';
import { useSectionNames } from '@/lib/i18n';
import { go } from '@/lib/nav';

const tabs = [
  { page: 'stocks', n: 'Stock' },
  { page: 'lifefinance', n: 'Finanza personale' },
  { page: 'lifeforecast', n: 'Previsioni future' },
  { page: 'taxdecl', n: 'Dichiarazione fiscale' },
];

export function FinTabs({ current }: { current: string }) {
  void useSectionNames;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
      {tabs.map((x) => <Pill key={x.page} label={x.n} on={current === x.page} onPress={() => go(x.page)} />)}
    </View>
  );
}

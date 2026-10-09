import { View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Input, Pill } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { INTEREST_CATALOG, useInterests } from '@/store/interests';

/** Scelta degli interessi e della città: personalizza attese, viaggi e idee. */
export function InterestsPicker() {
  const t = useTheme();
  const { selected, toggle, homeCity, setHomeCity } = useInterests();
  return (
    <View>
      <Body muted style={{ marginBottom: 8 }}>Scegli cosa ti piace: lo uso per proporti cosa fare se arrivi in anticipo a un appuntamento e per consigliarti viaggi e itinerari.</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {INTEREST_CATALOG.map((i) => <Pill key={i.id} label={i.label} on={selected.includes(i.id)} onPress={() => toggle(i.id)} />)}
      </View>
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 4 }}>La tua città o zona abituale</Text>
      <Input placeholder="Es. Lugano" value={homeCity} onChangeText={setHomeCity} />
    </View>
  );
}

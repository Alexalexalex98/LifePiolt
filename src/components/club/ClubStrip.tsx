import { ScrollView, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Press, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { clubByOwner, memberCounts, useClub } from '@/store/club';
import { useClubSeed } from './hooks';
import { CoverArt } from './parts';

/** Striscia "LifeClub" nella Home di LifeNetwork: club da scoprire e ingresso allo Studio. */
export function ClubStrip() {
  const t = useTheme();
  useClubSeed();
  const me = useApp((s) => s.account.name);
  const clubs = useClub((s) => s.clubs);
  const memberships = useClub((s) => s.memberships);
  const list = Object.values(clubs).filter((c) => c.published && c.owner !== me);
  const mine = clubByOwner({ clubs }, me);
  if (!list.length && mine) return null;
  return (
    <View style={{ marginBottom: 10 }}>
      <Row style={{ marginBottom: 6 }}>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>LifeClub</Text>
        <Press onPress={() => go('clubStudio', mine ? { id: mine.id } : undefined)} accessibilityLabel={mine ? 'Il mio LifeClub' : 'Crea il tuo LifeClub'}><Text style={{ color: t.accent, fontWeight: '700', fontSize: 13 }}>{mine ? 'Il mio LifeClub' : 'Crea il tuo'}</Text></Press>
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {list.map((c) => (
          <Press key={c.id} onPress={() => go('clubPage', { id: c.id })} accessibilityLabel={c.name} style={{ width: 168, borderRadius: 16, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, overflow: 'hidden' }}>
            <CoverArt cover={c.cover} height={74} radius={0} />
            <View style={{ padding: 10 }}>
              <Text numberOfLines={2} style={{ color: t.text, fontWeight: '700', fontSize: 13, minHeight: 34 }}>{c.name}</Text>
              <Body small muted numberOfLines={1}>{`${memberCounts({ memberships }, c).subscribers} iscritti`}</Body>
            </View>
          </Press>
        ))}
      </ScrollView>
    </View>
  );
}

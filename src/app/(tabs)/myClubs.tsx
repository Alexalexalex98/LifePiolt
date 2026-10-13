import { View } from 'react-native';
import { Text } from '@/components/T';

import { CoverArt } from '@/components/club/parts';
import { useClubSeed } from '@/components/club/hooks';
import { Body, Btn, Card, Item, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { clubsOf, memberCounts, tierOf, useClub } from '@/store/club';

const TIER: Record<string, string> = { free: 'Iscritto', premium: 'Premium', follower: 'Segui', none: '' };

/** I tuoi LifeClub: quelli che gestisci, quelli a cui sei iscritto e quelli da scoprire. */
export default function MyClubs() {
  const t = useTheme();
  useClubSeed();
  const me = useApp((s) => s.account.name);
  const clubs = useClub((s) => s.clubs);
  const memberships = useClub((s) => s.memberships);
  const owned = clubsOf({ clubs }, me);
  const joined = Object.values(clubs).filter((c) => c.owner !== me && tierOf({ memberships }, c.id, me) !== 'none');
  const discover = Object.values(clubs).filter((c) => c.published && c.owner !== me && tierOf({ memberships }, c.id, me) === 'none');
  const row = (c: (typeof owned)[number], badge: string, last: boolean, onPress: () => void) => (
    <Item key={c.id} last={last} onPress={onPress}>
      <Row gap={12}>
        <CoverArt cover={c.cover} size={52} radius={14} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ color: t.text, fontSize: 15.5, fontWeight: '700' }}>{c.name}</Text>
          <Body small muted>{`${memberCounts({ memberships }, c).subscribers} iscritti · di ${c.owner === me ? 'te' : c.owner}`}</Body>
        </View>
        {badge ? <Text style={{ color: t.accent, fontSize: 12, fontWeight: '800' }}>{badge}</Text> : null}
      </Row>
    </Item>
  );
  const title = (txt: string) => <Text style={{ color: t.text, fontSize: 17, fontWeight: '800', marginTop: 18, marginBottom: 6 }}>{txt}</Text>;
  return (
    <Page id="myClubs" back title="I tuoi LifeClub">
      <Body muted>I corsi e le community a cui sei iscritto, quelli che gestisci e altri da scoprire.</Body>
      {title('Gestisci tu')}
      {owned.length ? <Card>{owned.map((c, i) => row(c, 'Studio', i === owned.length - 1, () => go('clubStudio', { id: c.id })))}</Card> : (
        <Card><Body small muted>Non hai ancora un LifeClub: puoi crearne uno con i tuoi corsi e lezioni.</Body><Btn style={{ marginTop: 10 }} icon="plus" title="Crea il tuo LifeClub" onPress={() => go('clubStudio')} /></Card>
      )}
      {title('A cui sei iscritto')}
      {joined.length ? <Card>{joined.map((c, i) => row(c, TIER[tierOf({ memberships }, c.id, me)] ?? '', i === joined.length - 1, () => go('clubPage', { id: c.id })))}</Card> : <Card><Body small muted>Non sei ancora iscritto a nessun LifeClub.</Body></Card>}
      {discover.length > 0 && (
        <>
          {title('Da scoprire')}
          <Card>{discover.map((c, i) => row(c, '', i === discover.length - 1, () => go('clubPage', { id: c.id })))}</Card>
        </>
      )}
    </Page>
  );
}

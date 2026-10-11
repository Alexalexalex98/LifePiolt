import { View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Card, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmtInt } from '@/i18n/format';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { clubByOwner, memberCounts, useClub } from '@/store/club';
import { useClubSeed } from './hooks';
import { CoverArt } from './parts';

/**
 * Scheda LifeClub nel profilo di `owner`: se ha un club mostra una card compatta; se non ce l'ha e il profilo e' il mio,
 * un invito a crearlo; altrimenti nulla.
 */
export function ProfileClubSection({ owner }: { owner: string }) {
  const t = useTheme();
  useClubSeed();
  const me = useApp((s) => s.account.name);
  const clubs = useClub((s) => s.clubs);
  const memberships = useClub((s) => s.memberships);
  const club = clubByOwner({ clubs }, owner);
  const mine = !!owner && owner === me;

  if (club && (club.published || mine)) {
    const c = memberCounts({ memberships }, club);
    return (
      <Card>
        <Row style={{ justifyContent: 'flex-start' }} gap={12}>
          <CoverArt cover={club.cover} size={56} icon="lifeclub" />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>{club.name}</Text>
            <Body small muted numberOfLines={1}>{`LifeClub · ${fmtInt(c.subscribers)} iscritti`}</Body>
          </View>
        </Row>
        <Row style={{ justifyContent: 'flex-start', marginTop: 8 }} gap={14}>
          <Row gap={5}><Icon name="unlock" size={14} color={t.muted} /><Body small muted>Free</Body></Row>
          {club.pricing.monthly > 0 && <Row gap={5}><Icon name="lock" size={14} color={t.muted} /><Body small muted>A pagamento</Body></Row>}
          <Row gap={5}><Icon name="comment" size={14} color={t.muted} /><Body small muted>Chat</Body></Row>
        </Row>
        <Btn style={{ marginTop: 10 }} small title="Apri il LifeClub" icon="arrow-right" onPress={() => go('clubPage', { id: club.id })} />
      </Card>
    );
  }
  if (mine) {
    return (
      <Card>
        <Row style={{ justifyContent: 'flex-start' }} gap={12}>
          <CoverArt cover={{ c1: '#8fa4ff', c2: '#5b86e5' }} size={44} icon="lifeclub" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>Crea il tuo LifeClub</Text>
            <Body small muted>Carica corsi e contenuti, apri una chat con i tuoi follower, con una sezione gratuita e una a pagamento.</Body>
          </View>
        </Row>
        <Btn style={{ marginTop: 10 }} small ghost title="Crea il tuo LifeClub" icon="plus" onPress={() => go('clubStudio')} />
      </Card>
    );
  }
  return null;
}

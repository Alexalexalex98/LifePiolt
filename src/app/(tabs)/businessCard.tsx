import { useLocalSearchParams } from 'expo-router';
import { Share, View, useWindowDimensions } from 'react-native';

import { FlipCard } from '@/components/profile/CardFace';
import { useCardFor } from '@/components/profile/cardData';
import { Body, Btn, Card, Page, Row } from '@/components/ui';
import { go } from '@/lib/nav';
import { HONESTY_NOTICE } from '@/lib/profile/skills';
import { useApp } from '@/store/app';
import { toast } from '@/store/toast';

/** Biglietto da visita (sola lettura): si gira con un tocco. Solo nome, ruolo, attività, competenze e contatti condivisi. */
export default function BusinessCard() {
  const { name: param } = useLocalSearchParams<{ name?: string }>();
  const me = useApp((s) => s.account.name);
  const name = param || me;
  const { design, data, qrText, isMe } = useCardFor(name);
  const w = Math.min(useWindowDimensions().width - 32, 380);
  return (
    <Page id="businessCard" title="Biglietto da visita" back>
      <View style={{ alignItems: 'center', marginTop: 10 }}><FlipCard design={design} data={data} width={w} qrText={qrText} /></View>
      <Body small muted style={{ textAlign: 'center', marginTop: 12 }}>Tocca il biglietto per girarlo.</Body>
      <Row style={{ marginTop: 14 }} gap={8}>
        {isMe && <Btn style={{ flex: 1 }} icon="edit" title="Modifica" onPress={() => go('cardEditor')} />}
        <Btn style={{ flex: 1 }} ghost icon="send" title="Condividi" onPress={() => { Share.share({ message: `${data.name}${data.role ? ' · ' + data.role : ''}${data.business ? ' · ' + data.business : ''}\n${qrText}` }).catch(() => toast('Condivisione non disponibile')); }} />
      </Row>
      <Card style={{ marginTop: 14 }}>
        <Body small muted>Nel biglietto non ci sono scuole, titoli, storico lavorativo, età o indirizzo: contano le competenze. {HONESTY_NOTICE}</Body>
      </Card>
    </Page>
  );
}

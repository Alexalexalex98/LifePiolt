import { useLocalSearchParams } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/T';

import { ProfileClubSection } from '@/components/club/ProfileClubSection';
import { FlipCard } from '@/components/profile/CardFace';
import { useCardFor } from '@/components/profile/cardData';
import { BusinessSection, SkillsSection } from '@/components/profile/ProfileParts';
import { Body, Btn, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';

/** "Altro" del profilo: competenze, biglietto da visita, attività collegate e LifeClub. */
export default function ProfileMore() {
  const t = useTheme();
  const { name: param } = useLocalSearchParams<{ name?: string }>();
  const me = useApp((s) => s.account.name);
  const name = param || me;
  const isMe = name === me;
  const win = useWindowDimensions().width;
  const { design, data, qrText } = useCardFor(name);
  const cardW = Math.min(win - 32, 360);
  return (
    <Page id="profileMore" back title={isMe ? 'Altro sul tuo profilo' : `Altro · ${name}`}>
      <SkillsSection name={name} me={me} />

      <View style={{ marginTop: 22 }}>
        <Row style={{ marginBottom: 10 }}>
          <Text accessibilityRole="header" style={{ color: t.text, fontSize: 17, fontWeight: '800', flex: 1 }}>Biglietto da visita</Text>
          {isMe ? <Btn small ghost icon="edit" title="Modifica" onPress={() => go('cardEditor')} /> : <Btn small ghost title="Apri" onPress={() => go('businessCard', { name })} />}
        </Row>
        <View style={{ alignItems: 'center' }}><FlipCard design={design} data={data} width={cardW} qrText={qrText} /></View>
        <Body small muted style={{ marginTop: 8, textAlign: 'center' }}>Tocca il biglietto per girarlo. Solo nome, ruolo, attività, competenze e contatti che scegli di condividere.</Body>
      </View>

      {!isMe && <Btn style={{ marginTop: 18 }} icon="coin" title={`Invia LifePoints a ${name}`} onPress={() => go('payments', { to: name, tab: 'Invia' })} />}
      <View style={{ marginTop: 22 }}><BusinessSection name={name} me={me} /></View>
      <View style={{ marginTop: 22, marginBottom: 6 }}><ProfileClubSection owner={name} /></View>
    </Page>
  );
}

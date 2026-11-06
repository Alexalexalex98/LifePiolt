import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { HomeChores } from '@/components/casa/HomeChores';
import { HomeFamily } from '@/components/casa/HomeFamily';
import { HomePlan } from '@/components/casa/HomePlan';
import { HomeRooms, QuickStart } from '@/components/casa/HomeRooms';
import { HomeTidy } from '@/components/casa/HomeTidy';
import { HomeToday } from '@/components/casa/HomeToday';
import { Body, Pill } from '@/components/ui';
import { t as tl } from '@/i18n/core';

type Tab = 'oggi' | 'piano' | 'casa' | 'faccende' | 'riordino' | 'famiglia';
const TABS: [Tab, string][] = [['oggi', 'Oggi'], ['piano', 'Piano'], ['casa', 'Casa'], ['faccende', 'Faccende'], ['riordino', 'Riordino'], ['famiglia', 'Famiglia']];

/** Casa: tenere la casa in ordine senza tenere tutto in testa. Il piano si fa da solo. */
export function HomeCare() {
  const [tab, setTab] = useState<Tab>('oggi'); const [quick, setQuick] = useState(false);
  return (
    <View style={{ gap: 14 }}>
      <Body small muted>{tl('Meno cose da ricordare: Casa le pianifica per te, un giorno alla volta.')}</Body>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{TABS.map(([k, l]) => <Pill key={k} label={tl(l)} on={tab === k} onPress={() => setTab(k)} />)}</ScrollView>
      {tab === 'oggi' ? <HomeToday onStart={() => setQuick(true)} /> : null}
      {tab === 'piano' ? <HomePlan /> : null}
      {tab === 'casa' ? <HomeRooms /> : null}
      {tab === 'faccende' ? <HomeChores /> : null}
      {tab === 'riordino' ? <HomeTidy /> : null}
      {tab === 'famiglia' ? <HomeFamily /> : null}
      <QuickStart open={quick} onClose={() => setQuick(false)} />
    </View>
  );
}

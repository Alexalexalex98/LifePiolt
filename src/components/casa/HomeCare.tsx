import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { HomeClean } from '@/components/casa/HomeClean';
import { HomeFamily } from '@/components/casa/HomeFamily';
import { HomeFloor, QuickStart } from '@/components/casa/HomeFloor';
import { HomeToday } from '@/components/casa/HomeToday';
import { Body, Pill } from '@/components/ui';
import { t as tl } from '@/i18n/core';

type Tab = 'oggi' | 'pulizie' | 'planimetria' | 'famiglia';
const TABS: [Tab, string][] = [['oggi', 'Oggi'], ['pulizie', 'Pulizie'], ['planimetria', 'Planimetria'], ['famiglia', 'Famiglia']];

/** Casa: tenere la casa in ordine senza tenere tutto in testa. Oggi cosa fare; Pulizie stanza per stanza; la Planimetria come casa tua; la Famiglia. */
export function HomeCare() {
  const [tab, setTab] = useState<Tab>('oggi'); const [quick, setQuick] = useState(false);
  return (
    <View style={{ gap: 14 }}>
      <Body small muted>{tl('Meno cose da ricordare: Casa le pianifica per te, un giorno alla volta.')}</Body>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{TABS.map(([k, l]) => <Pill key={k} label={tl(l)} on={tab === k} onPress={() => setTab(k)} />)}</ScrollView>
      {tab === 'oggi' ? <HomeToday onStart={() => setQuick(true)} /> : null}
      {tab === 'pulizie' ? <HomeClean onFloor={() => setTab('planimetria')} /> : null}
      {tab === 'planimetria' ? <HomeFloor /> : null}
      {tab === 'famiglia' ? <HomeFamily /> : null}
      <QuickStart open={quick} onClose={() => setQuick(false)} onDone={() => setTab('planimetria')} />
    </View>
  );
}

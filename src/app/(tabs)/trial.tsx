import { View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Card, H, Item, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { TRIAL_DAYS, trialDay, trialDaysLeft } from '@/lib/trial';
import { journeyItems } from '@/lib/trialJourney';
import { useFin } from '@/store/finance';
import { useFitness } from '@/store/fitness';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import { useMemos } from '@/store/memos';
import { useTrial } from '@/store/trial';
import { useWellbeing } from '@/store/wellbeing';

/** «I tuoi 14 giorni»: a che punto sei della prova e cosa puoi aggiungere perché i feedback di Theia siano più utili. */
export default function Trial() {
  const th = useTheme();
  const startedAt = useTrial((s) => s.startedAt);
  // si ridisegna quando cambiano i dati
  useHealth((s) => s.moods); useLife((s) => s.goals); useLife((s) => s.tasks); useFin((s) => s.months); useFitness((s) => s.meals); useMemos((s) => s.memos); useWellbeing((s) => s.results);
  const items = journeyItems();
  const done = items.filter((i) => i.done).length;
  const now = Date.now();
  const day = startedAt ? trialDay(startedAt, now) : 0;
  const left = startedAt ? trialDaysLeft(startedAt, now) : TRIAL_DAYS;
  return (
    <Page id="trial" title={tl('I tuoi 14 giorni')} back>
      <Card>
        <H>{startedAt ? (left > 0 ? tl('Giorno {0} di {1}', day, TRIAL_DAYS) : tl('Prova completata')) : tl('La prova parte con il tuo account')}</H>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: th.tile, overflow: 'hidden', marginVertical: 8 }}><View style={{ width: `${startedAt ? Math.min(100, (day / TRIAL_DAYS) * 100) : 0}%`, height: 8, backgroundColor: th.accent }} /></View>
        <Body small muted>{left > 0 ? tl('Mancano {0} giorni. In questo tempo ti mostro quanto può esserti utile: più dati metti, più i miei feedback sono precisi.', left) : tl('Continui con la versione gratuita e i tuoi dati restano dove sono.')}</Body>
      </Card>
      <Card>
        <Row><H>{tl('Per conoscerti meglio')}</H><Text style={{ color: th.muted, fontWeight: '700' }}>{done}/{items.length}</Text></Row>
        {items.map((i, k) => (
          <Item key={i.id} last={k === items.length - 1} onPress={i.done ? undefined : () => go(i.page)}>
            <Row gap={10} style={{ justifyContent: 'flex-start' }}>
              <Icon name={i.done ? 'check' : 'plus'} size={18} color={i.done ? th.positive : th.muted} stroke={2.4} />
              <View style={{ flex: 1 }}><Body bold={!i.done} muted={i.done}>{tl(i.label)}</Body><Body small muted>{tl(i.why)}</Body></View>
            </Row>
          </Item>
        ))}
      </Card>
      <Btn ghost title={tl('Chiedi a Theia come sto andando')} onPress={() => go('ai')} />
    </Page>
  );
}

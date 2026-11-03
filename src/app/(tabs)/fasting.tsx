import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Body, Btn, Card, H, Input, Page, Pill, Row, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { PLANS, fastStatus, fmtLeft, hmToMin, minToHm } from '@/lib/fitness/fasting';
import { useFasting } from '@/store/fasting';

/** Digiuno intermittente: scegli uno schema (16:8…), l'ora di inizio della finestra del cibo e vedi a che punto sei. Non è un consiglio medico. */
export default function Fasting() {
  const th = useTheme();
  const f = useFasting();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const h = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(h); }, []);
  const plan = PLANS.find((p) => p.id === f.plan) ?? PLANS[1]!;
  const d = new Date(now);
  const st = fastStatus(d.getHours() * 60 + d.getMinutes(), hmToMin(f.start), plan.eatHours);
  const endEat = minToHm(hmToMin(f.start) + plan.eatHours * 60);
  return (
    <Page id="fasting" title={tl('Digiuno intermittente')} back>
      <Card>
        <Toggle value={f.on} onChange={(v) => f.set({ on: v })} label={tl('Segui un digiuno intermittente')} />
        <Body small muted style={{ marginTop: 6 }}>{tl('Mangi solo in una finestra di ore e digiuni il resto. È una scelta personale: se hai condizioni di salute, sei in gravidanza o hai avuto disturbi alimentari, parlane prima con il medico.')}</Body>
      </Card>
      {f.on ? (
        <>
          <Card>
            <H>{st.eating ? tl('Puoi mangiare') : tl('Sei in digiuno')}</H>
            <Body muted>{st.eating ? tl('La finestra del cibo si chiude tra {0}.', fmtLeft(st.minutesLeft)) : tl('Puoi mangiare di nuovo tra {0}.', fmtLeft(st.minutesLeft))}</Body>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: th.tile, overflow: 'hidden', marginTop: 10 }}>
              <View style={{ width: `${Math.round(st.progress * 100)}%`, height: 10, backgroundColor: st.eating ? th.positive : th.accent }} />
            </View>
            <Body small muted style={{ marginTop: 6 }}>{tl('Finestra del cibo: {0} – {1}', f.start, endEat)}</Body>
          </Card>
          <Card>
            <H>{tl('Schema')}</H>
            <Row gap={8} style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>{PLANS.map((p) => <Pill key={p.id} label={p.label} on={f.plan === p.id} onPress={() => f.set({ plan: p.id })} />)}</Row>
            <Body small muted style={{ marginTop: 6 }}>{tl('{0} ore di digiuno, {1} ore per mangiare.', 24 - plan.eatHours, plan.eatHours)}</Body>
            <Body small muted style={{ marginTop: 10, marginBottom: 4 }}>{tl('A che ora inizia la finestra del cibo?')}</Body>
            <Input value={f.start} onChangeText={(v) => f.set({ start: v })} placeholder="12:00" keyboardType="numbers-and-punctuation" style={{ width: 120 }} />
          </Card>
        </>
      ) : null}
    </Page>
  );
}

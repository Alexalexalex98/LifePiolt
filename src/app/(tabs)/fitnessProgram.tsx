import { FIT, FitHero } from '@/components/fitness/kit';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Card, H, Item, Page, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { EX, PROGRAMS, type Goal, type Place } from '@/lib/fitness/data';
import { equipmentOf, nextSessionIndex, sessionMinutes } from '@/lib/fitness/plan';
import { go } from '@/lib/nav';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const stepText = (s: { sets: number; reps?: number; secs?: number }) => (s.secs ? `${s.sets} × ${s.secs >= 120 ? `${Math.round(s.secs / 60)} min` : `${s.secs} s`}` : `${s.sets} × ${s.reps}`);

/** Un programma (con id) o l'elenco di tutti i programmi, filtrabili per luogo e obiettivo. */
export default function FitnessProgram() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const fit = useFitness();
  const p = id ? PROGRAMS.find((x) => x.id === id) : null;
  const [place, setPlace] = useState<Place | 'tutti'>('tutti');
  const [goal, setGoal] = useState<Goal | 'tutti'>('tutti');

  if (!p) {
    const list = PROGRAMS.filter((x) => (place === 'tutti' || x.place === place) && (goal === 'tutti' || x.goal === goal));
    return (
      <Page id="fitnessProgram" back title="Tutti i programmi">
        <FitHero eyebrow="Allenamenti" title="Scegli il tuo programma" sub={tl('{0} programmi per casa, palestra e piscina', PROGRAMS.length)} />
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 6 }} gap={8}>
          {(['tutti', 'casa', 'palestra', 'piscina'] as const).map((x) => <Pill key={x} label={cap(x)} on={place === x} onPress={() => setPlace(x)} />)}
        </Row>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 10 }} gap={8}>
          {(['tutti', 'dimagrire', 'tonificare', 'massa', 'forza', 'resistenza', 'mobilità', 'salute'] as const).map((x) => <Pill key={x} label={cap(x)} on={goal === x} onPress={() => setGoal(x)} />)}
        </Row>
        {list.length === 0 ? <Card><Body muted>Nessun programma con questi filtri.</Body></Card> : list.map((x) => (
          <Card key={x.id} accent={FIT} onPress={() => go('fitnessProgram', { id: x.id })}>
            <Body bold>{x.name}</Body><Body small muted>{x.tagline}</Body>
            <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 8 }} gap={6}><Pill label={cap(x.level)} off /><Pill label={cap(x.place)} off /><Pill label={`${x.days} gg/sett.`} off /><Pill label={tl('{0} settimane', x.weeks)} off /></Row>
          </Card>
        ))}
      </Page>
    );
  }
  const mine = fit.activeProgram === p.id;
  const next = nextSessionIndex(p, fit.history);
  const equip = equipmentOf(p);
  return (
    <Page id="fitnessProgram" back title={p.name}>
      <FitHero eyebrow={`${cap(p.level)} · ${cap(p.place)}`} title={p.name} sub={p.tagline}>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>
          {[`${p.days} gg/sett.`, tl('{0} settimane', p.weeks), ...(p.specialty ? [p.specialty] : [])].map((x) => <View key={x} style={{ backgroundColor: 'rgba(28,11,4,0.2)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: '#1c0b04', fontSize: 12, fontWeight: '800' }}>{x}</Text></View>)}
        </Row>
      </FitHero>
      <Body small muted style={{ marginBottom: 8 }}>{equip.length ? tl('Serve: {0}', equip.join(', ')) : tl('Non serve nessun attrezzo.')}</Body>
      <Row gap={8} style={{ marginBottom: 12 }}>
        <Btn style={{ flex: 1 }} ghost={mine} title={mine ? 'È il tuo programma' : 'Usa questo programma'} disabled={mine} onPress={() => { fit.set({ activeProgram: p.id }); toast('Programma impostato'); }} />
        <Btn style={{ flex: 1 }} icon="play" title="Inizia" onPress={() => go('fitnessWorkout', { program: p.id, session: String(next) })} />
      </Row>
      {p.sessions.map((s, i) => (
        <Card key={s.name} accent={FIT}>
          <Row><H>{s.name}</H><Body small muted>{tl('{0} min', sessionMinutes(p, i))}</Body></Row>
          {s.steps.map((st, k) => { const e = EX(st.ex); return (
            <Item key={k} last={k === s.steps.length - 1}><Row><View style={{ flex: 1 }}><Body>{e?.name ?? st.ex}</Body><Text style={{ color: t.muted, fontSize: 12 }}>{e ? cap(e.muscle) : ''}</Text></View><Body bold>{stepText(st)}</Body></Row></Item>
          ); })}
          <Btn small ghost style={{ marginTop: 8 }} title={i === next ? 'Fai questa (è la prossima)' : 'Fai questa sessione'} onPress={() => go('fitnessWorkout', { program: p.id, session: String(i) })} />
        </Card>
      ))}
    </Page>
  );
}

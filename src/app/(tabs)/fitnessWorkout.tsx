import { FIT, FitHero, Ring } from '@/components/fitness/kit';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Card, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { EX, PROGRAMS } from '@/lib/fitness/data';
import { sessionMinutes } from '@/lib/fitness/plan';
import { goBack } from '@/lib/nav';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

const buzz = () => { if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined); };
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Il trainer ti guida: esercizio per esercizio, serie, timer e recuperi. Alla fine l'allenamento si salva. */
export default function FitnessWorkout() {
  const t = useTheme();
  const { program, session } = useLocalSearchParams<{ program?: string; session?: string }>();
  const fit = useFitness();
  const p = PROGRAMS.find((x) => x.id === program);
  const sIdx = Math.max(0, Math.min((p?.sessions.length ?? 1) - 1, Number(session) || 0));
  const steps = p?.sessions[sIdx]?.steps ?? [];
  const [i, setI] = useState(0);        // esercizio
  const [set, setSet] = useState(1);    // serie corrente
  const [phase, setPhase] = useState<'work' | 'rest' | 'done'>('work');
  const [restTotal, setRestTotal] = useState(60);
  const [left, setLeft] = useState(0);  // secondi (lavoro a tempo o recupero)
  const [running, setRunning] = useState(false);
  const start = useRef(Date.now());
  const setsDone = useRef(0);
  const cur = steps[i];
  const ex = cur ? EX(cur.ex) : undefined;

  const total = steps.reduce((a, s) => a + s.sets, 0);
  const doneSets = steps.slice(0, i).reduce((a, s) => a + s.sets, 0) + (set - 1);

  // quando cambia esercizio a tempo, il timer è pronto a partire
  useEffect(() => { if (phase === 'work' && cur?.secs) { setLeft(cur.secs); setRunning(false); } }, [i, set, phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!running) return;
    const h = setInterval(() => setLeft((x) => (x > 0 ? x - 1 : 0)), 1000);
    return () => clearInterval(h);
  }, [running]);
  useEffect(() => {
    if (!running || left > 0) return;
    setRunning(false); buzz();
    if (phase === 'rest') { setPhase('work'); } else if (phase === 'work' && cur?.secs) finishSet();
  }, [left, running]); // eslint-disable-line react-hooks/exhaustive-deps

  function finishSet() {
    setsDone.current += 1;
    if (set < cur.sets) { setSet(set + 1); if (cur.rest > 0) { setPhase('rest'); setRestTotal(cur.rest); setLeft(cur.rest); setRunning(true); } }
    else if (i < steps.length - 1) { setI(i + 1); setSet(1); if (cur.rest > 0) { setPhase('rest'); setRestTotal(cur.rest); setLeft(cur.rest); setRunning(true); } }
    else { setPhase('done'); }
  }
  function save() {
    if (!p) return;
    const minutes = Math.max(1, Math.round((Date.now() - start.current) / 60000));
    const d = new Date(); const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    fit.logWorkout({ date, programId: p.id, session: sIdx, minutes: Math.max(minutes, 1), sets: setsDone.current });
    buzz(); toast('Allenamento salvato'); goBack();
  }

  if (!p || !cur && phase !== 'done') return <Page id="fitnessWorkout" back title="Allenamento"><Card><Body muted>Programma non trovato.</Body></Card></Page>;
  if (phase === 'done') {
    return (
      <Page id="fitnessWorkout" back title="Finito!">
        <FitHero eyebrow={p.sessions[sIdx].name} title="Bel lavoro" sub={tl('{0} serie completate', setsDone.current)} />
        <Card style={{ gap: 8 }}>
          <Btn title="Salva l'allenamento" onPress={save} />
          <Btn ghost title="Esci senza salvare" onPress={goBack} />
        </Card>
      </Page>
    );
  }
  const timed = !!cur.secs;
  return (
    <Page id="fitnessWorkout" back title={p.sessions[sIdx].name}>
      <FitHero eyebrow={tl('Serie {0} di {1}', doneSets + 1, total)} title={p.sessions[sIdx].name} sub={tl('circa {0} min', sessionMinutes(p, sIdx))}>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(28,11,4,0.22)', overflow: 'hidden' }}><View style={{ width: `${Math.max(3, Math.round((doneSets / Math.max(1, total)) * 100))}%`, height: 8, backgroundColor: '#1c0b04', borderRadius: 4 }} /></View>
      </FitHero>
      {phase === 'rest' ? (
        <Card style={{ alignItems: 'center', marginTop: 12 }}>
          <Body muted>Recupero</Body>
          <Ring size={170} stroke={12} value={left / Math.max(1, restTotal)} big={mmss(left)} small={tl('recupero')} />
          <Body small muted>{tl('Prossimo: {0}', ex?.name ?? '')}</Body>
          <Btn style={{ marginTop: 10, alignSelf: 'stretch' }} ghost title="Salta il recupero" onPress={() => { setRunning(false); setPhase('work'); }} />
        </Card>
      ) : (
        <Card style={{ marginTop: 12 }}>
          <Text style={{ color: t.text, fontSize: 24, fontWeight: '900' }}>{ex?.name}</Text>
          <Body small muted style={{ marginBottom: 8 }}>{tl('Serie {0} di {1}', set, cur.sets)}</Body>
          <Text style={{ color: FIT, fontSize: 52, fontWeight: '900', textAlign: 'center', marginVertical: 8 }}>{timed ? mmss(left) : `${cur.reps} ${tl('ripetizioni')}`}</Text>
          <Body small>{ex?.how}</Body>
          {timed ? (
            <Row gap={8} style={{ marginTop: 12 }}>
              <Btn style={{ flex: 1 }} title={running ? 'Pausa' : left < (cur.secs ?? 0) ? 'Riprendi' : 'Avvia il timer'} onPress={() => setRunning((v) => !v)} />
              <Btn style={{ flex: 1 }} ghost title="Fatto" onPress={() => { setRunning(false); finishSet(); }} />
            </Row>
          ) : <Btn style={{ marginTop: 12 }} title="Serie fatta" onPress={finishSet} />}
        </Card>
      )}
      <Btn ghost small style={{ marginTop: 12 }} title="Interrompi" onPress={goBack} />
    </Page>
  );
}

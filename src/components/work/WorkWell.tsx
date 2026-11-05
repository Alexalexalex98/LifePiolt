import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { NoWorkspace } from '@/components/work/NoWorkspace';
import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Pill, Row, Sheet, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { refreshReminders } from '@/lib/notify';
import { today } from '@/lib/teamWork';
import { EXERCISES, MOOD_LABELS, breakPlan, exerciseOfDay, lastDays, moodAverage, moodVsLoad, workLoad, type Exercise, type WorkMood } from '@/lib/workWell';
import { useLife } from '@/store/life';
import { useTeams } from '@/store/teams';
import { toast } from '@/store/toast';
import { useWork, scheduleOf } from '@/store/work';
import { useWorkWell } from '@/store/workWell';

const LEVEL = { ok: { label: 'Tutto in equilibrio', color: '#22c55e' }, attenzione: { label: 'Un po\' di attenzione', color: '#f59e0b' }, alto: { label: 'Carico alto', color: '#ef4444' } } as const;
const SIG_TONE = { attenzione: '#f59e0b', alto: '#ef4444' } as const;

/** Benessere al lavoro: carico e stanchezza dai tuoi impegni, pause, esercizi, disconnessione, umore. Solo per te: non va mai al team e non giudica nessuno. */
export function WorkWell() {
  const th = useTheme();
  const teams = useTeams((s) => s.teams);
  const active = useWork((s) => s.active);
  const team = teams.find((x) => x.id === active) ?? teams[0];
  const schedules = useWork((s) => s.schedules);
  const events = useLife((s) => s.events);
  const tasks = useLife((s) => s.tasks);
  const ww = useWorkWell();
  const [ex, setEx] = useState<Exercise | null>(null);
  const t0 = today();
  const sched = scheduleOf(team?.id, schedules);
  const load = useMemo(() => workLoad(events, sched, tasks, t0, 7), [events, sched, tasks, t0]);
  const todayEv = events[t0] ?? [];
  const breaks = useMemo(() => breakPlan(todayEv, sched, t0), [todayEv, sched, t0]);
  if (!team) return <NoWorkspace what="tieni sotto controllo carico, pause e riposo" />;
  const lv = LEVEL[load.level];
  const putBreaks = () => {
    let n = 0;
    for (const b of breaks) if (!todayEv.some((e) => e.time === b.time && e.title === b.title)) { useLife.getState().addEvent(t0, { time: b.time, title: b.title, dur: b.dur }); n++; }
    toast(n ? tl('{0} pause nel tuo Plan di oggi', n) : 'Le pause sono già nel Plan');
  };
  return (
    <View style={{ gap: 14 }}>
      <Card accent={lv.color}>
        <Row><H>Come va il carico</H><Pill label={tl(lv.label)} color={lv.color} /></Row>
        <Body small muted style={{ marginTop: 4 }}>{tl('Guardo i tuoi impegni di lavoro degli ultimi 7 giorni. Lo vedi solo tu.')}</Body>
        {load.signals.length === 0 ? <Body style={{ marginTop: 8 }}>{tl('Nessun segnale di fatica: orari rispettati e pause al loro posto. Bravo!')}</Body> : load.signals.map((s) => (
          <View key={s.id} style={{ borderLeftWidth: 3, borderLeftColor: SIG_TONE[s.level], paddingLeft: 10, marginTop: 10 }}>
            <Body bold>{tl(s.title)}</Body><Body small muted>{s.why}</Body><Body small>{s.tip}</Body>
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, alignItems: 'flex-end', height: 44 }} accessibilityLabel={tl('Ore fuori orario negli ultimi 7 giorni')}>
          {load.days.map((d) => <View key={d.day} style={{ flex: 1, height: Math.max(4, Math.min(44, d.extraMin / 4)), borderRadius: 4, backgroundColor: d.extraMin >= 60 ? '#f59e0b' : th.chip }} />)}
        </View>
        <Body small muted style={{ marginTop: 4 }}>{tl('Ogni barra è un giorno: più alta = più minuti fuori orario.')}</Body>
      </Card>

      <Card>
        <H>Pause di oggi</H>
        {breaks.length ? <>
          <Body small muted style={{ marginTop: 4 }}>{tl('Dove non hai impegni: ogni circa un\'ora ti alzi, ogni due bevi.')}</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{breaks.map((b) => <Pill key={b.time} label={`${b.time} · ${b.kind === 'water' ? tl('acqua') : tl('muoviti')}`} />)}</View>
          <View style={{ marginTop: 10, alignSelf: 'flex-start' }}><Btn small icon="calendar" title="Metti le pause nel Plan" onPress={putBreaks} /></View>
        </> : <Empty text="Oggi non ho trovato spazi per le pause: giornata libera o piena di impegni." />}
      </Card>

      <Card>
        <H>Esercizi brevi in ufficio</H>
        <Body small muted style={{ marginTop: 4 }}>{tl('Da fare alla scrivania, senza attrezzi. Se senti dolore, fermati.')}</Body>
        <Pressable onPress={() => setEx(exerciseOfDay(t0))} accessibilityRole="button" style={{ marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: th.chip }}>
          <Body small bold muted>{tl('DI OGGI').toUpperCase()}</Body><Body bold>{tl(exerciseOfDay(t0).title)}</Body>
        </Pressable>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>{EXERCISES.map((e) => <Pill key={e.id} label={tl(e.title)} onPress={() => setEx(e)} />)}</View>
      </Card>

      <Card>
        <H>Disconnessione fuori orario</H>
        <Toggle label={tl('Non avvisarmi degli impegni di lavoro fuori dal mio orario')} value={ww.disconnect} onChange={(v) => { ww.set({ disconnect: v }); void refreshReminders(); toast(v ? 'Fuori orario non ti disturbo' : 'Avvisi di lavoro sempre attivi'); }} hint={tl('Vale per i promemoria degli impegni di lavoro. Il tuo orario lo imposti in Piano → Orario di lavoro.')} />
      </Card>

      <Mood />

      <Text style={{ color: th.muted, fontSize: 12 }}>{tl('Questa sezione serve solo a te. Non viene mai mandata al team, al responsabile o ad altri, e non si usa per giudicare le persone.')}</Text>
      {ex ? <ExerciseSheet ex={ex} onClose={() => setEx(null)} /> : null}
    </View>
  );
}

function Mood() {
  const th = useTheme();
  const { moodOn, moods, set, setMood, clear } = useWorkWell();
  const events = useLife((s) => s.events);
  const t0 = today();
  const mine = moods.find((m) => m.day === t0);
  const hint = useMemo(() => moodVsLoad(moods, (d) => (events[d] ?? []).filter((e) => e.team).reduce((n, e) => n + (e.dur ?? 60), 0)), [moods, events]);
  const week = lastDays(t0, 7);
  return (
    <Card>
      <H>Come stai al lavoro</H>
      <Toggle label={tl('Controllo dell\'umore al lavoro')} value={moodOn} onChange={(v) => { set({ moodOn: v }); }} hint={tl('Una domanda al giorno, solo se vuoi. Resta sul tuo telefono: nessun altro la vede.')} />
      {moodOn ? (
        <>
          <Body bold style={{ marginTop: 10 }}>{tl('Com\'è andata oggi?')}</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{([1, 2, 3, 4, 5] as const).map((v) => <Pill key={v} label={tl(MOOD_LABELS[v]!)} on={mine?.v === v} onPress={() => { const m: WorkMood = { day: t0, v }; setMood(m); toast('Segnato, grazie'); }} />)}</View>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 14, alignItems: 'flex-end', height: 50 }} accessibilityLabel={tl('Umore degli ultimi 7 giorni')}>
            {week.map((d) => { const m = moods.find((x) => x.day === d); return <View key={d} style={{ flex: 1, height: m ? m.v * 10 : 4, borderRadius: 4, backgroundColor: m ? th.accent : th.chip }} />; })}
          </View>
          <Body small muted style={{ marginTop: 4 }}>{(() => { const a = moodAverage(moods, week); return a == null ? tl('Ancora nessun dato questa settimana.') : tl('Media della settimana: {0} su 5', a); })()}</Body>
          {hint.hint ? <Body small style={{ marginTop: 8 }}>{tl(hint.hint)}</Body> : <Body small muted style={{ marginTop: 8 }}>{tl('Dopo una settimana di risposte ti dico cosa noto, sempre solo per te.')}</Body>}
          <View style={{ marginTop: 10, alignSelf: 'flex-start' }}><Btn small ghost danger title="Cancella i miei dati" onPress={() => { clear(); toast('Dati cancellati'); }} /></View>
        </>
      ) : null}
    </Card>
  );
}

function ExerciseSheet({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const [left, setLeft] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const start = () => {
    if (timer.current) clearInterval(timer.current);
    setLeft(ex.seconds);
    timer.current = setInterval(() => setLeft((l) => { if (l == null || l <= 1) { if (timer.current) clearInterval(timer.current); return 0; } return l - 1; }), 1000);
  };
  return (
    <Sheet visible title={tl(ex.title)} onClose={onClose}>
      {ex.steps.map((s, i) => <Body key={i} style={{ marginBottom: 6 }}>{`${i + 1}. ${tl(s)}`}</Body>)}
      {ex.note ? <Body small muted style={{ marginTop: 4 }}>{tl(ex.note)}</Body> : null}
      <Text style={{ fontSize: 40, fontWeight: '800', textAlign: 'center', marginVertical: 12 }}>{left == null ? `${ex.seconds}s` : left === 0 ? tl('Fatto!') : `${left}s`}</Text>
      <Btn icon="clock" title={left == null ? 'Inizia' : left === 0 ? 'Ancora una volta' : 'Ricomincia'} onPress={start} />
    </Sheet>
  );
}

import type { ComponentRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { ExerciseThumb } from '@/components/fitness/ExercisePhotos';
import { ExercisePicker } from '@/components/fitness/ExercisePicker';
import { FIT } from '@/components/fitness/kit';
import { InfoTip } from '@/components/InfoTip';
import { Text } from '@/components/T';
import { Body, Btn, Card, H, Item, Page, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { addDays, dayInfo, parseIso } from '@/lib/fitness/dayPlan';
import { exById, type ExerciseX } from '@/lib/fitness/exerciseDb';
import { editKey, recommend, sessionMinutes, stepsOf } from '@/lib/fitness/plan';
import { ALL_PROGRAMS, programById } from '@/lib/fitness/programsExtra';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const WD = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
const stepText = (s: { sets: number; reps?: number; secs?: number }) => (s.secs ? `${s.sets} × ${s.secs >= 120 ? `${Math.round(s.secs / 60)} min` : `${s.secs} s`}` : `${s.sets} × ${s.reps ?? 10}`);
const CELL = 52;

/** Un giorno qualsiasi, passato o futuro: cosa c'è in programma, gli esercizi da spuntare, e puoi cambiare tutto. */
export default function FitnessPlanDay() {
  const t = useTheme();
  const fit = useFitness();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const today = isoToday();
  const [date, setDate] = useState(dateParam && /^\d{4}-\d{2}-\d{2}$/.test(String(dateParam)) ? String(dateParam) : today);
  const [choose, setChoose] = useState(false);
  const [progPick, setProgPick] = useState<string | null>(null);
  const [swapAt, setSwapAt] = useState<number | null>(null);
  const strip = useRef<ComponentRef<typeof ScrollView>>(null);

  const active = fit.activeProgram ? programById(fit.activeProgram) ?? null : null;
  const ctx = useMemo(() => ({ program: active, profile: fit.profile, history: fit.history, plans: fit.plans ?? {}, now: new Date() }), [active, fit.profile, fit.history, fit.plans]);
  const info = dayInfo(date, ctx);
  const p = info.programId ? programById(info.programId) ?? null : null;
  const sIdx = info.session ?? 0;
  const steps = p ? stepsOf(p, sIdx, fit.edits) : [];
  const key = p ? `${p.id}:${sIdx}` : '';
  const done = new Set((fit.exDone ?? {})[date]?.key === key ? (fit.exDone ?? {})[date]?.idx : []);
  const allDone = info.done || (steps.length > 0 && done.size >= steps.length);
  const days = useMemo(() => Array.from({ length: 29 }, (_, i) => addDays(today, i - 14)), [today]);
  const selIdx = days.indexOf(date);
  useEffect(() => { const i = days.indexOf(date); if (i >= 0) setTimeout(() => strip.current?.scrollTo({ x: Math.max(0, (i - 2) * CELL), animated: true }), 50); }, [date, days]);

  const when = parseIso(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const rel = date === today ? tl('Oggi') : date === addDays(today, 1) ? tl('Domani') : date === addDays(today, -1) ? tl('Ieri') : date < today ? tl('Giorno passato') : tl('Giorno futuro');
  const mini = (d: string) => {
    const i = dayInfo(d, ctx); const dn = (fit.exDone ?? {})[d];
    const partial = !i.done && !!dn && dn.idx.length > 0;
    return { i, partial };
  };
  const toggle = (k: number) => { if (!p) return; fit.toggleEx(date, key, k, steps.length, { programId: p.id, session: sIdx, minutes: sessionMinutes(p, sIdx, fit.edits), sets: steps.reduce((a, s) => a + s.sets, 0) }); };
  const setChosen = (programId: string, session: number) => { fit.setDayPlan(date, { programId, session }); setChoose(false); setProgPick(null); };
  const pickEx = (e: ExerciseX) => {
    if (swapAt == null || !p) return;
    const cur = steps[swapAt];
    fit.setEdit(editKey(p, sIdx), steps.map((x, j) => (j === swapAt ? (e.timed ? { ex: e.id, sets: cur.sets, secs: cur.secs ?? 30, rest: cur.rest } : { ex: e.id, sets: cur.sets, reps: cur.reps ?? 10, rest: cur.rest }) : x)));
    setSwapAt(null); toast('Esercizio cambiato: vale per questa sessione ogni volta che la fai');
  };
  const progList = useMemo(() => { const base = [...(active ? [active] : []), ...(fit.profile ? recommend(fit.profile, 6) : ALL_PROGRAMS.slice(0, 6))]; return base.filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i); }, [active, fit.profile]);
  const pp = progPick ? programById(progPick) : null;

  return (
    <Page id="fitnessPlanDay" back title="Allenamento del giorno">
      <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {days.map((d) => {
          const { i, partial } = mini(d); const sel = d === date; const dt = parseIso(d);
          return (
            <Pressable key={d} accessibilityRole="button" accessibilityLabel={dt.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} onPress={() => setDate(d)} style={{ width: CELL - 6, alignItems: 'center', gap: 4 }}>
              <Text style={{ color: d === today ? FIT : t.muted, fontSize: 11, fontWeight: '800' }}>{WD[dt.getDay()]}</Text>
              <View style={{ width: CELL - 10, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: i.done ? FIT : (i.planned && d < today) ? t.warn + '26' : sel ? t.chip : i.planned ? FIT + '2e' : t.chip + '88', borderWidth: sel ? 2 : 0, borderColor: FIT }}>
                {i.done ? <Icon name="check" size={18} color="#1c0b04" stroke={3} /> : (i.planned && d < today) ? <Icon name="x" size={18} color={t.warn} stroke={3} /> : <Text style={{ color: t.text, fontWeight: '800', fontSize: 15 }}>{dt.getDate()}</Text>}
                {partial ? <View style={{ position: 'absolute', bottom: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: FIT }} /> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <Row style={{ marginTop: 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Giorno precedente')} hitSlop={10} onPress={() => setDate(addDays(date, -1))}><Icon name="arrow-left" size={20} color={t.text} /></Pressable>
        <View style={{ alignItems: 'center', flex: 1 }}><Body bold style={{ textTransform: 'capitalize' }}>{when}</Body><Body small muted>{rel}</Body></View>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Giorno successivo')} hitSlop={10} onPress={() => setDate(addDays(date, 1))}><Icon name="arrow-right" size={20} color={t.text} /></Pressable>
      </Row>
      {selIdx < 0 ? <Btn small ghost title="Torna a oggi" onPress={() => setDate(today)} /> : null}

      {p && info.planned ? (
        <Card accent={FIT}>
          <Row>
            <View style={{ flex: 1 }}>
              <H style={{ marginBottom: 0 }}>{p.sessions[sIdx].name}</H>
              <Body small muted>{`${p.name} · ${tl('{0} min', sessionMinutes(p, sIdx, fit.edits))}`}</Body>
            </View>
            {allDone ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: FIT, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Icon name="check" size={14} color="#1c0b04" stroke={3} /><Text style={{ color: '#1c0b04', fontWeight: '800', fontSize: 12 }}>{tl('Fatto')}</Text></View> : null}
          </Row>
          <Row style={{ marginTop: 6 }} gap={8}>
            <Body small muted style={{ flex: 1 }}>{tl('{0} su {1} esercizi fatti', allDone && info.done && !done.size ? steps.length : done.size, steps.length)}</Body>
            <InfoTip title="Come si spunta" body={['Tocca il cerchio accanto a un esercizio quando l’hai fatto. Se li fai tutti, la giornata si spunta da sola; se ne salti uno, resta senza spunta e il giorno non risulta completo.', 'Puoi cambiare sessione o esercizi quando vuoi, anche per i giorni futuri.']} />
          </Row>
          {steps.map((st, k) => {
            const e = exById(st.ex, fit.customEx); const on = done.has(k) || (info.done && !(fit.exDone ?? {})[date]);
            return (
              <View key={k} style={{ borderTopWidth: k ? 1 : 0, borderTopColor: t.border, paddingVertical: 8 }}>
                <Row gap={10}>
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={e?.name ?? st.ex} hitSlop={8} onPress={() => toggle(k)} style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: on ? FIT : t.border, backgroundColor: on ? FIT : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <Icon name="check" size={16} color="#1c0b04" stroke={3} /> : null}
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={e?.name ?? st.ex} onPress={() => go('fitnessExercise', { id: st.ex })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <ExerciseThumb ex={e ?? { id: st.ex }} size={46} />
                    <View style={{ flex: 1 }}><Body bold style={on ? { opacity: 0.6 } : undefined}>{e?.name ?? st.ex}</Body><Body small muted>{stepText(st)}</Body></View>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={tl('Cambia esercizio')} hitSlop={8} onPress={() => setSwapAt(k)}><Icon name="repeat" size={18} color={t.muted} /></Pressable>
                </Row>
              </View>
            );
          })}
          <Row style={{ marginTop: 10 }} gap={8}>
            <Btn style={{ flex: 1 }} icon="play" title={date === today ? 'Inizia' : 'Fai ora'} onPress={() => go('fitnessWorkout', { program: p.id, session: String(sIdx) })} />
            <Btn style={{ flex: 1 }} ghost icon="calendar" title="Cambia giornata" onPress={() => setChoose(true)} />
          </Row>
        </Card>
      ) : (
        <Card accent={FIT}>
          <H>{info.source === 'scelta' ? 'Giorno di riposo scelto' : 'Nessun allenamento previsto'}</H>
          <Body small muted>{fit.profile ? 'Recuperare fa parte del programma. Se vuoi, puoi comunque allenarti.' : 'Crea il tuo piano da LifeFitness oppure scegli tu cosa fare.'}</Body>
          <Btn style={{ marginTop: 10 }} icon="plus" title="Scegli un allenamento" onPress={() => setChoose(true)} />
        </Card>
      )}
      {info.source === 'scelta' ? <Btn small ghost title="Torna al programma" onPress={() => { fit.setDayPlan(date, null); toast('Giornata ripristinata'); }} /> : null}

      <Sheet visible={choose} title={pp ? pp.name : 'Cosa fai questo giorno?'} onClose={() => { setChoose(false); setProgPick(null); }}>
        {pp ? (
          <View>
            <Btn small ghost icon="arrow-left" title="Altri programmi" onPress={() => setProgPick(null)} />
            {pp.sessions.map((s, i) => <Item key={s.name} last={i === pp.sessions.length - 1} onPress={() => setChosen(pp.id, i)}><Row><View style={{ flex: 1 }}><Body bold>{s.name}</Body><Body small muted>{tl('{0} min', sessionMinutes(pp, i, fit.edits))}</Body></View><Icon name="chevron" size={16} color={t.muted} /></Row></Item>)}
          </View>
        ) : (
          <View>
            <Item onPress={() => { fit.setDayPlan(date, { rest: true }); setChoose(false); }}><Row><Body bold style={{ flex: 1 }}>Giorno di riposo</Body><Icon name="chevron" size={16} color={t.muted} /></Row></Item>
            {progList.map((x, i) => <Item key={x.id} last={i === progList.length - 1} onPress={() => setProgPick(x.id)}><Row><View style={{ flex: 1 }}><Body bold>{x.name}</Body><Body small muted>{x.tagline}</Body></View><Icon name="chevron" size={16} color={t.muted} /></Row></Item>)}
            <Btn small ghost style={{ marginTop: 8 }} title="Tutte le schede" onPress={() => { setChoose(false); go('fitnessProgram', { id: '' }); }} />
          </View>
        )}
      </Sheet>
      <ExercisePicker visible={swapAt != null} title="Cambia esercizio" onClose={() => setSwapAt(null)} onPick={pickEx} />
    </Page>
  );
}

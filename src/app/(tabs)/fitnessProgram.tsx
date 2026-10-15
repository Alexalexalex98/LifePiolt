import { FIT, FitHero } from '@/components/fitness/kit';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/T';

import { ExerciseFigure } from '@/components/fitness/ExerciseFigure';
import { ExercisePicker } from '@/components/fitness/ExercisePicker';
import { Body, Btn, Card, H, Input, Page, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import type { Goal, Place, Step } from '@/lib/fitness/data';
import { exById, type ExerciseX } from '@/lib/fitness/exerciseDb';
import { editKey, equipmentOf, newStep, nextSessionIndex, sessionMinutes, stepsOf, whyThis } from '@/lib/fitness/plan';
import { ALL_PROGRAMS, NEEDS, programById, searchPrograms } from '@/lib/fitness/programsExtra';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const stepText = (s: { sets: number; reps?: number; secs?: number }) => (s.secs ? `${s.sets} × ${s.secs >= 120 ? `${Math.round(s.secs / 60)} min` : `${s.secs} s`}` : `${s.sets} × ${s.reps}`);
const first = (s?: string) => (s ?? '').split(/(?<=[.!?])\s/)[0];

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  const t = useTheme();
  const btn = { width: 34, height: 34, borderRadius: 17, backgroundColor: t.chip, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text style={{ color: t.muted, fontSize: 10.5 }}>{label}</Text>
      <Row gap={6}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label} -`} onPress={onMinus} style={btn}><Icon name="minus" size={16} color={t.text} /></Pressable>
        <Text style={{ color: t.text, fontWeight: '800', minWidth: 40, textAlign: 'center', fontSize: 13 }}>{value}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label} +`} onPress={onPlus} style={btn}><Icon name="plus" size={16} color={t.text} /></Pressable>
      </Row>
    </View>
  );
}

/** Un programma (con id) o l'elenco di tutte le schede, con ricerca e filtro «per chi». */
export default function FitnessProgram() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const fit = useFitness();
  const p = programById(id);
  const [place, setPlace] = useState<Place | 'tutti'>('tutti');
  const [goal, setGoal] = useState<Goal | 'tutti'>('tutti');
  const [q, setQ] = useState('');
  const [need, setNeed] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [picker, setPicker] = useState<{ kind: 'replace'; i: number } | { kind: 'add' } | null>(null);
  const list = useMemo(() => searchPrograms(q, need).filter((x) => (place === 'tutti' || x.place === place) && (goal === 'tutti' || x.goal === goal)), [q, need, place, goal]);

  if (!p) {
    return (
      <Page id="fitnessProgram" back title="Tutti i programmi">
        <FitHero eyebrow="Allenamenti" title="Scegli la tua scheda" sub={tl('{0} schede: per il tuo lavoro, la tua età, il tuo sport e i tuoi obiettivi', ALL_PROGRAMS.length)} />
        <Input placeholder="Cerca (es. schiena, corsa, over 60, tennis)" value={q} onChangeText={setQ} autoCapitalize="none" />
        <Body bold style={{ marginTop: 4 }}>Per chi</Body>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }} contentContainerStyle={{ gap: 6 }}>
          <Pill label="Tutte" on={!need} onPress={() => setNeed(null)} />
          {NEEDS.map((n) => <Pill key={n.id} label={n.label} on={need === n.id} onPress={() => setNeed(need === n.id ? null : n.id)} />)}
        </ScrollView>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 6 }} gap={8}>
          {(['tutti', 'casa', 'palestra', 'piscina'] as const).map((x) => <Pill key={x} label={cap(x)} on={place === x} onPress={() => setPlace(x)} />)}
        </Row>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 10 }} gap={8}>
          {(['tutti', 'dimagrire', 'tonificare', 'massa', 'forza', 'resistenza', 'mobilità', 'salute'] as const).map((x) => <Pill key={x} label={cap(x)} on={goal === x} onPress={() => setGoal(x)} />)}
        </Row>
        <Body small muted style={{ marginBottom: 6 }}>{tl('{0} schede', list.length)}</Body>
        {list.length === 0 ? <Card><Body muted>Nessuna scheda con questi filtri.</Body></Card> : list.map((x) => (
          <Card key={x.id} accent={FIT} onPress={() => go('fitnessProgram', { id: x.id })}>
            <Body bold>{x.name}</Body><Body small muted>{x.tagline}</Body>
            {x.who ? <Body small style={{ marginTop: 6 }}>{first(x.who)}</Body> : null}
            <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 8 }} gap={6}><Pill label={cap(x.level)} off /><Pill label={cap(x.place)} off /><Pill label={`${x.days} gg/sett.`} off /><Pill label={tl('{0} settimane', x.weeks)} off /></Row>
          </Card>
        ))}
      </Page>
    );
  }

  const mine = fit.activeProgram === p.id;
  const next = nextSessionIndex(p, fit.history);
  const equip = equipmentOf(p);
  const why = fit.profile ? whyThis(p, fit.profile) : [];
  const exOf = (idd: string): ExerciseX | undefined => exById(idd, fit.customEx);
  const change = (si: number, steps: Step[]) => fit.setEdit(editKey(p, si), steps);
  const edited = (si: number) => !!fit.edits[editKey(p, si)];
  const upd = (si: number, k: number, patch: Partial<Step>) => change(si, stepsOf(p, si, fit.edits).map((s, j) => (j === k ? { ...s, ...patch } : s)));
  const onPick = (e: ExerciseX) => {
    if (!picker || editing == null) return;
    const cur = stepsOf(p, editing, fit.edits);
    if (picker.kind === 'add') change(editing, [...cur, newStep(e)]);
    else change(editing, cur.map((s, j) => (j === picker.i ? (e.timed ? { ex: e.id, sets: s.sets, secs: s.secs ?? 30, rest: s.rest } : { ex: e.id, sets: s.sets, reps: s.reps ?? 10, rest: s.rest }) : s)));
    setPicker(null);
  };

  return (
    <Page id="fitnessProgram" back title={p.name}>
      <FitHero eyebrow={`${cap(p.level)} · ${cap(p.place)}`} title={p.name} sub={p.tagline}>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>
          {[`${p.days} gg/sett.`, tl('{0} settimane', p.weeks), ...(p.specialty ? [p.specialty] : [])].map((x) => <View key={x} style={{ backgroundColor: 'rgba(28,11,4,0.2)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: '#1c0b04', fontSize: 12, fontWeight: '800' }}>{x}</Text></View>)}
        </Row>
      </FitHero>
      {p.who || p.why ? (
        <Card>
          {p.who ? <><H style={{ marginBottom: 2 }}>Per chi è</H><Body small>{p.who}</Body></> : null}
          {p.why ? <><H style={{ marginTop: 10, marginBottom: 2 }}>Perché è fatta così</H><Body small>{p.why}</Body></> : null}
          {why.length ? <><H style={{ marginTop: 10, marginBottom: 2 }}>Perché è adatta a te</H>{why.map((x) => <Row key={x} style={{ justifyContent: 'flex-start', alignItems: 'flex-start', marginBottom: 2 }} gap={6}><Icon name="check" size={14} color={FIT} stroke={2.6} /><Body small style={{ flex: 1 }}>{x}</Body></Row>)}</> : null}
          {p.caution ? <View style={{ marginTop: 10, borderRadius: 12, padding: 10, backgroundColor: t.warn + '22' }}><Body small bold color={t.warn}>Da sapere</Body><Body small>{p.caution}</Body></View> : null}
        </Card>
      ) : null}
      <Body small muted style={{ marginBottom: 8 }}>{equip.length ? tl('Serve: {0}', equip.join(', ')) : tl('Non serve nessun attrezzo.')}</Body>
      <Row gap={8} style={{ marginBottom: 12 }}>
        <Btn style={{ flex: 1 }} ghost={mine} title={mine ? 'È il tuo programma' : 'Usa questo programma'} disabled={mine} onPress={() => { fit.set({ activeProgram: p.id }); toast('Programma impostato'); }} />
        <Btn style={{ flex: 1 }} icon="play" title="Inizia" onPress={() => go('fitnessWorkout', { program: p.id, session: String(next) })} />
      </Row>
      {p.sessions.map((s, i) => {
        const steps = stepsOf(p, i, fit.edits); const on = editing === i;
        return (
          <Card key={s.name} accent={FIT}>
            <Row><View style={{ flex: 1 }}><H style={{ marginBottom: 0 }}>{s.name}</H><Body small muted>{tl('{0} min', sessionMinutes(p, i, fit.edits))}{edited(i) ? ` · ${tl('modificata da te')}` : ''}</Body></View>
              <Btn small ghost title={on ? 'Fatto' : 'Modifica'} onPress={() => setEditing(on ? null : i)} /></Row>
            {steps.map((st, k) => {
              const e = exOf(st.ex);
              return (
                <View key={k} style={{ borderTopWidth: k ? 1 : 0, borderTopColor: t.border, paddingVertical: 8 }}>
                  <Pressable accessibilityRole="button" accessibilityLabel={e?.name ?? st.ex} onPress={() => go('fitnessExercise', { id: st.ex })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <ExerciseFigure ex={e} size={54} captions={false} />
                    <View style={{ flex: 1 }}><Body bold>{e?.name ?? st.ex}</Body><Text style={{ color: t.muted, fontSize: 12 }}>{e ? cap(e.muscle) : ''}</Text></View>
                    <Body bold>{stepText(st)}</Body>
                  </Pressable>
                  {on ? (
                    <View style={{ marginTop: 8 }}>
                      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }} gap={8}>
                        <Stepper label="Serie" value={String(st.sets)} onMinus={() => upd(i, k, { sets: Math.max(1, st.sets - 1) })} onPlus={() => upd(i, k, { sets: Math.min(10, st.sets + 1) })} />
                        {st.secs ? <Stepper label="Secondi" value={String(st.secs)} onMinus={() => upd(i, k, { secs: Math.max(5, st.secs! - (st.secs! > 120 ? 60 : 5)) })} onPlus={() => upd(i, k, { secs: Math.min(3600, st.secs! + (st.secs! >= 120 ? 60 : 5)) })} />
                          : <Stepper label="Ripetizioni" value={String(st.reps ?? 10)} onMinus={() => upd(i, k, { reps: Math.max(1, (st.reps ?? 10) - 1) })} onPlus={() => upd(i, k, { reps: Math.min(50, (st.reps ?? 10) + 1) })} />}
                        <Stepper label="Recupero" value={`${st.rest}s`} onMinus={() => upd(i, k, { rest: Math.max(0, st.rest - 15) })} onPlus={() => upd(i, k, { rest: Math.min(300, st.rest + 15) })} />
                      </Row>
                      <Row style={{ marginTop: 8 }} gap={8}>
                        <Btn small ghost icon="repeat" title="Cambia esercizio" onPress={() => setPicker({ kind: 'replace', i: k })} />
                        <Btn small ghost danger icon="trash" title="Togli" disabled={steps.length <= 1} onPress={() => change(i, steps.filter((_, j) => j !== k))} />
                      </Row>
                    </View>
                  ) : null}
                </View>
              );
            })}
            {on ? (
              <View style={{ marginTop: 6, gap: 8 }}>
                <Btn small icon="plus" title="Aggiungi un esercizio" onPress={() => setPicker({ kind: 'add' })} />
                {edited(i) ? <Btn small ghost title="Torna alla scheda originale" onPress={() => { fit.resetEdit(editKey(p, i)); toast('Sessione ripristinata'); }} /> : null}
              </View>
            ) : <Btn small ghost style={{ marginTop: 8 }} title={i === next ? 'Fai questa (è la prossima)' : 'Fai questa sessione'} onPress={() => go('fitnessWorkout', { program: p.id, session: String(i) })} />}
          </Card>
        );
      })}
      <ExercisePicker visible={!!picker} title={picker?.kind === 'add' ? 'Aggiungi un esercizio' : 'Cambia esercizio'} onClose={() => setPicker(null)} onPick={onPick} />
    </Page>
  );
}

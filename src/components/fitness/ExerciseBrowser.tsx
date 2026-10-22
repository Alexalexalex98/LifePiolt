import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { ExerciseMedia, ExerciseThumb } from '@/components/fitness/ExercisePhotos';
import { FIT } from '@/components/fitness/kit';
import { Body, Btn, H, Input, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import type { Equip, Muscle } from '@/lib/fitness/data';
import { guideOf, searchExercises, type ExerciseX } from '@/lib/fitness/exerciseDb';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useFitness } from '@/store/fitness';

const MUSCLES: Muscle[] = ['gambe', 'glutei', 'petto', 'schiena', 'spalle', 'braccia', 'core', 'corpo intero', 'cardio', 'mobilità'];
const EQUIPS: Equip[] = ['nessuno', 'manubri', 'elastico', 'palestra', 'piscina'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const PAGE = 40;

/**
 * L'elenco di tutti gli esercizi con ricerca e filtri. Toccandone uno si apre la scheda SOPRA l'elenco (la foto si anima, come se la persona si muovesse):
 * chiudendola l'elenco è esattamente com'era, con filtri e posizione.
 */
export function ExerciseBrowser({ onCreate }: { onCreate: () => void }) {
  const t = useTheme();
  const customEx = useFitness((s) => s.customEx);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'tutti'>('tutti');
  const [equip, setEquip] = useState<Equip | 'tutti'>('tutti');
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<ExerciseX | null>(null);
  const all = useMemo(() => searchExercises({ q, muscle, equip }, customEx, 5000), [q, muscle, equip, customEx]);
  const guide = open ? guideOf(open) : null;
  return (
    <View>
      <Input placeholder={tl('Cerca tra {0} esercizi', searchExercises({}, customEx, 9999).length)} value={q} onChangeText={(v) => { setQ(v); setShown(PAGE); }} autoCapitalize="none" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }} contentContainerStyle={{ gap: 6 }}>
        {(['tutti', ...MUSCLES] as const).map((m) => <Pill key={m} label={cap(m)} on={muscle === m} onPress={() => { setMuscle(m); setShown(PAGE); }} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 6 }}>
        {(['tutti', ...EQUIPS] as const).map((m) => <Pill key={m} label={m === 'tutti' ? 'Ogni attrezzo' : cap(m)} on={equip === m} onPress={() => { setEquip(m); setShown(PAGE); }} />)}
      </ScrollView>
      <Body small muted style={{ marginBottom: 4 }}>{tl('{0} esercizi', all.length)}</Body>
      {all.slice(0, shown).map((e) => (
        <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={e.name} onPress={() => setOpen(e)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.border }}>
          <ExerciseThumb ex={e} size={56} />
          <View style={{ flex: 1 }}><Body bold>{e.name}</Body><Body small muted>{cap(e.muscle)} · {cap(e.equip)}{e.custom ? ` · ${tl('tuo')}` : ''}</Body></View>
          <Icon name="chevron" size={16} color={t.muted} />
        </Pressable>
      ))}
      {!all.length ? <Body muted style={{ marginVertical: 10 }}>Nessun esercizio con questi filtri.</Body> : null}
      {all.length > shown ? <Btn style={{ marginTop: 10 }} ghost title={tl('Mostra altri ({0})', all.length - shown)} onPress={() => setShown((n) => n + PAGE)} /> : null}
      <Btn style={{ marginTop: 10 }} ghost icon="plus" title="Non lo trovo: lo creo io" onPress={onCreate} />

      <Sheet visible={!!open} title={open?.name ?? ''} onClose={() => setOpen(null)}>
        {open ? (
          <ScrollView style={{ maxHeight: 560 }} nestedScrollEnabled>
            <ExerciseMedia ex={open} />
            <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }} gap={6}>
              <Pill label={cap(open.muscle)} off /><Pill label={cap(open.equip)} off />{open.level ? <Pill label={cap(open.level)} off /> : null}<Pill label={open.timed ? 'A tempo' : 'A ripetizioni'} off />
            </Row>
            <Body style={{ marginTop: 10 }}>{open.how}</Body>
            {open.en ? <Body small muted style={{ marginTop: 4 }}>Le istruzioni arrivano da un archivio internazionale e sono in inglese.</Body> : null}
            {guide?.cues.length ? (
              <View style={{ marginTop: 10 }}>
                <H style={{ marginBottom: 4 }}>Come farlo bene</H>
                {guide.cues.map((c) => <Row key={c} style={{ justifyContent: 'flex-start', alignItems: 'flex-start', marginBottom: 4 }} gap={8}><Icon name="check" size={15} color={FIT} stroke={2.6} /><Body small style={{ flex: 1 }}>{c}</Body></Row>)}
              </View>
            ) : null}
            <Btn style={{ marginTop: 12 }} ghost title="Controlla la tua esecuzione" onPress={() => { const id = open.id; go('fitnessExercise', { id }); }} />
            <Btn style={{ marginTop: 6 }} title="Chiudi" onPress={() => setOpen(null)} />
          </ScrollView>
        ) : null}
      </Sheet>
    </View>
  );
}

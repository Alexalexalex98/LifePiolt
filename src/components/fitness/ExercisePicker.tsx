import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/T';

import { ExerciseFigure } from '@/components/fitness/ExerciseFigure';
import { ExerciseThumb } from '@/components/fitness/ExercisePhotos';
import { Body, Btn, H, Input, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import type { Equip, Muscle } from '@/lib/fitness/data';
import { makeCustom, searchExercises, type ExerciseX } from '@/lib/fitness/exerciseDb';
import { FAMILIES, FAMILY_IDS } from '@/lib/fitness/poses';
import { saveMediaToDrive } from '@/lib/driveSave';
import { pickNetMediaMany, takeNetPhoto } from '@/lib/netMedia';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

const MUSCLES: Muscle[] = ['gambe', 'glutei', 'petto', 'schiena', 'spalle', 'braccia', 'core', 'corpo intero', 'cardio', 'mobilità'];
const EQUIPS: Equip[] = ['nessuno', 'manubri', 'elastico', 'palestra', 'piscina'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Scegli un esercizio tra tutti quelli dell'archivio (con la dimostrazione) oppure creane uno tuo. */
export function ExercisePicker({ visible, title = 'Scegli l\'esercizio', onClose, onPick }: { visible: boolean; title?: string; onClose: () => void; onPick: (e: ExerciseX) => void }) {
  const t = useTheme();
  const customEx = useFitness((s) => s.customEx);
  const addCustomEx = useFitness((s) => s.addCustomEx);
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'tutti'>('tutti');
  const [equip, setEquip] = useState<Equip | 'tutti'>('tutti');
  const [name, setName] = useState('');
  const [how, setHow] = useState('');
  const [cm, setCm] = useState<Muscle>('core');
  const [ce, setCe] = useState<Equip>('nessuno');
  const [timed, setTimed] = useState(false);
  const [fam, setFam] = useState<string | undefined>(undefined);
  const [photos, setPhotos] = useState<string[]>([]);
  const list = useMemo(() => searchExercises({ q, muscle, equip }, customEx, 60), [q, muscle, equip, customEx]);

  const close = () => { setMode('list'); onClose(); };
  const shoot = async (camera: boolean) => {
    try {
      if (camera) { const m = await takeNetPhoto(); if (m) { saveMediaToDrive({ uri: m.uri, media: 'photo', from: 'Esercizio' }); setPhotos((p) => [...p, m.uri].slice(0, 2)); } }
      else { const l = await pickNetMediaMany(2); l.filter((x) => x.media === 'photo').forEach((x) => saveMediaToDrive({ uri: x.uri, media: 'photo', from: 'Esercizio' })); setPhotos((p) => [...p, ...l.filter((x) => x.media === 'photo').map((x) => x.uri)].slice(0, 2)); }
    } catch (e) { toast(e instanceof Error ? e.message : 'Non riesco ad aprire la fotocamera'); }
  };
  const save = () => {
    const ex = makeCustom({ name, muscle: cm, equip: ce, how, timed, fam, photos }, `u${Date.now().toString(36)}`);
    if (!ex) { toast('Scrivi il nome dell\'esercizio'); return; }
    addCustomEx(ex); toast('Esercizio creato'); setName(''); setHow(''); setFam(undefined); setPhotos([]); setTimed(false); setMode('list'); onPick(ex);
  };

  return (
    <Sheet visible={visible} title={mode === 'list' ? title : 'Crea un esercizio'} onClose={close}>
      {mode === 'list' ? (
        <View>
          <Input placeholder={`Cerca tra ${searchExercises({}, customEx, 9999).length} esercizi`} value={q} onChangeText={setQ} autoCapitalize="none" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }} contentContainerStyle={{ gap: 6 }}>
            {(['tutti', ...MUSCLES] as const).map((m) => <Pill key={m} label={cap(m)} on={muscle === m} onPress={() => setMuscle(m)} />)}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 6 }}>
            {(['tutti', ...EQUIPS] as const).map((m) => <Pill key={m} label={m === 'tutti' ? 'Ogni attrezzo' : cap(m)} on={equip === m} onPress={() => setEquip(m)} />)}
          </ScrollView>
          <ScrollView style={{ maxHeight: 360 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {list.map((e) => (
              <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={e.name} onPress={() => { onPick(e); close(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.border }}>
                <ExerciseThumb ex={e} size={52} />
                <View style={{ flex: 1 }}><Body bold>{e.name}</Body><Body small muted>{cap(e.muscle)} · {cap(e.equip)}{e.custom ? ` · ${tl('tuo')}` : ''}</Body></View>
              </Pressable>
            ))}
            {!list.length ? <Body muted style={{ marginVertical: 10 }}>Nessun esercizio con questi filtri.</Body> : null}
          </ScrollView>
          <Btn style={{ marginTop: 10 }} ghost icon="plus" title="Non lo trovo: lo creo io" onPress={() => { setName(q); setMode('create'); }} />
        </View>
      ) : (
        <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          <Body bold>Nome</Body>
          <Input placeholder="Es. Rematore con zaino" value={name} onChangeText={setName} />
          <Body bold style={{ marginTop: 6 }}>Che muscoli lavora</Body>
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>{MUSCLES.map((m) => <Pill key={m} label={cap(m)} on={cm === m} onPress={() => setCm(m)} />)}</Row>
          <Body bold style={{ marginTop: 8 }}>Attrezzo</Body>
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>{EQUIPS.map((m) => <Pill key={m} label={cap(m)} on={ce === m} onPress={() => setCe(m)} />)}</Row>
          <Body bold style={{ marginTop: 8 }}>Come si misura</Body>
          <Row style={{ justifyContent: 'flex-start' }} gap={6}><Pill label="Ripetizioni" on={!timed} onPress={() => setTimed(false)} /><Pill label="Tempo (secondi)" on={timed} onPress={() => setTimed(true)} /></Row>
          <Body bold style={{ marginTop: 8 }}>Come si esegue (facoltativo)</Body>
          <Input placeholder="Scrivi in poche righe come si fa" value={how} onChangeText={setHow} multiline maxLines={4} />
          <Body bold style={{ marginTop: 8 }}>Foto dell'esecuzione (facoltativo, fino a 2)</Body>
          <Body small muted>Parti dalla foto di partenza e poi quella di arrivo. Se non le metti, scegli sotto un disegno simile.</Body>
          <Row style={{ marginTop: 6 }} gap={8}><Btn small ghost icon="camera" title="Scatta" onPress={() => void shoot(true)} /><Btn small ghost icon="image" title="Galleria" onPress={() => void shoot(false)} />{photos.length ? <Btn small ghost title="Togli le foto" onPress={() => setPhotos([])} /> : null}</Row>
          {photos.length ? <Row style={{ marginTop: 8, justifyContent: 'flex-start' }} gap={8}>{photos.map((u) => <Image key={u} source={{ uri: u }} style={{ width: 90, height: 90, borderRadius: 12 }} contentFit="cover" />)}</Row> : (
            <View style={{ marginTop: 8 }}>
              <Body small muted style={{ marginBottom: 6 }}>Disegno simile:</Body>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {FAMILY_IDS.map((id) => (
                  <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: fam === id }} onPress={() => setFam(fam === id ? undefined : id)} style={{ alignItems: 'center', opacity: fam && fam !== id ? 0.45 : 1 }}>
                    <ExerciseFigure ex={{ fam: id, name: FAMILIES[id].name }} size={64} single captions={false} />
                    <Text style={{ color: t.muted, fontSize: 10.5, width: 70, textAlign: 'center', marginTop: 2 }} numberOfLines={2}>{FAMILIES[id].name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          <Btn style={{ marginTop: 12 }} title="Salva l'esercizio" onPress={save} />
          <Btn style={{ marginTop: 6 }} ghost title="Indietro" onPress={() => setMode('list')} />
          <H style={{ height: 0, marginBottom: 0 }}>{' '}</H>
        </ScrollView>
      )}
    </Sheet>
  );
}

import { useEffect, useMemo, useReducer, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';

import { ExerciseRunner } from '@/components/mascot/ExerciseRunner';
import { Text } from '@/components/T';
import { Body, Btn, Card, H, Input, Item, Page, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { computeDashboard } from '@/lib/analyticsData';
import { go } from '@/lib/nav';
import { narrate, stopNarration } from '@/lib/narrate';
import { ALL_EXERCISES, CATS, LEVEL_LABEL, exerciseById, filterExercises, metaOf, type Cat, type Level } from '@/lib/mindLibrary';
import { recommend, type Reco } from '@/lib/mindRecommend';
import { GROUP_LABEL, SOUNDS, type SoundGroup } from '@/lib/sleepSounds';
import { mixer } from '@/lib/soundMixer';
import type { Answer, Exercise } from '@/lib/mindExercises';
import { useHealth } from '@/store/health';
import { useMindSpace } from '@/store/mindSpace';
import { useVoicePrefs } from '@/store/voicePrefs';
import { deviceVoiceAvailable } from '@/lib/voice/speechEngine';
import { shareDiary } from '@/lib/wellbeing/diaryRun';
import { toast } from '@/store/toast';

type Tab = 'oggi' | 'esercizi' | 'sonno' | 'focus';
const TABS: { id: Tab; label: string }[] = [{ id: 'oggi', label: 'Per te' }, { id: 'esercizi', label: 'Esercizi' }, { id: 'sonno', label: 'Sonno' }, { id: 'focus', label: 'Focus' }];
const MOOD: Record<string, number> = { Felice: 5, Calmo: 4, Neutro: 3, Stressato: 2, Arrabbiato: 2, Triste: 1.5 };
const TIMERS = [15, 30, 60];
/** Playlist su Spotify: si apre la ricerca nell'app o nel browser, gratis (non serve nessun accesso né chiave). */
const PLAYLISTS: { label: string; q: string }[] = [
  { label: 'Concentrazione', q: 'deep focus' }, { label: 'Studio', q: 'study lofi' }, { label: 'Meditazione', q: 'meditation' },
  { label: 'Sonno', q: 'sleep' }, { label: 'Relax', q: 'relax' }, { label: 'Natura', q: 'nature sounds' }, { label: 'Pianoforte calmo', q: 'calm piano' }, { label: 'Allenamento', q: 'workout' },
];
const spotify = (q: string) => { void Linking.openURL(`https://open.spotify.com/search/${encodeURIComponent(q)}/playlists`).catch(() => toast(tl('Non riesco ad aprire Spotify: controlla di averlo installato o apri il sito.'))); };

/** Benessere mentale: meditazioni ed esercizi (oltre 100, anche da ascoltare con la voce di Theia), sonno con suoni e routine, focus, e consigli su misura dai tuoi dati. */
export default function Mindfulness() {
  const th = useTheme();
  const [tab, setTab] = useState<Tab>('oggi');
  const [run, setRun] = useState<Exercise | null>(null);
  const [dDays, setDDays] = useState(30);
  const [dNotes, setDNotes] = useState(false);
  const [playing, setPlaying] = useState<{ id: string; title: string } | null>(null);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const entries = useMindSpace((s) => s.entries);
  const add = useMindSpace((s) => s.add);
  const engine = useVoicePrefs((s) => s.engine);
  const setEngine = useVoicePrefs((s) => s.set);
  useEffect(() => mixer.subscribe(bump), []);
  useEffect(() => () => { stopNarration(); }, []);

  const recos: Reco[] = useMemo(() => {
    let weak: { id: string; why: string }[] = []; let sleepAvg: number | undefined;
    try { weak = computeDashboard().lifeScore.down.slice(0, 3).map((f) => ({ id: f.id, why: tl('Nel tuo Life Score: {0}', f.why) })); } catch { /* senza Life Score */ }
    const h = useHealth.getState();
    const sl = (h.series?.sleep ?? []).slice(-7); if (sl.length) sleepAvg = sl.reduce((a, b) => a + b, 0) / sl.length;
    const lastMood = h.moods?.length ? MOOD[h.moods[h.moods.length - 1]!.mood] : undefined;
    const now = new Date();
    return recommend({ weak, sleepAvg, mood: lastMood, hour: now.getHours(), recent: [...entries].reverse().map((e) => e.ex), seed: now.getFullYear() * 400 + now.getMonth() * 31 + now.getDate() });
  }, [entries]);

  const listen = (ex: Exercise, withSound?: string) => {
    stopNarration();
    if (withSound && !mixer.active().includes(withSound)) void mixer.toggle(withSound);
    setPlaying({ id: ex.id, title: ex.title });
    const r = narrate(ex);
    void r.done.then(() => setPlaying((p) => (p?.id === ex.id ? null : p))).catch(() => { setPlaying(null); toast(tl('La voce non è disponibile adesso: puoi fare l\'esercizio leggendolo.')); });
  };
  const stopListening = () => { stopNarration(); setPlaying(null); };

  const exRow = (ex: Exercise, last: boolean, why?: string) => {
    const m = metaOf(ex.id);
    return (
      <Item key={ex.id} last={last}>
        <Row style={{ alignItems: 'flex-start' }} gap={10}>
          <View style={{ flex: 1 }}>
            <Body bold>{tl(ex.title)}</Body>
            <Body small muted>{`${ex.minutes} min · ${tl(CATS.find((c) => c.id === m.cat)?.label ?? '')} · ${tl(LEVEL_LABEL[m.level])}`}</Body>
            {why ? <Body small color={th.accent}>{why}</Body> : <Body small muted numberOfLines={2}>{tl(ex.why)}</Body>}
          </View>
          <View style={{ gap: 6 }}>
            <Btn small title={tl('Fai')} onPress={() => setRun(ex)} />
            <Btn small ghost title={tl('Ascolta')} onPress={() => listen(ex)} />
          </View>
        </Row>
      </Item>
    );
  };

  return (
    <Page id="mindfulness" title={tl('Benessere mentale')} back>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        {TABS.map((x) => <Pill key={x.id} label={tl(x.label)} on={tab === x.id} onPress={() => setTab(x.id)} />)}
      </ScrollView>
      {playing ? (
        <Card style={{ borderColor: th.accent }}>
          <Row><View style={{ flex: 1 }}><Body bold>{tl('Ti sto accompagnando')}</Body><Body small muted numberOfLines={1}>{tl(playing.title)}</Body></View><Btn small ghost title={tl('Ferma')} onPress={stopListening} /></Row>
        </Card>
      ) : null}

      {tab === 'oggi' ? (
        <>
          <Card>
            <H>{tl('Per te adesso')}</H>
            <Body small muted style={{ marginBottom: 6 }}>{tl('Scelti dai tuoi dati (sonno, umore, tensione) e dall\'ora. Sono proposte: prendi quello che ti va.')}</Body>
            {recos.map((r, i) => { const ex = exerciseById(r.exId); return ex ? exRow(ex, i === recos.length - 1, tl(r.reason)) : null; })}
          </Card>
          <Card>
            <H>{tl('Voce')}</H>
            <Body small muted style={{ marginBottom: 8 }}>{tl('Con quale voce ti leggo gli esercizi e ti rispondo? Quella del telefono è gratis e funziona anche senza internet; Gemini è più naturale ma consuma il tuo piano (le frasi già lette restano salvate e non si pagano di nuovo).')}</Body>
            <Row gap={8} style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              <Pill label={tl('Voce del telefono (gratis)')} on={engine === 'device'} onPress={() => setEngine('device')} />
              <Pill label={tl('Voce Gemini')} on={engine === 'gemini'} onPress={() => setEngine('gemini')} />
            </Row>
            {engine === 'device' && !deviceVoiceAvailable() ? <Body small muted style={{ marginTop: 8 }}>{tl('La voce del telefono non è ancora installata in questa versione: per ora uso Gemini. Aggiorna l\'app (npm install) per attivarla.')}</Body> : null}
          </Card>
          <Card>
            <H>{tl('Diario del benessere')}</H>
            <Body small muted style={{ marginBottom: 8 }}>{tl('Un riepilogo di umore, energia, esercizi e questionari da condividere con uno psicologo, un medico o un nutrizionista. Lo mandi solo tu, a chi vuoi.')}</Body>
            <Row gap={8} style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>{[30, 90, 365].map((n) => <Pill key={n} label={n === 365 ? tl('1 anno') : tl('{0} giorni', n)} on={dDays === n} onPress={() => setDDays(n)} />)}</Row>
            <View style={{ marginTop: 8 }}><Pill label={tl('Includi le note che ho scritto a Theia')} on={dNotes} onPress={() => setDNotes(!dNotes)} /></View>
            <Row gap={8} style={{ justifyContent: 'flex-start', marginTop: 10 }}>
              <Btn small title={tl('Esporta PDF')} onPress={() => void shareDiary('pdf', dDays, dNotes).then((r) => { if (!r.ok && r.message) toast(r.message); })} />
              <Btn small ghost title={tl('Esporta CSV')} onPress={() => void shareDiary('csv', dDays, dNotes).then((r) => { if (!r.ok && r.message) toast(r.message); })} />
            </Row>
          </Card>
          <Card>
            <H>{tl('Il tuo percorso')}</H>
            <Body small muted>{tl('Hai fatto {0} esercizi su {1} disponibili.', new Set(entries.map((e) => e.ex)).size, ALL_EXERCISES.length)}</Body>
            <Row gap={8} style={{ justifyContent: 'flex-start', marginTop: 8 }}>
              <Btn small ghost title={tl('Parla con Theia')} onPress={() => go('ai')} />
              <Btn small ghost title={tl('Come ti senti')} onPress={() => go('mood')} />
            </Row>
          </Card>
        </>
      ) : null}

      {tab === 'esercizi' ? <Library exRow={exRow} /> : null}

      {tab === 'sonno' ? (
        <>
          <Card>
            <H>{tl('Wind Down')}</H>
            <Body small muted style={{ marginBottom: 8 }}>{tl('Una routine lenta per prepararti a dormire, con musica dolce.')}</Body>
            <Btn title={tl('Inizia Wind Down')} onPress={() => { const e = exerciseById('s-winddown'); if (e) listen(e, SOUNDS.find((x) => x.group === 'musica')?.id); mixer.setTimer(30); }} />
          </Card>
          <Card style={{ borderColor: th.accent }}>
            <H>{tl('SOS notturno')}</H>
            <Body small muted style={{ marginBottom: 8 }}>{tl('Ti sei svegliato e ti agiti? Niente luce, niente ora: ti accompagno a calmarti.')}</Body>
            <Btn title={tl('Mi sono svegliato')} onPress={() => { const e = exerciseById('s-sos'); if (e) listen(e, SOUNDS.find((x) => x.group === 'natura')?.id ?? SOUNDS.find((x) => x.group === 'rumori')?.id); mixer.setTimer(30); }} />
          </Card>
          <Sounds th={th} groups={['natura', 'rumori', 'musica', 'meditazione']} />
          <Card>
            <H>{tl('Esercizi per dormire')}</H>
            {filterExercises({ cat: 'sonno' }).map((e, i, a) => exRow(e, i === a.length - 1))}
          </Card>
        </>
      ) : null}

      {tab === 'focus' ? (
        <>
          <Sounds th={th} groups={['focus', 'rumori', 'musica', 'natura']} title={tl('Suoni per concentrarti')} />
          <Card>
            <H>{tl('Playlist su Spotify')}</H>
            <Body small muted style={{ marginBottom: 8 }}>{tl('Ti porto alla ricerca su Spotify, gratis: scegli la playlist che preferisci.')}</Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{PLAYLISTS.map((p) => <Pill key={p.q} label={tl(p.label)} onPress={() => spotify(p.q)} />)}</View>
          </Card>
          <Card>
            <H>{tl('Esercizi di concentrazione')}</H>
            {filterExercises({ cat: 'focus' }).map((e, i, a) => exRow(e, i === a.length - 1))}
            <Btn ghost small style={{ marginTop: 8 }} title={tl('Timer di concentrazione su un task')} onPress={() => go('lifetask')} />
          </Card>
        </>
      ) : null}

      <ExerciseRunner ex={run} onClose={() => setRun(null)} onSave={(answers: Record<string, Answer>) => { if (run) { add(run.id, answers); toast(tl('Salvato nel diario')); } }} />
    </Page>
  );
}

function Library({ exRow }: { exRow: (ex: Exercise, last: boolean) => React.ReactNode }) {
  const [cat, setCat] = useState<Cat | 'tutti'>('tutti');
  const [level, setLevel] = useState<Level | 'tutti'>('tutti');
  const [q, setQ] = useState('');
  const list = filterExercises({ cat, level, q });
  return (
    <>
      <Input value={q} onChangeText={setQ} placeholder={tl('Cerca un esercizio')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        <Pill label={tl('Tutti')} on={cat === 'tutti'} onPress={() => setCat('tutti')} />
        {CATS.map((c) => <Pill key={c.id} label={tl(c.label)} on={cat === c.id} onPress={() => setCat(c.id)} />)}
      </ScrollView>
      <Row gap={8} style={{ justifyContent: 'flex-start' }}>
        {(['tutti', 'base', 'medio', 'avanzato'] as const).map((l) => <Pill key={l} label={l === 'tutti' ? tl('Ogni livello') : tl(LEVEL_LABEL[l])} on={level === l} onPress={() => setLevel(l)} />)}
      </Row>
      <Card>
        <Body small muted style={{ marginBottom: 4 }}>{tl('{0} esercizi', list.length)}</Body>
        {list.map((e, i) => exRow(e, i === list.length - 1))}
      </Card>
    </>
  );
}

function Sounds({ th, groups, title }: { th: ReturnType<typeof useTheme>; groups: SoundGroup[]; title?: string }) {
  const [all, setAll] = useState<Record<string, boolean>>({});
  const active = mixer.active();
  const end = mixer.endsAt();
  const left = end ? Math.max(0, Math.round((end - Date.now()) / 60000)) : 0;
  return (
    <Card>
      <H>{title ?? tl('Suoni')}</H>
      <Body small muted style={{ marginBottom: 8 }}>{tl('Puoi mescolarne fino a tre. Funzionano anche senza internet.')}</Body>
      {SOUNDS.length === 0 ? <Body small muted>{tl('Ancora nessun suono: aggiungili in assets/sounds (vedi LEGGIMI.md).')}</Body> : null}
      {groups.filter((g) => SOUNDS.some((s) => s.group === g)).map((g) => (
        <View key={g} style={{ marginBottom: 8 }}>
          <Text style={{ color: th.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{tl(GROUP_LABEL[g])}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {SOUNDS.filter((s, i, a) => s.group === g && (all[g] || active.includes(s.id) || a.filter((x) => x.group === g).indexOf(s) < 8)).map((s) => <Pill key={s.id} label={tl(s.label)} on={active.includes(s.id)} onPress={() => void mixer.toggle(s.id)} />)}
            {SOUNDS.filter((s) => s.group === g).length > 8 ? <Pill label={all[g] ? tl('Meno') : tl('Mostra tutti ({0})', SOUNDS.filter((s) => s.group === g).length)} onPress={() => setAll((x) => ({ ...x, [g]: !x[g] }))} /> : null}
          </View>
        </View>
      ))}
      <Row gap={8} style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 4 }}>
        <Body small muted>{end ? tl('Si spegne tra {0} min', left) : tl('Spegni dopo')}</Body>
        {TIMERS.map((m) => <Pill key={m} label={`${m} min`} onPress={() => mixer.setTimer(m)} />)}
        {active.length ? <Btn small ghost title={tl('Ferma tutto')} onPress={() => mixer.stopAll()} /> : null}
      </Row>
    </Card>
  );
}

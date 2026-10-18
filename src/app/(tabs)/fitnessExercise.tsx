import { FIT, FitHero } from '@/components/fitness/kit';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { ExerciseFigure } from '@/components/fitness/ExerciseFigure';
import { Body, Btn, Card, H, Page, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { routeRequest } from '@/lib/aiRouter';
import { aiReadFiles, aiServerConfigured, AiServerError } from '@/lib/aiServer';
import { AiNote } from '@/components/AiNote';
import { checkPrompt, frameTimes, parseCheck, type CheckResult } from '@/lib/fitness/execCheck';
import { exById, guideOf } from '@/lib/fitness/exerciseDb';
import { hasPremiumFeature } from '@/lib/premiumApp';
import { Icon } from '@/lib/icons';
import { go, goBack } from '@/lib/nav';
import { pickNetMedia, takeNetVideo, type NetMedia } from '@/lib/netMedia';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const VERDICT: Record<CheckResult['verdict'], { label: string; tone: 'positive' | 'warn' | 'muted' }> = {
  ok: { label: 'Esecuzione corretta', tone: 'positive' }, quasi: { label: 'Quasi corretta', tone: 'warn' }, correggere: { label: 'Da correggere', tone: 'warn' }, incerto: { label: 'Non si vede abbastanza', tone: 'muted' },
};

function Clip({ uri }: { uri: string }) {
  const p = useVideoPlayer(uri, (pl) => { pl.loop = true; pl.muted = true; pl.play(); });
  return <VideoView player={p} style={{ width: '100%', height: 280, borderRadius: 14, backgroundColor: '#000' }} nativeControls contentFit="contain" />;
}

/** Dettaglio di un esercizio: dimostrazione, punti chiave, errori comuni e controllo dell'esecuzione dal tuo video. */
export default function FitnessExercise() {
  const t = useTheme();
  const { id, check } = useLocalSearchParams<{ id?: string; check?: string }>();
  const fit = useFitness();
  const ex = exById(id ?? '', fit.customEx);
  const guide = guideOf(ex);
  const [clip, setClip] = useState<NetMedia | null>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ r?: CheckResult; note?: string } | null>(null);
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const access = hasPremiumFeature('exercise-check');

  if (!ex) return <Page id="fitnessExercise" back title="Esercizio"><Card><Body muted>Esercizio non trovato.</Body></Card></Page>;

  const record = async (camera: boolean) => {
    try {
      const m = camera ? await takeNetVideo(30) : await pickNetMedia('video');
      if (m && m.media === 'video') { setClip(m); setRes(null); setTicks({}); }
    } catch (e) { toast(e instanceof Error ? e.message : 'Non riesco ad aprire la fotocamera'); }
  };
  const ask = async () => {
    if (!clip || busy) return;
    setBusy(true); setRes(null);
    try {
      const times = frameTimes(clip.durationMs);
      const frames: { uri: string; mime: string }[] = [];
      for (const ms of times) { try { const f = await VideoThumbnails.getThumbnailAsync(clip.uri, { time: ms, quality: 0.6 }); frames.push({ uri: f.uri, mime: 'image/jpeg' }); } catch { /* si prosegue con quelli riusciti */ } }
      if (frames.length < 3) { setRes({ note: tl('Non riesco a estrarre i fotogrammi da questo video. Prova a riprenderlo.') }); return; }
      let reply = '';
      if (aiServerConfigured) reply = await aiReadFiles(checkPrompt(ex), frames);
      else {
        const out = await routeRequest({ text: checkPrompt(ex), lang: 'it', source: 'typed', images: frames });
        if (out.status !== 'answered' || !out.text) { setRes({ note: out.message }); return; }
        reply = out.text;
      }
      setRes({ r: parseCheck(reply) });
    } catch (e) { setRes({ note: e instanceof AiServerError ? e.message : tl('Non sono riuscito a contattare il servizio di analisi.') }); }
    finally { setBusy(false); }
  };
  const ok = guide.cues.filter((c) => ticks[c]).length;

  return (
    <Page id="fitnessExercise" back title={ex.name}>
      <FitHero eyebrow={`${cap(ex.muscle)} · ${cap(ex.equip)}${ex.custom ? ` · ${tl('tuo')}` : ''}`} title={ex.name} sub={ex.timed ? 'A tempo' : 'A ripetizioni'} />
      <Card>
        <View style={{ alignItems: 'center', marginBottom: 8 }}><ExerciseFigure ex={ex} size={150} /></View>
        <Body>{ex.how}</Body>
        <Body small muted style={{ marginTop: 6 }}>Le immagini sono disegni di partenza e arrivo: servono a capire il movimento.</Body>
      </Card>
      {guide.cues.length ? (
        <Card>
          <H style={{ marginBottom: 4 }}>Come farlo bene</H>
          {guide.cues.map((c) => <Row key={c} style={{ justifyContent: 'flex-start', alignItems: 'flex-start', marginBottom: 4 }} gap={8}><Icon name="check" size={15} color={FIT} stroke={2.6} /><Body small style={{ flex: 1 }}>{c}</Body></Row>)}
          <H style={{ marginTop: 10, marginBottom: 4 }}>Errori comuni</H>
          {guide.mistakes.map((c) => <Row key={c} style={{ justifyContent: 'flex-start', alignItems: 'flex-start', marginBottom: 4 }} gap={8}><Icon name="x" size={15} color={t.warn} stroke={2.4} /><Body small style={{ flex: 1 }}>{c}</Body></Row>)}
        </Card>
      ) : null}
      <Card accent={FIT}>
        <H style={{ marginBottom: 2 }}>Controlla la tua esecuzione</H>
        <Body small muted>Filmati mentre fai l'esercizio (di lato o in diagonale, tutto il corpo nell'inquadratura). Puoi riguardarti con la lista dei punti chiave oppure far guardare il video a Theia.</Body>
        <Row style={{ marginTop: 8 }} gap={8}><Btn small icon="video" title="Filma ora" onPress={() => void record(true)} /><Btn small ghost icon="image" title="Scegli un video" onPress={() => void record(false)} />{check && !clip ? <Pill label="Parti da qui" off /> : null}</Row>
        {clip ? (
          <View style={{ marginTop: 10 }}>
            <Clip uri={clip.uri} />
            <H style={{ marginTop: 12, marginBottom: 4 }}>Riguardati: spunta quello che fai bene</H>
            {guide.cues.map((c) => (
              <Pressable key={c} accessibilityRole="checkbox" accessibilityState={{ checked: !!ticks[c] }} onPress={() => setTicks((x) => ({ ...x, [c]: !x[c] }))} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 5 }}>
                <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: ticks[c] ? FIT : t.border, backgroundColor: ticks[c] ? FIT : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{ticks[c] ? <Icon name="check" size={14} color="#1c0b04" stroke={3} /> : null}</View>
                <Body small style={{ flex: 1 }}>{c}</Body>
              </Pressable>
            ))}
            {guide.cues.length ? <Body small bold style={{ marginTop: 4 }}>{tl('{0} punti su {1}', ok, guide.cues.length)}</Body> : null}
            <View style={{ marginTop: 12 }}>
              {access ? <Btn icon="sparkle" title={busy ? 'Theia guarda il video…' : 'Chiedi a Theia'} disabled={busy} onPress={() => void ask()} />
                : <Body small muted>Il controllo dal video è una funzione Premium di LifePilot.</Body>}
            </View>
          </View>
        ) : null}
        {res ? (
          <View style={{ marginTop: 12, borderRadius: 14, padding: 12, backgroundColor: t.chip }}>
            {res.r ? <AiNote /> : null}
            {res.r ? (
              <>
                <Body bold color={VERDICT[res.r.verdict].tone === 'positive' ? t.positive : VERDICT[res.r.verdict].tone === 'warn' ? t.warn : t.muted}>{tl(VERDICT[res.r.verdict].label)}</Body>
                {res.r.good.length ? <><Body small bold style={{ marginTop: 8 }}>Va bene</Body>{res.r.good.map((x) => <Body key={x} small>• {x}</Body>)}</> : null}
                {res.r.fix.length ? <><Body small bold style={{ marginTop: 8 }}>Da correggere</Body>{res.r.fix.map((x) => <Body key={x} small>• {x}</Body>)}</> : null}
                {!res.r.good.length && !res.r.fix.length ? <Body small style={{ marginTop: 6 }}>{res.r.raw}</Body> : null}
                <Body small muted style={{ marginTop: 8 }}>È una valutazione automatica da pochi fotogrammi: non sostituisce un allenatore e non è un parere medico.</Body>
              </>
            ) : <Body small>{res.note}</Body>}
          </View>
        ) : null}
      </Card>
      {ex.custom ? <Btn ghost danger title="Elimina questo esercizio" onPress={() => { fit.delCustomEx(ex.id); toast('Esercizio eliminato'); goBack(); }} /> : null}
    </Page>
  );
}

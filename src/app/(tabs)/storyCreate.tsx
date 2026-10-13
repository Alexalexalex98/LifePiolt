import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, TextInput, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Card, Input, Page, Pill, Row, Seg } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { goBack } from '@/lib/nav';
import { pickNetMedia, type NetMedia } from '@/lib/netMedia';
import { BACKGROUNDS, KEEP_LABEL, MAX_STORY_TEXT, makeStory, type Keep, type StoryAttach } from '@/lib/stories';
import { useLife } from '@/store/life';
import { dayKey } from '@/lib/format';
import { addDaysIso } from '@/lib/calendarMap';
import { useApp } from '@/store/app';
import { newId, useNet } from '@/store/network';
import { toast } from '@/store/toast';

/** Nuova storia: foto o video dalla libreria, oppure solo testo su uno sfondo colorato. Dura 24 ore. */
export default function StoryCreate() {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const net = useNet();
  const [mode, setMode] = useState<'Foto o video' | 'Testo'>('Foto o video');
  const [media, setMedia] = useState<NetMedia | null>(null);
  const [text, setText] = useState('');
  const [bg, setBg] = useState(0);
  const [busy, setBusy] = useState(false);
  const [keep, setKeep] = useState<Keep>('day');
  const [attach, setAttach] = useState<StoryAttach | null>(null);
  const [place, setPlace] = useState('');
  const [attachKind, setAttachKind] = useState<'none' | 'event' | 'seminar' | 'idea' | 'place'>('none');
  const events = useLife((s) => s.events);
  const today = dayKey();
  const nextEvents = Array.from({ length: 7 }, (_, i) => addDaysIso(today, i)).flatMap((d) => (events[d] ?? []).map((e) => ({ day: d, label: `${e.title} · ${e.time}` }))).slice(0, 8);
  const mySeminars = net.seminars.filter((x) => x.host === me).slice(0, 6);
  const myIdeas = net.ideas.filter((x) => x.author === me).slice(0, 6);
  const w = Math.min(useWindowDimensions().width - 32, 300);
  const h = w * 16 / 9;

  async function pick(kind: 'photo' | 'video') {
    if (busy) return;
    setBusy(true);
    try { const m = await pickNetMedia(kind); if (m) setMedia(m); } catch (e) { toast(e instanceof Error ? e.message : 'Non riesco ad aprire la libreria'); } finally { setBusy(false); }
  }
  function publish() {
    const s = makeStory(mode === 'Testo'
      ? { id: newId() + '', author: me, now: Date.now(), kind: 'text', text, bg: BACKGROUNDS[bg], keep, attach: attach ?? undefined }
      : { id: newId() + '', author: me, now: Date.now(), kind: media?.media ?? 'photo', uri: media?.uri, text, keep, attach: attach ?? undefined });
    if (!s) { toast(mode === 'Testo' ? 'Scrivi qualcosa per la storia' : 'Scegli prima una foto o un video'); return; }
    net.patch({ stories: [...(net.stories ?? []), s] });
    toast('Storia pubblicata · resta 24 ore');
    goBack();
  }
  return (
    <Page id="storyCreate" back title="Nuovo momento">
      <Seg options={['Foto o video', 'Testo']} value={mode} onChange={(v) => setMode(v as typeof mode)} />
      <View style={{ alignItems: 'center' }}>
        {mode === 'Testo' ? (
          <LinearGradient colors={BACKGROUNDS[bg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: w, height: h, borderRadius: 18, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <TextInput value={text} onChangeText={setText} multiline maxLength={MAX_STORY_TEXT} placeholder={tl('Scrivi qui')} placeholderTextColor="rgba(255,255,255,0.6)" accessibilityLabel={tl('Testo della storia')} style={{ color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center', width: '100%' }} />
          </LinearGradient>
        ) : (
          <View style={{ width: w, height: h, borderRadius: 18, overflow: 'hidden', backgroundColor: t.input, alignItems: 'center', justifyContent: 'center' }}>
            {media ? (media.media === 'photo' ? <Image source={{ uri: media.uri }} style={{ width: w, height: h }} contentFit="cover" /> : <Body bold>{tl('Video scelto')}</Body>) : <Body muted>{tl('Nessuna foto scelta')}</Body>}
            {media && text ? <Text style={{ position: 'absolute', bottom: 16, start: 12, end: 12, color: '#fff', fontWeight: '800', fontSize: 18, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 }}>{text}</Text> : null}
          </View>
        )}
      </View>
      {mode === 'Testo' ? (
        <Row style={{ justifyContent: 'center', marginTop: 12 }} gap={10}>
          {BACKGROUNDS.map((c, i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={tl('Sfondo {0}', i + 1)} accessibilityState={{ selected: bg === i }} onPress={() => setBg(i)} style={{ width: 34, height: 34, borderRadius: 17, overflow: 'hidden', borderWidth: bg === i ? 3 : 1, borderColor: bg === i ? t.text : t.border }}><LinearGradient colors={c} style={{ flex: 1 }} /></Pressable>)}
        </Row>
      ) : (
        <>
          <Row style={{ justifyContent: 'center', marginTop: 12 }} gap={8}>
            <Btn small ghost icon="image" title="Scegli una foto" disabled={busy} onPress={() => void pick('photo')} />
            <Btn small ghost icon="video" title="Scegli un video" disabled={busy} onPress={() => void pick('video')} />
          </Row>
          <TextInput value={text} onChangeText={setText} maxLength={MAX_STORY_TEXT} placeholder={tl('Aggiungi una scritta (facoltativa)')} placeholderTextColor={t.muted} accessibilityLabel={tl('Scritta sulla storia')} style={{ color: t.text, backgroundColor: t.input, borderRadius: 12, padding: 12, marginTop: 12 }} />
        </>
      )}
      <Body bold style={{ marginTop: 16, marginBottom: 6 }}>Quanto resta</Body>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
        {(['day', 'week', 'moment'] as Keep[]).map((k) => <Pill key={k} label={KEEP_LABEL[k]} on={keep === k} onPress={() => setKeep(k)} />)}
      </Row>
      <Body small muted style={{ marginTop: 4 }}>{keep === 'moment' ? 'Resta nel tuo profilo finché non lo cancelli.' : keep === 'week' ? 'Resta visibile per una settimana.' : 'Sparisce da solo dopo un giorno.'}</Body>
      <Body bold style={{ marginTop: 14, marginBottom: 6 }}>Collega qualcosa (facoltativo)</Body>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
        {([['none', 'Niente'], ['event', 'Un impegno'], ['seminar', 'Un mio seminario'], ['idea', 'Una mia idea'], ['place', 'Un luogo']] as const).map(([k, l]) => <Pill key={k} label={l} on={attachKind === k} onPress={() => { setAttachKind(k); setAttach(null); }} />)}
      </Row>
      {attachKind === 'event' ? (nextEvents.length ? nextEvents.map((e) => <Pill key={e.day + e.label} label={e.label} on={attach?.ref === e.day && attach.label === e.label} onPress={() => setAttach({ kind: 'event', label: e.label, ref: e.day })} />) : <Body small muted>Nessun impegno nei prossimi 7 giorni.</Body>) : null}
      {attachKind === 'seminar' ? (mySeminars.length ? mySeminars.map((x) => <Pill key={x.id} label={x.title} on={attach?.ref === String(x.id)} onPress={() => setAttach({ kind: 'seminar', label: x.title, ref: String(x.id) })} />) : <Body small muted>Non hai seminari pubblicati.</Body>) : null}
      {attachKind === 'idea' ? (myIdeas.length ? myIdeas.map((x) => <Pill key={x.id} label={x.title} on={attach?.ref === String(x.id)} onPress={() => setAttach({ kind: 'idea', label: x.title, ref: String(x.id) })} />) : <Body small muted>Non hai idee pubblicate.</Body>) : null}
      {attachKind === 'place' ? <Input value={place} onChangeText={(v) => { setPlace(v); setAttach(v.trim() ? { kind: 'place', label: v.trim() } : null); }} placeholder="Es. Parco Ciani, Lugano" maxLength={60} /> : null}
      <Card style={{ marginTop: 14 }}>
        <Body small muted>La storia resta visibile 24 ore a chi ti segue, poi sparisce da sola. Tu vedi chi l’ha guardata e puoi cancellarla quando vuoi.</Body>
      </Card>
      <Btn style={{ marginTop: 12 }} title="Pubblica il momento" onPress={publish} />
    </Page>
  );
}

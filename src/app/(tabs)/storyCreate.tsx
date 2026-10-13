import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/T';

import { Body, Btn, Input, Pill, Row, Sheet } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { addDaysIso } from '@/lib/calendarMap';
import { dayKey } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { goBack } from '@/lib/nav';
import { pickNetMediaMany, takeNetPhoto, type NetMedia } from '@/lib/netMedia';
import { BACKGROUNDS, FILTERS, KEEP_LABEL, MAX_STORY_TEXT, makeStory, tintOfFilter, type FilterId, type Keep, type StoryAttach, type TextPos } from '@/lib/stories';
import { useApp } from '@/store/app';
import { useLife } from '@/store/life';
import { newId, useNet } from '@/store/network';
import { toast } from '@/store/toast';

const INKS = ['#ffffff', '#ffd166', '#ff5d8f', '#6cf0c2', '#7aa2ff', '#111111'];
const POS: TextPos[] = ['alto', 'centro', 'basso'];
const buzz = () => { if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined); };

/** Aggiungere al recap: scegli come (galleria, fotocamera, testo), poi ritocca con filtri e scritta e pubblica. Tutto in una schermata. */
export default function StoryCreate() {
  const me = useApp((s) => s.account.name);
  const net = useNet();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [items, setItems] = useState<NetMedia[]>([]);
  const [textMode, setTextMode] = useState(false);
  const [text, setText] = useState('');
  const [bg, setBg] = useState(0);
  const [filter, setFilter] = useState<FilterId>('none');
  const [pos, setPos] = useState<TextPos>('basso');
  const [ink, setInk] = useState('#ffffff');
  const [keep, setKeep] = useState<Keep>('day');
  const [attach, setAttach] = useState<StoryAttach | null>(null);
  const [cur, setCur] = useState(0);
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState(false);
  const [opts, setOpts] = useState(false);
  const [attachKind, setAttachKind] = useState<'none' | 'event' | 'seminar' | 'idea' | 'place'>('none');
  const [place, setPlace] = useState('');
  const events = useLife((s) => s.events);
  const today = dayKey();
  const nextEvents = Array.from({ length: 7 }, (_, i) => addDaysIso(today, i)).flatMap((d) => (events[d] ?? []).map((e) => ({ day: d, label: `${e.title} · ${e.time}` }))).slice(0, 8);
  const mySeminars = net.seminars.filter((x) => x.host === me).slice(0, 6);
  const myIdeas = net.ideas.filter((x) => x.author === me).slice(0, 6);
  const composing = textMode || items.length > 0;

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { toast(e instanceof Error ? e.message : 'Non riesco ad aprire la libreria'); } finally { setBusy(false); }
  }
  const fromGallery = () => run(async () => { const m = await pickNetMediaMany(6); if (m.length) { setItems(m); setCur(0); buzz(); } });
  const fromCamera = () => run(async () => { const m = await takeNetPhoto(); if (m) { setItems((x) => [...x, m].slice(0, 6)); setCur(items.length); buzz(); } });
  const reset = () => { setItems([]); setTextMode(false); setText(''); setFilter('none'); setFilters(false); };

  function publish() {
    const base = { author: me, now: Date.now(), text, keep, attach: attach ?? undefined, filter, textPos: pos, textColor: ink };
    const made = textMode
      ? [makeStory({ ...base, id: String(newId()), kind: 'text', bg: BACKGROUNDS[bg] })]
      : items.map((m, i) => makeStory({ ...base, id: String(newId()) + i, now: base.now + i, kind: m.media, uri: m.uri, text: i === 0 ? text : '' }));
    const ok = made.filter((x): x is NonNullable<typeof x> => !!x);
    if (!ok.length) { toast(textMode ? 'Scrivi qualcosa per il recap' : 'Scegli prima una foto o un video'); return; }
    net.patch({ stories: [...(net.stories ?? []), ...ok] });
    buzz();
    toast(ok.length > 1 ? tl('{0} momenti aggiunti al recap', ok.length) : 'Aggiunto al recap');
    goBack();
  }

  /* ---------- 1. come vuoi iniziare ---------- */
  if (!composing) {
    const tile = (icon: string, label: string, sub: string, colors: [string, string], onPress: () => void, rot: string) => (
      <Pressable key={label} accessibilityRole="button" accessibilityLabel={`${label}. ${sub}`} onPress={onPress} disabled={busy} style={({ pressed }) => ({ width: (width - 56) / 2, transform: [{ rotate: rot }, { scale: pressed ? 0.96 : 1 }] })}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 170, borderRadius: 26, padding: 16, justifyContent: 'space-between' }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>{icon === 'Aa' ? <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>Aa</Text> : <Icon name={icon as never} size={24} color="#fff" />}</View>
          <View><Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>{label}</Text><Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12.5, marginTop: 2 }}>{sub}</Text></View>
        </LinearGradient>
      </Pressable>
    );
    return (
      <View style={{ flex: 1, backgroundColor: '#07080d' }}>
        <LinearGradient colors={['#2a1458', '#07080d']} style={{ position: 'absolute', top: 0, start: 0, end: 0, height: height * 0.5 }} />
        <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Chiudi')} onPress={goBack} hitSlop={12} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={20} color="#fff" /></Pressable>
        </View>
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <Text style={{ color: '#fff', fontSize: 38, fontWeight: '900', letterSpacing: -1 }}>{tl('Cosa stai')}</Text>
          <Text style={{ color: '#b9a3ff', fontSize: 38, fontWeight: '900', letterSpacing: -1 }}>{tl('combinando?')}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, marginTop: 8 }}>{tl('Aggiungi un momento al tuo recap.')}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingHorizontal: 20, marginTop: 28 }}>
          {tile('image', tl('Galleria'), tl('Foto e video, anche più insieme'), ['#7b5cff', '#c13fd6'], () => void fromGallery(), '-2deg')}
          {tile('camera', tl('Fotocamera'), tl('Scatta adesso'), ['#ff7a59', '#ff2d87'], () => void fromCamera(), '2deg')}
          {tile('Aa', tl('Solo testo'), tl('Una frase su un colore'), ['#16c79a', '#1f7ae0'], () => { setTextMode(true); buzz(); }, '1.5deg')}
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center', marginTop: 'auto', paddingBottom: insets.bottom + 18, paddingHorizontal: 30 }}>{tl('Il momento resta nel recap per 24 ore, se non scegli altro. Lo vede chi ti segue.')}</Text>
      </View>
    );
  }

  /* ---------- 2. ritocca e pubblica ---------- */
  const tint = tintOfFilter(filter);
  // l'anteprima sta tra la barra in alto, i filtri/il pulsante in basso e la colonna degli strumenti a destra
  const maxH = height - insets.top - insets.bottom - (filters && !textMode ? 100 : 20) - 150;
  const previewW = Math.min((width - 90), maxH * 9 / 16);
  const previewH = previewW * 16 / 9;
  const place$ = pos === 'alto' ? { top: 28 } : pos === 'centro' ? { top: previewH / 2 - 30 } : { bottom: 40 };
  const rail = (icon: string, label: string, onPress: () => void, on?: boolean, extra?: string) => (
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!on }} onPress={() => { buzz(); onPress(); }} style={{ alignItems: 'center', gap: 3 }}>
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
        {icon === 'Aa' ? <Text style={{ color: on ? '#111' : '#fff', fontWeight: '900', fontSize: 16 }}>Aa</Text> : <Icon name={icon as never} size={21} color={on ? '#111' : '#fff'} />}
      </View>
      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10.5, fontWeight: '700' }}>{extra ?? label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flex: 1, backgroundColor: '#07080d' }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Ricomincia')} onPress={reset} hitSlop={12} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}><Icon name="arrow-left" size={20} color="#fff" /></Pressable>
        {items.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 10 }} style={{ flex: 1 }}>
            {items.map((m, i) => (
              <Pressable key={m.uri + i} accessibilityRole="button" accessibilityLabel={tl('Momento {0}', i + 1)} onPress={() => setCur(i)} style={{ width: 34, height: 46, borderRadius: 9, overflow: 'hidden', borderWidth: i === cur ? 2 : 0, borderColor: '#fff', opacity: i === cur ? 1 : 0.6 }}>
                {m.media === 'photo' ? <Image source={{ uri: m.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <View style={{ flex: 1, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={12} color="#fff" /></View>}
              </Pressable>
            ))}
          </ScrollView>
        ) : <View style={{ flex: 1 }} />}
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Chiudi')} onPress={goBack} hitSlop={12} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={20} color="#fff" /></Pressable>
      </View>

      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <View style={{ width: previewW, height: previewH, borderRadius: 26, overflow: 'hidden', backgroundColor: '#111' }}>
          {textMode
            ? <LinearGradient colors={BACKGROUNDS[bg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} />
            : items[cur]?.media === 'photo' ? <Image source={{ uri: items[cur].uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={44} color="#fff" /><Text style={{ color: '#fff', marginTop: 8, fontWeight: '700' }}>{tl('Video')}</Text></View>}
          {tint ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: tint }} /> : null}
          <View style={[{ position: 'absolute', start: 14, end: 14 }, textMode ? { top: previewH / 2 - 40 } : place$]}>
            <TextInput value={text} onChangeText={setText} multiline maxLength={MAX_STORY_TEXT} placeholder={tl(textMode ? 'Scrivi qui' : 'Aggiungi una scritta')} placeholderTextColor="rgba(255,255,255,0.6)" accessibilityLabel={tl('Scritta sul momento')}
              style={{ color: ink, fontSize: textMode ? 28 : 22, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } }} />
          </View>
        </View>
        <View style={{ gap: 14 }}>
          {rail('Aa', tl('Posizione'), () => setPos(POS[(POS.indexOf(pos) + 1) % 3]), false, tl(pos === 'alto' ? 'Alto' : pos === 'centro' ? 'Centro' : 'Basso'))}
          {rail('edit', tl('Colore'), () => setInk(INKS[(INKS.indexOf(ink) + 1) % INKS.length]), false, tl('Colore'))}
          {textMode ? rail('grid', tl('Sfondo'), () => setBg((bg + 1) % BACKGROUNDS.length), false, tl('Sfondo')) : rail('sparkle', tl('Filtri'), () => setFilters((v) => !v), filters, tl('Filtri'))}
          {rail('clock', tl('Opzioni'), () => setOpts(true), !!attach || keep !== 'day', keep === 'day' ? '24 ore' : keep === 'week' ? '7 giorni' : tl('Fisso'))}
        </View>
      </View>

      {filters && !textMode ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 10 }} style={{ flexGrow: 0 }}>
          {FILTERS.map((f) => (
            <Pressable key={f.id} accessibilityRole="button" accessibilityState={{ selected: filter === f.id }} accessibilityLabel={tl(f.label)} onPress={() => { buzz(); setFilter(f.id); }} style={{ alignItems: 'center', gap: 4 }}>
              <View style={{ width: 54, height: 72, borderRadius: 14, overflow: 'hidden', borderWidth: filter === f.id ? 2.5 : 0, borderColor: '#fff', backgroundColor: '#222' }}>
                {items[cur]?.media === 'photo' ? <Image source={{ uri: items[cur].uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : null}
                {f.tint ? <View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: f.tint }} /> : null}
              </View>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: filter === f.id ? '800' : '500' }}>{tl(f.label)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Aggiungi al recap')} onPress={publish} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
          <LinearGradient colors={['#7b5cff', '#ff2d87']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Icon name="plus" size={22} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>{items.length > 1 ? tl('Aggiungi {0} momenti', items.length) : tl('Aggiungi al recap')}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <Sheet visible={opts} title="Opzioni del momento" onClose={() => setOpts(false)}>
        <Body bold style={{ marginBottom: 6 }}>Quanto resta</Body>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
          {(['day', 'week', 'moment'] as Keep[]).map((k) => <Pill key={k} label={KEEP_LABEL[k]} on={keep === k} onPress={() => setKeep(k)} />)}
        </Row>
        <Body small muted style={{ marginTop: 4 }}>{keep === 'moment' ? 'Resta nel tuo profilo finché non lo cancelli.' : keep === 'week' ? 'Resta visibile per una settimana.' : 'Sparisce da solo dopo un giorno.'}</Body>
        <Body bold style={{ marginTop: 14, marginBottom: 6 }}>Collega qualcosa</Body>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
          {([['none', 'Niente'], ['event', 'Un impegno'], ['seminar', 'Un mio seminario'], ['idea', 'Una mia idea'], ['place', 'Un luogo']] as const).map(([k, l]) => <Pill key={k} label={l} on={attachKind === k} onPress={() => { setAttachKind(k); setAttach(null); }} />)}
        </Row>
        {attachKind === 'event' ? (nextEvents.length ? nextEvents.map((e) => <Pill key={e.day + e.label} label={e.label} on={attach?.ref === e.day && attach.label === e.label} onPress={() => setAttach({ kind: 'event', label: e.label, ref: e.day })} />) : <Body small muted>Nessun impegno nei prossimi 7 giorni.</Body>) : null}
        {attachKind === 'seminar' ? (mySeminars.length ? mySeminars.map((x) => <Pill key={x.id} label={x.title} on={attach?.ref === String(x.id)} onPress={() => setAttach({ kind: 'seminar', label: x.title, ref: String(x.id) })} />) : <Body small muted>Non hai seminari pubblicati.</Body>) : null}
        {attachKind === 'idea' ? (myIdeas.length ? myIdeas.map((x) => <Pill key={x.id} label={x.title} on={attach?.ref === String(x.id)} onPress={() => setAttach({ kind: 'idea', label: x.title, ref: String(x.id) })} />) : <Body small muted>Non hai idee pubblicate.</Body>) : null}
        {attachKind === 'place' ? <Input value={place} onChangeText={(v) => { setPlace(v); setAttach(v.trim() ? { kind: 'place', label: v.trim() } : null); }} placeholder="Es. Parco Ciani, Lugano" maxLength={60} /> : null}
        <Btn style={{ marginTop: 14 }} title="Fatto" onPress={() => setOpts(false)} />
      </Sheet>
    </View>
  );
}

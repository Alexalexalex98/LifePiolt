import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/T';

import { Body, Btn, Input, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { addDaysIso } from '@/lib/calendarMap';
import { dayKey } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { mapsUrl } from '@/lib/maps';
import { goBack } from '@/lib/nav';
import { pickNetMediaMany, takeNetPhoto, type NetMedia } from '@/lib/netMedia';
import { StoryFx, StoryStickers, storyTextStyle } from '@/components/stories/StoryFx';
import { BACKGROUNDS, FILTERS, KEEP_LABEL, MAX_PEOPLE, MAX_STORY_TEXT, NO_ADJUST, cleanLink, cleanTags, isAdjusted, makeStory, type Adjust, type FilterId, type Keep, type Story, type StoryAttach, type StoryFit, type TextPos, type TextSize, type TextStyleId } from '@/lib/stories';
import { useApp } from '@/store/app';
import { useLife } from '@/store/life';
import { newId, useNet } from '@/store/network';
import { toast } from '@/store/toast';

const INKS = ['#ffffff', '#ffd166', '#ff5d8f', '#6cf0c2', '#7aa2ff', '#111111'];
const POS: TextPos[] = ['alto', 'centro', 'basso'];
const buzz = () => { if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined); };

/** Aggiungere al recap: scegli come (galleria, fotocamera, testo), poi ritocca con filtri e scritta e pubblica. Tutto in una schermata. */
export default function StoryCreate() {
  const th = useTheme();
  const accent = th.accent, onAccent = th.onText;
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
  const [add, setAdd] = useState(false);
  const [adj, setAdj] = useState<Adjust>(NO_ADJUST);
  const [fit, setFit] = useState<StoryFit>('cover');
  const [textSize, setTextSize] = useState<TextSize>('M');
  const [textStyle, setTextStyle] = useState<TextStyleId>('ombra');
  const [tool, setTool] = useState<'filtri' | 'regola' | 'testo' | 'adatta' | 'sfondo'>('filtri');
  const [people, setPeople] = useState<string[]>([]);
  const [tagsTxt, setTagsTxt] = useState('');
  const [link, setLink] = useState('');
  const [share, setShare] = useState(false);
  const [shPlace, setShPlace] = useState('');
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
  const reset = () => { setItems([]); setTextMode(false); setText(''); setFilter('none'); setFilters(false); setAdj(NO_ADJUST); setFit('cover'); setPeople([]); setTagsTxt(''); setLink(''); setAttach(null); };

  function publish() {
    const base = { author: me, now: Date.now(), text, keep, attach: attach ?? undefined, filter, textPos: pos, textColor: ink, adj, fit, textSize, textStyle, people, tags: tagsTxt.split(/[\s,]+/), link };
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

  const shareSheet = (
      <Sheet visible={share} title="Condividi nel recap" onClose={() => setShare(false)}>
        {(() => {
          const pick = (a: StoryAttach, t: string) => { setAttach(a); setText(t); setTextMode(true); setShare(false); buzz(); };
          return (
            <View style={{ gap: 6 }}>
              {myIdeas.length ? <Body bold>Le mie idee</Body> : null}
              {myIdeas.map((x) => <Pill key={'i' + x.id} label={x.title} onPress={() => pick({ kind: 'idea', label: x.title, ref: String(x.id) }, x.title)} />)}
              {mySeminars.length ? <Body bold style={{ marginTop: 8 }}>I miei seminari</Body> : null}
              {mySeminars.map((x) => <Pill key={'s' + x.id} label={x.title} onPress={() => pick({ kind: 'seminar', label: x.title, ref: String(x.id) }, x.title)} />)}
              {nextEvents.length ? <Body bold style={{ marginTop: 8 }}>I miei impegni</Body> : null}
              {nextEvents.map((e) => <Pill key={e.day + e.label} label={e.label} onPress={() => pick({ kind: 'event', label: e.label, ref: e.day }, e.label)} />)}
              <Body bold style={{ marginTop: 8 }}>Un luogo</Body>
              <Input value={shPlace} onChangeText={setShPlace} placeholder="Es. Parco Ciani, Lugano" maxLength={60} />
              <Btn small style={{ marginTop: 6 }} title="Condividi il luogo" disabled={!shPlace.trim()} onPress={() => pick({ kind: 'place', label: shPlace.trim() }, shPlace.trim())} />
            </View>
          );
        })()}
      </Sheet>
  );

  /* ---------- 1. come vuoi iniziare ---------- */
  if (!composing) {
    const tile = (icon: string, label: string, sub: string, onPress: () => void) => (
      <Pressable key={label} accessibilityRole="button" accessibilityLabel={`${label}. ${sub}`} onPress={onPress} disabled={busy} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, backgroundColor: pressed ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' })}>
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: accent + '26', alignItems: 'center', justifyContent: 'center' }}>{icon === 'Aa' ? <Text style={{ color: accent, fontWeight: '900', fontSize: 17 }}>Aa</Text> : <Icon name={icon as never} size={22} color={accent} />}</View>
        <View style={{ flex: 1 }}><Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>{label}</Text><Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, marginTop: 2 }}>{sub}</Text></View>
        <Icon name="chevron-right" size={18} color="rgba(255,255,255,0.45)" />
      </Pressable>
    );
    return (
      <View style={{ flex: 1, backgroundColor: '#07080d' }}>
        <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Chiudi')} onPress={goBack} hitSlop={12} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={20} color="#fff" /></Pressable>
        </View>
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <Text style={{ color: '#fff', fontSize: 38, fontWeight: '900', letterSpacing: -1 }}>{tl('Cosa stai')}</Text>
          <Text style={{ color: accent, fontSize: 38, fontWeight: '900', letterSpacing: -1 }}>{tl('combinando?')}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, marginTop: 8 }}>{tl('Aggiungi un momento al tuo recap.')}</Text>
        </View>
        <View style={{ gap: 10, paddingHorizontal: 20, marginTop: 28 }}>
          {tile('image', tl('Galleria'), tl('Foto e video, anche più insieme'), () => void fromGallery())}
          {tile('camera', tl('Fotocamera'), tl('Scatta adesso'), () => void fromCamera())}
          {tile('share', tl('Condividi'), tl('Un evento, un’idea, un seminario, un luogo'), () => setShare(true))}
          {tile('Aa', tl('Solo testo'), tl('Una frase su un colore'), () => { setTextMode(true); buzz(); })}
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center', marginTop: 'auto', paddingBottom: insets.bottom + 18, paddingHorizontal: 30 }}>{tl('Il momento resta nel recap per 24 ore, se non scegli altro. Lo vede chi ti segue.')}</Text>
        {shareSheet}
      </View>
    );
  }

  /* ---------- 2. ritocca e pubblica ---------- */
  const draft: Story = { id: 'draft', author: me, ts: Date.now(), kind: textMode ? 'text' : items[cur]?.media ?? 'photo', views: [], filter, adj, textColor: ink, textSize, textStyle, ...(attach ? { attach } : {}), ...(people.length ? { people } : {}), ...(cleanTags(tagsTxt.split(/[\s,]+/)).length ? { tags: cleanTags(tagsTxt.split(/[\s,]+/)) } : {}), ...(cleanLink(link) ? { link: cleanLink(link) } : {}) };
  const sideGap = 20;
  // l'anteprima sta tra la barra in alto e il pannello degli strumenti
  const panelH = tool === 'regola' ? 196 : tool === 'testo' ? 168 : 104;
  const maxH = height - insets.top - insets.bottom - 56 - 44 - 66 - panelH - 74 - 34;
  const previewW = Math.max(120, Math.min(width - sideGap * 2, maxH * 9 / 16));
  const previewH = previewW * 16 / 9;
  const place$ = pos === 'alto' ? { top: 28 } : pos === 'centro' ? { top: previewH / 2 - 30 } : { bottom: 60 };
  const tools: { id: typeof tool; icon: string; label: string; show: boolean }[] = [
    { id: 'filtri', icon: 'sparkle', label: 'Filtri', show: !textMode },
    { id: 'sfondo', icon: 'grid', label: 'Sfondo', show: textMode },
    { id: 'regola', icon: 'gear', label: 'Regola', show: !textMode },
    { id: 'testo', icon: 'edit', label: 'Testo', show: true },
    { id: 'adatta', icon: 'image', label: 'Adatta', show: !textMode && items[cur]?.media === 'photo' },
  ];
  const active = tools.find((x) => x.id === tool && x.show) ?? tools.find((x) => x.show)!;
  const pill = (label: string, on: boolean, onPress: () => void) => <Pill key={label} label={label} on={on} onPress={() => { buzz(); onPress(); }} />;
  const sliders: { k: keyof Adjust; label: string; min: number }[] = [{ k: 'bright', label: 'Luminosità', min: -1 }, { k: 'warm', label: 'Calore', min: -1 }, { k: 'fade', label: 'Dissolvenza', min: 0 }, { k: 'vign', label: 'Vignetta', min: 0 }];
  const addedCount = (attach ? 1 : 0) + people.length + cleanTags(tagsTxt.split(/[\s,]+/)).length + (cleanLink(link) ? 1 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: '#07080d' }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 56 + insets.top }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Ricomincia')} onPress={reset} hitSlop={12} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}><Icon name="arrow-left" size={20} color="#fff" /></Pressable>
        {items.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 10 }} style={{ flex: 1 }}>
            {items.map((m, i) => (
              <Pressable key={m.uri + i} accessibilityRole="button" accessibilityLabel={tl('Momento {0}', i + 1)} onPress={() => setCur(i)} style={{ width: 34, height: 46, borderRadius: 9, overflow: 'hidden', borderWidth: i === cur ? 2 : 0, borderColor: '#fff' }}>
                {m.media === 'photo' ? <Image source={{ uri: m.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <View style={{ flex: 1, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={14} color="#fff" /></View>}
              </Pressable>
            ))}
          </ScrollView>
        ) : <View style={{ flex: 1 }} />}
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Chiudi')} onPress={goBack} hitSlop={12} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={20} color="#fff" /></Pressable>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: previewW, height: previewH, borderRadius: 24, overflow: 'hidden', backgroundColor: '#111' }}>
          {textMode
            ? <LinearGradient colors={BACKGROUNDS[bg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} />
            : items[cur]?.media === 'photo' ? <Image source={{ uri: items[cur].uri }} style={{ width: '100%', height: '100%' }} contentFit={fit} />
            : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={44} color="#fff" /><Text style={{ color: '#fff', marginTop: 8, fontWeight: '700' }}>{tl('Video')}</Text></View>}
          <StoryFx s={draft} />
          <View style={[{ position: 'absolute', start: 14, end: 14 }, textMode ? { top: previewH / 2 - 40 } : place$]}>
            <TextInput value={text} onChangeText={setText} multiline maxLength={MAX_STORY_TEXT} placeholder={tl(textMode ? 'Scrivi qui' : 'Aggiungi una scritta')} placeholderTextColor="rgba(255,255,255,0.6)" accessibilityLabel={tl('Scritta sul momento')}
              style={[storyTextStyle(draft, previewW / 390 * 1.15), { padding: 0 }]} />
          </View>
          <StoryStickers s={draft} bottom={10} />
        </View>
        {/* quanto resta: un tocco cambia solo il tempo */}
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 6, marginTop: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, padding: 4 }}>
          {(['day', 'week', 'moment'] as Keep[]).map((k) => (
            <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: keep === k }} accessibilityLabel={KEEP_LABEL[k]} onPress={() => { buzz(); setKeep(k); }} style={{ paddingHorizontal: 14, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: keep === k ? '#fff' : 'transparent' }}>
              <Text style={{ color: keep === k ? '#111' : 'rgba(255,255,255,0.85)', fontWeight: '800', fontSize: 12.5 }}>{tl(k === 'day' ? '24 ore' : k === 'week' ? '7 giorni' : 'Fisso nel profilo')}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* pannello dello strumento scelto */}
      <View style={{ minHeight: panelH, justifyContent: 'center' }}>
        {active.id === 'filtri' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }} style={{ flexGrow: 0 }}>
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
        {active.id === 'sfondo' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }} style={{ flexGrow: 0 }}>
            {BACKGROUNDS.map((b, i) => (
              <Pressable key={i} accessibilityRole="button" accessibilityLabel={tl('Sfondo {0}', i + 1)} accessibilityState={{ selected: bg === i }} onPress={() => { buzz(); setBg(i); }}>
                <LinearGradient colors={b} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 54, height: 72, borderRadius: 14, borderWidth: bg === i ? 2.5 : 0, borderColor: '#fff' }} />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        {active.id === 'regola' ? (
          <View style={{ paddingHorizontal: 22, gap: 6 }}>
            {sliders.map((sl) => <Slider key={sl.k} label={tl(sl.label)} value={adj[sl.k]} min={sl.min} onChange={(v) => setAdj((a) => ({ ...a, [sl.k]: v }))} />)}
            {isAdjusted(adj) ? <Pressable accessibilityRole="button" onPress={() => setAdj(NO_ADJUST)} style={{ alignSelf: 'flex-end' }}><Text style={{ color: accent, fontWeight: '800', fontSize: 12.5 }}>{tl('Azzera i ritocchi')}</Text></Pressable> : null}
          </View>
        ) : null}
        {active.id === 'testo' ? (
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>
              {(['S', 'M', 'L'] as TextSize[]).map((z) => pill(z === 'S' ? 'Piccolo' : z === 'M' ? 'Medio' : 'Grande', textSize === z, () => setTextSize(z)))}
              {(['ombra', 'riquadro', 'evidenziato'] as TextStyleId[]).map((z) => pill(z === 'ombra' ? 'Ombra' : z === 'riquadro' ? 'Riquadro' : 'Evidenziato', textStyle === z, () => setTextStyle(z)))}
            </Row>
            {!textMode ? <Row style={{ justifyContent: 'flex-start' }} gap={6}>{POS.map((z) => pill(z === 'alto' ? 'In alto' : z === 'centro' ? 'Al centro' : 'In basso', pos === z, () => setPos(z)))}</Row> : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {INKS.map((c) => <Pressable key={c} accessibilityRole="button" accessibilityLabel={tl('Colore della scritta')} accessibilityState={{ selected: ink === c }} onPress={() => { buzz(); setInk(c); }} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: ink === c ? 3 : 1, borderColor: ink === c ? '#7b5cff' : 'rgba(255,255,255,0.4)' }} />)}
            </ScrollView>
          </View>
        ) : null}
        {active.id === 'adatta' ? (
          <Row style={{ justifyContent: 'center' }} gap={8}>{pill('Riempi lo schermo', fit === 'cover', () => setFit('cover'))}{pill('Mostra tutta la foto', fit === 'contain', () => setFit('contain'))}</Row>
        ) : null}
      </View>

      {/* strumenti + aggiungi */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 6, height: 66 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flex: 1 }}>
          {tools.filter((x) => x.show).map((x) => {
            const on = active.id === x.id;
            return (
              <Pressable key={x.id} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={tl(x.label)} onPress={() => { buzz(); setTool(x.id); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 14, borderRadius: 21, backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.14)' }}>
                <Icon name={x.icon as never} size={18} color={on ? '#111' : '#fff'} />
                <Text style={{ color: on ? '#111' : '#fff', fontWeight: '800', fontSize: 13 }}>{tl(x.label)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Aggiungi: persone, luogo, hashtag, link')} onPress={() => { buzz(); setAdd(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 14, borderRadius: 21, backgroundColor: accent }}>
          <Icon name="plus" size={18} color="#fff" stroke={3} />
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>{addedCount ? `${tl('Aggiungi')} · ${addedCount}` : tl('Aggiungi')}</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Aggiungi al recap')} onPress={publish} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
          <View style={{ height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: accent }}>
            <Icon name="plus" size={22} color={onAccent} />
            <Text style={{ color: onAccent, fontSize: 17, fontWeight: '800' }}>{items.length > 1 ? tl('Aggiungi {0} momenti', items.length) : tl('Aggiungi al recap')}</Text>
          </View>
        </Pressable>
      </View>

      <Sheet visible={add} title="Aggiungi al momento" onClose={() => setAdd(false)}>
        <Body bold style={{ marginBottom: 6 }}>Tagga persone</Body>
        {net.following.length ? (
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
            {net.following.slice(0, 20).map((n) => <Pill key={n} label={n} icon="profile" on={people.includes(n)} onPress={() => setPeople((p) => (p.includes(n) ? p.filter((x) => x !== n) : p.length < MAX_PEOPLE ? [...p, n] : p))} />)}
          </Row>
        ) : <Body small muted>Segui qualcuno per poterlo taggare.</Body>}
        <Body bold style={{ marginTop: 14, marginBottom: 6 }}>Posizione</Body>
        <Input value={place} onChangeText={(v) => { setPlace(v); setAttachKind(v.trim() ? 'place' : 'none'); setAttach(v.trim() ? { kind: 'place', label: v.trim() } : null); }} placeholder="Es. Parco Ciani, Lugano" maxLength={60} />
        {place.trim() ? <Btn small ghost icon="location" style={{ marginTop: 8, alignSelf: 'flex-start' }} title="Trova sulla mappa" onPress={() => { Linking.openURL(mapsUrl(place, Platform.OS)).catch(() => toast('Non riesco ad aprire le mappe')); }} /> : null}
        <Body bold style={{ marginTop: 14, marginBottom: 6 }}>Hashtag</Body>
        <Input value={tagsTxt} onChangeText={setTagsTxt} placeholder="Es. #estate #mare" autoCapitalize="none" maxLength={80} />
        <Body bold style={{ marginTop: 14, marginBottom: 6 }}>Link</Body>
        <Input value={link} onChangeText={setLink} placeholder="https://" autoCapitalize="none" keyboardType="url" maxLength={200} />
        {link.trim() && !cleanLink(link) ? <Body small color="#ff6b6b">Il link deve iniziare con http:// o https://</Body> : null}
        <Body bold style={{ marginTop: 14, marginBottom: 6 }}>Collega qualcosa di tuo</Body>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
          {([['none', 'Niente'], ['event', 'Un impegno'], ['seminar', 'Un mio seminario'], ['idea', 'Una mia idea']] as const).map(([k, l]) => <Pill key={k} label={l} on={attachKind === k} onPress={() => { setAttachKind(k); setAttach(null); if (k !== 'none') setPlace(''); }} />)}
        </Row>
        {attachKind === 'event' ? (nextEvents.length ? nextEvents.map((e) => <Pill key={e.day + e.label} label={e.label} on={attach?.ref === e.day && attach.label === e.label} onPress={() => setAttach({ kind: 'event', label: e.label, ref: e.day })} />) : <Body small muted>Nessun impegno nei prossimi giorni.</Body>) : null}
        {attachKind === 'seminar' ? (mySeminars.length ? mySeminars.map((x) => <Pill key={x.id} label={x.title} on={attach?.ref === String(x.id)} onPress={() => setAttach({ kind: 'seminar', label: x.title, ref: String(x.id) })} />) : <Body small muted>Non hai seminari.</Body>) : null}
        {attachKind === 'idea' ? (myIdeas.length ? myIdeas.map((x) => <Pill key={x.id} label={x.title} on={attach?.ref === String(x.id)} onPress={() => setAttach({ kind: 'idea', label: x.title, ref: String(x.id) })} />) : <Body small muted>Non hai idee pubblicate.</Body>) : null}
        <Btn style={{ marginTop: 14 }} title="Fatto" onPress={() => setAdd(false)} />
      </Sheet>
      {shareSheet}
    </View>
  );
}

/** Cursore a tocco e trascinamento: da `min` a 1 (le barre con 0 al centro per i valori che vanno da -1). */
function Slider({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (v: number) => void }) {
  const [w, setW] = useState(0);
  const set = (x: number) => { if (w <= 0) return; const f = Math.max(0, Math.min(1, x / w)); const v = min + f * (1 - min); onChange(Math.abs(v) < 0.04 ? 0 : Math.round(v * 100) / 100); };
  const f = (value - min) / (1 - min);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={{ color: 'rgba(255,255,255,0.85)', width: 86, fontSize: 12.5, fontWeight: '700' }}>{label}</Text>
      <View accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(f * 100) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={(e) => onChange(Math.max(min, Math.min(1, value + (e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))))}
        onLayout={(e) => setW(e.nativeEvent.layout.width)} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => set(e.nativeEvent.locationX)} onResponderMove={(e) => set(e.nativeEvent.locationX)} style={{ flex: 1, height: 34, justifyContent: 'center' }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' }} />
        <View style={{ position: 'absolute', start: 0, width: `${Math.max(0, Math.min(1, f)) * 100}%`, height: 4, borderRadius: 2, backgroundColor: '#fff' }} />
        <View style={{ position: 'absolute', start: `${Math.max(0, Math.min(1, f)) * 100}%`, marginStart: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }} />
      </View>
    </View>
  );
}

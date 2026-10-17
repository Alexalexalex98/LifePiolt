import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { manipulateAsync, FlipType, SaveFormat } from 'expo-image-manipulator';
import { Keyboard, Linking, Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
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
import { setEditorResult, takeEditorInput } from '@/lib/editorHandoff';
import { openSheet } from '@/components/network';
import { useLocalSearchParams } from 'expo-router';
import { SPEEDS, cleanVideoFx, type VideoFx } from '@/lib/videoFx';
import { VideoPoster } from '@/components/stories/VideoPoster';
import { EDIT_SUGGESTIONS, RATIOS, addAdjust, cropRect, parseEdit, zoomRect, type Ratio } from '@/lib/photoEdit';
import { pickNetMediaMany, takeNetPhoto, type NetMedia } from '@/lib/netMedia';
import { StoryFx, StoryStickers, storyTextStyle } from '@/components/stories/StoryFx';
import { BACKGROUNDS, FILTERS, KEEP_LABEL, MAX_PEOPLE, MAX_STORY_TEXT, NO_ADJUST, cleanLink, cleanTags, isAdjusted, makeStory, type Adjust, type FilterId, type Keep, type Story, type StoryAttach, type StoryFit, type TextPos, type TextSize, type TextStyleId } from '@/lib/stories';
import { useApp } from '@/store/app';
import { useLife } from '@/store/life';
import { newId, useNet } from '@/store/network';
import { toast } from '@/store/toast';

const TEMPLATES = ['Buongiorno', 'Oggi sto…', 'Cosa ne pensate?', 'Grazie a tutti', 'Weekend!', 'Una novità'];
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
  const forPost = useLocalSearchParams<{ for?: string }>().for === 'post';
  const [items, setItems] = useState<NetMedia[]>([]);
  const [textMode, setTextMode] = useState(false);
  const [text, setText] = useState('');
  const [bg, setBg] = useState(0);
  const [filter, setFilter] = useState<FilterId>('none');
  const [pos, setPos] = useState<TextPos>('basso');
  const [ink, setInk] = useState('#ffffff');
  const [keep, setKeep] = useState<Keep>('day');
  const [kbd, setKbd] = useState(false);
  // dal compositore dei post: stessa schermata, con la foto o il video già scelto
  useEffect(() => {
    if (!forPost) return;
    const inp = takeEditorInput();
    if (!inp) return;
    setItems(inp.items); setCur(0);
    if (inp.fx?.filter) setFilter(inp.fx.filter);
    if (inp.fx?.adj) setAdj(inp.fx.adj);
    if (inp.fx?.fit) setFit(inp.fx.fit);
    if (inp.fx?.video) setVfxMap({ 0: inp.fx.video });
  }, [forPost]);
  const leavePost = (save: boolean) => {
    if (save) setEditorResult({ items, fx: { filter, adj, fit, video: vfxMap[0] } });
    goBack();
    setTimeout(() => openSheet('newPost', { resume: true }), 350);
  };
  useEffect(() => {
    const a = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKbd(true));
    const b = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbd(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  const [attach, setAttach] = useState<StoryAttach | null>(null);
  const [cur, setCur] = useState(0);
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState(false);
  const [add, setAdd] = useState(false);
  const [adj, setAdj] = useState<Adjust>(NO_ADJUST);
  const [fit, setFit] = useState<StoryFit>('cover');
  const [textSize, setTextSize] = useState<TextSize>('M');
  const [textStyle, setTextStyle] = useState<TextStyleId>('ombra');
  const [tool, setTool] = useState<'filtri' | 'regola' | 'ritocca' | 'video' | 'testo' | 'adatta' | 'sfondo'>('filtri');
  const [vfxMap, setVfxMap] = useState<Record<number, VideoFx>>({});
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [undo, setUndo] = useState<Record<number, string[]>>({});
  const [regGroup, setRegGroup] = useState<'luce' | 'colore' | 'effetti'>('luce');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiNote, setAiNote] = useState('');
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
    if (forPost) { leavePost(true); return; }
    const base = { author: me, now: Date.now(), text, keep, attach: attach ?? undefined, filter, textPos: pos, textColor: ink, adj, fit, textSize, textStyle, people, tags: tagsTxt.split(/[\s,]+/), link };
    const made = textMode
      ? [makeStory({ ...base, id: String(newId()), kind: 'text', bg: BACKGROUNDS[bg] })]
      : items.map((m, i) => makeStory({ ...base, id: String(newId()) + i, now: base.now + i, kind: m.media, uri: m.uri, text: i === 0 ? text : '', vfx: cleanVideoFx(vfxMap[i], (m.durationMs ?? 0) / 1000) }));
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
      <ScrollView style={{ flex: 1, backgroundColor: '#07080d' }} contentContainerStyle={{ paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
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
        {/* modelli pronti: un tocco e la frase è già sul momento */}
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '800', letterSpacing: 0.8, paddingHorizontal: 24, marginTop: 24, marginBottom: 10 }}>{tl('MODELLI PRONTI')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }} style={{ flexGrow: 0 }}>
          {TEMPLATES.map((tp, i) => (
            <Pressable key={tp} accessibilityRole="button" accessibilityLabel={tl(tp)} onPress={() => { setText(tl(tp)); setBg(i % BACKGROUNDS.length); setTextMode(true); buzz(); }}>
              <LinearGradient colors={BACKGROUNDS[i % BACKGROUNDS.length]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 104, height: 150, borderRadius: 18, padding: 10, justifyContent: 'center' }}>
                <Text numberOfLines={5} style={{ color: '#fff', fontSize: 14, fontWeight: '900', textAlign: 'center' }}>{tl(tp)}</Text>
              </LinearGradient>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center', marginTop: 24, paddingHorizontal: 30 }}>{tl('Il momento resta nel recap per 24 ore, se non scegli altro. Lo vede chi ti segue.')}</Text>
        {shareSheet}
      </ScrollView>
    );
  }

  /* ---------- ritocco della foto: ruota, specchia, ritaglia, zoom (modifica davvero i pixel) ---------- */
  const geom = async (build: (w: number, h: number) => Parameters<typeof manipulateAsync>[1]) => {
    const it = items[cur];
    if (!it || it.media !== 'photo' || busy) return;
    setBusy(true);
    try {
      const info = await manipulateAsync(it.uri, []);
      const out = await manipulateAsync(it.uri, build(info.width, info.height), { compress: 0.92, format: SaveFormat.JPEG });
      setUndo((u) => ({ ...u, [cur]: [...(u[cur] ?? []), it.uri] }));
      setItems((xs) => xs.map((x, i) => (i === cur ? { ...x, uri: out.uri } : x)));
    } catch { toast('Non riesco a modificare la foto'); } finally { setBusy(false); }
  };
  const rotate = (deg: 90 | -90 | 180) => geom(() => [{ rotate: deg }]);
  const flip = () => geom(() => [{ flip: FlipType.Horizontal }]);
  const crop = (r: Ratio) => geom((w, h) => [{ crop: cropRect(w, h, r) }]);
  const zoom = (f: number) => geom((w, h) => [{ crop: zoomRect(w, h, f) }]);
  const undoGeom = () => {
    const prev = undo[cur]?.[undo[cur].length - 1];
    if (!prev) return;
    setUndo((u) => ({ ...u, [cur]: u[cur].slice(0, -1) }));
    setItems((xs) => xs.map((x, i) => (i === cur ? { ...x, uri: prev } : x)));
  };
  const runAi = async () => {
    const { ops, unsupported } = parseEdit(aiText);
    if (!ops.length && !unsupported.length) { setAiNote('Non ho capito la richiesta. Prova con una delle idee qui sopra.'); return; }
    for (const op of ops) {
      if (op.k === 'adj') setAdj((a) => addAdjust(a, op.d));
      else if (op.k === 'filter') setFilter(op.id);
      else if (op.k === 'speed') { if (items[cur]?.media === 'video') setVfxMap((m) => ({ ...m, [cur]: { ...(m[cur] ?? {}), speed: SPEEDS.reduce((a, b) => (Math.abs(b - op.f) < Math.abs(a - op.f) ? b : a)) } })); }
      else if (op.k === 'mute') { if (items[cur]?.media === 'video') setVfxMap((m) => ({ ...m, [cur]: { ...(m[cur] ?? {}), mute: true } })); }
      else if (items[cur]?.media === 'photo') {
        if (op.k === 'rotate') await rotate(op.deg);
        else if (op.k === 'flip') await flip();
        else if (op.k === 'crop') await crop(op.ratio);
        else if (op.k === 'zoom') await zoom(op.f);
      }
    }
    setAiNote(unsupported.length ? `Fatto quello che so fare. Non posso ancora: ${unsupported.join(', ')} (serve un servizio di immagini AI non ancora collegato).` : 'Fatto. Se non ti piace, puoi annullare o azzerare dai ritocchi.');
    if (!unsupported.length) { setAiOpen(false); setAiText(''); setAiNote(''); toast('Modifica applicata'); }
  };

  /* ---------- 2. ritocca e pubblica ---------- */
  const draft: Story = { id: 'draft', author: me, ts: Date.now(), kind: textMode ? 'text' : items[cur]?.media ?? 'photo', views: [], filter, adj, textColor: ink, textSize, textStyle, ...(attach ? { attach } : {}), ...(people.length ? { people } : {}), ...(cleanTags(tagsTxt.split(/[\s,]+/)).length ? { tags: cleanTags(tagsTxt.split(/[\s,]+/)) } : {}), ...(cleanLink(link) ? { link: cleanLink(link) } : {}) };
  const sideGap = 20;
  // l'anteprima prende lo spazio che resta tra la barra in alto e gli strumenti: niente calcoli a mano, niente sovrapposizioni
  const panelH = tool === 'regola' ? 206 : tool === 'testo' ? 160 : tool === 'ritocca' ? 132 : tool === 'video' ? 168 : 96;
  const maxH = Math.max(160, area.h - 56);
  const ar = forPost ? 5 / 4 : 16 / 9;
  const previewW = Math.max(110, Math.min(area.w - sideGap * 2 || width - sideGap * 2, maxH / ar));
  const previewH = previewW * ar;
  const place$ = pos === 'alto' ? { top: 28 } : pos === 'centro' ? { top: previewH / 2 - 30 } : { bottom: 60 };
  const tools: { id: typeof tool; icon: string; label: string; show: boolean }[] = [
    { id: 'filtri', icon: 'sparkle', label: 'Filtri', show: !textMode },
    { id: 'sfondo', icon: 'grid', label: 'Sfondo', show: textMode },
    { id: 'regola', icon: 'gear', label: 'Regola', show: !textMode },
    { id: 'ritocca', icon: 'repeat', label: 'Ritocca', show: !textMode && items[cur]?.media === 'photo' },
    { id: 'video', icon: 'video', label: 'Video', show: !textMode && items[cur]?.media === 'video' },
    { id: 'testo', icon: 'edit', label: 'Testo', show: !forPost },
    { id: 'adatta', icon: 'image', label: 'Adatta', show: !textMode && items[cur]?.media === 'photo' },
  ];
  const active = tools.find((x) => x.id === tool && x.show) ?? tools.find((x) => x.show)!;
  const pill = (label: string, on: boolean, onPress: () => void) => <Pill key={label} label={label} on={on} onPress={() => { buzz(); onPress(); }} />;
  const GROUPS: { id: 'luce' | 'colore' | 'effetti'; label: string; sl: { k: keyof Adjust; label: string; min: number }[] }[] = [
    { id: 'luce', label: 'Luce', sl: [{ k: 'bright', label: 'Esposizione', min: -1 }, { k: 'contrast', label: 'Contrasto', min: -1 }, { k: 'light', label: 'Alte luci', min: -1 }, { k: 'shadow', label: 'Ombre', min: -1 }] },
    { id: 'colore', label: 'Colore', sl: [{ k: 'warm', label: 'Temperatura', min: -1 }, { k: 'tint', label: 'Tinta', min: -1 }, { k: 'desat', label: 'Bianco e nero', min: 0 }] },
    { id: 'effetti', label: 'Effetti', sl: [{ k: 'fade', label: 'Dissolvenza', min: 0 }, { k: 'vign', label: 'Vignetta', min: 0 }] },
  ];
  const group = GROUPS.find((g) => g.id === regGroup)!;
  const addedCount = (attach ? 1 : 0) + people.length + cleanTags(tagsTxt.split(/[\s,]+/)).length + (cleanLink(link) ? 1 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: '#07080d' }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 56 + insets.top }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tl(forPost ? 'Indietro' : 'Ricomincia')} onPress={forPost ? () => leavePost(false) : reset} hitSlop={12} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}><Icon name="arrow-left" size={20} color="#fff" /></Pressable>
        {items.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 10 }} style={{ flex: 1 }}>
            {items.map((m, i) => (
              <Pressable key={m.uri + i} accessibilityRole="button" accessibilityLabel={tl('Momento {0}', i + 1)} onPress={() => setCur(i)} style={{ width: 34, height: 46, borderRadius: 9, overflow: 'hidden', borderWidth: i === cur ? 2 : 0, borderColor: '#fff' }}>
                {m.media === 'photo' ? <Image source={{ uri: m.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <View style={{ flex: 1, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={14} color="#fff" /></View>}
              </Pressable>
            ))}
          </ScrollView>
        ) : <View style={{ flex: 1 }} />}
        <View style={{ flexDirection: 'row', gap: 8, marginEnd: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Modifica con AI')} onPress={() => { buzz(); setAiNote(''); setAiOpen(true); }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: accent, alignItems: 'center', justifyContent: 'center', gap: 0 }}>
          <Icon name="sparkle" size={15} color={onAccent} />
          <Text style={{ color: onAccent, fontWeight: '900', fontSize: 9.5 }}>AI</Text>
        </Pressable>
        {forPost ? null : <Pressable accessibilityRole="button" accessibilityLabel={tl('Aggiungi: persone, luogo, hashtag, link')} onPress={() => { buzz(); setAdd(true); }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={19} color="#fff" stroke={2.6} />
          {addedCount ? <View style={{ position: 'absolute', top: -3, end: -3, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: onAccent, fontSize: 10, fontWeight: '900' }}>{addedCount}</Text></View> : null}
        </Pressable>}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Chiudi')} onPress={forPost ? () => leavePost(false) : goBack} hitSlop={12} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={20} color="#fff" /></Pressable>
      </View>

      <Pressable accessible={false} onPress={Keyboard.dismiss} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 }}>
        {kbd ? (
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Fine')} onPress={Keyboard.dismiss} style={{ position: 'absolute', top: 4, end: 14, zIndex: 5, height: 38, paddingHorizontal: 20, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#111', fontWeight: '800', fontSize: 14 }}>{tl('Fine')}</Text>
          </Pressable>
        ) : null}
        <View style={{ width: previewW, height: previewH, borderRadius: 24, overflow: 'hidden', backgroundColor: '#111' }}>
          {textMode
            ? <LinearGradient colors={BACKGROUNDS[bg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} />
            : items[cur]?.media === 'photo' ? <Image source={{ uri: items[cur].uri }} style={{ width: '100%', height: '100%' }} contentFit={fit} />
            
            : <VideoPoster uri={items[cur]?.uri} width={previewW} height={previewH} />}
          <StoryFx s={draft} uri={!textMode && items[cur]?.media === 'photo' ? items[cur].uri : undefined} fit={fit} />
          {forPost ? null : <View style={[{ position: 'absolute', start: 14, end: 14 }, textMode ? { top: previewH / 2 - 40 } : place$]}>
            <TextInput value={text} onChangeText={setText} multiline maxLength={MAX_STORY_TEXT} placeholder={tl(textMode ? 'Scrivi qui' : 'Aggiungi una scritta')} placeholderTextColor="rgba(255,255,255,0.6)" accessibilityLabel={tl('Scritta sul momento')}
              style={[storyTextStyle(draft, previewW / 390 * 1.15), { padding: 0 }]} />
          </View>}
          {forPost ? null : <StoryStickers s={draft} bottom={10} />}
        </View>
        {/* quanto resta: un tocco cambia solo il tempo */}
        {forPost ? null : <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 6, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, padding: 4 }}>
          {(['day', 'week', 'moment'] as Keep[]).map((k) => (
            <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: keep === k }} accessibilityLabel={KEEP_LABEL[k]} onPress={() => { buzz(); setKeep(k); }} style={{ paddingHorizontal: 14, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: keep === k ? '#fff' : 'transparent' }}>
              <Text style={{ color: keep === k ? '#111' : 'rgba(255,255,255,0.85)', fontWeight: '800', fontSize: 12.5 }}>{tl(k === 'day' ? '24 ore' : k === 'week' ? '7 giorni' : 'Fisso nel profilo')}</Text>
            </Pressable>
          ))}
        </View>}
      </Pressable>

      {/* pannello dello strumento scelto */}
      <View style={{ height: panelH, justifyContent: 'center' }}>
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
          <View style={{ paddingHorizontal: 18, gap: 4 }}>
            <Row style={{ justifyContent: 'flex-start' }} gap={6}>
              {GROUPS.map((g) => pill(g.label, regGroup === g.id, () => setRegGroup(g.id)))}
              <View style={{ flex: 1 }} />
              {isAdjusted(adj) ? <Pressable accessibilityRole="button" onPress={() => setAdj(NO_ADJUST)} hitSlop={8}><Text style={{ color: accent, fontWeight: '800', fontSize: 12.5 }}>{tl('Azzera')}</Text></Pressable> : null}
            </Row>
            {group.sl.filter((x) => x.k !== 'contrast' || items[cur]?.media === 'photo').map((x) => <Slider key={x.k} label={tl(x.label)} value={adj[x.k] ?? 0} min={x.min} onChange={(v) => setAdj((a) => ({ ...a, [x.k]: v }))} />)}
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
        {active.id === 'ritocca' ? (
          <View style={{ gap: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }} style={{ flexGrow: 0 }}>
              {([['Ruota a sinistra', () => rotate(-90)], ['Ruota a destra', () => rotate(90)], ['Specchia', flip], ['Zoom +', () => zoom(1.25)]] as const).map(([l, fn]) => (
                <Pressable key={l} accessibilityRole="button" accessibilityLabel={tl(l)} onPress={() => { buzz(); void fn(); }} style={{ height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{tl(l)}</Text>
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: !undo[cur]?.length }} accessibilityLabel={tl('Annulla')} onPress={() => { buzz(); undoGeom(); }} style={{ height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', opacity: undo[cur]?.length ? 1 : 0.4 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{tl('Annulla')}</Text>
              </Pressable>
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }} style={{ flexGrow: 0 }}>
              {RATIOS.map((r) => (
                <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={tl('Ritaglia {0}', r.id)} onPress={() => { buzz(); void crop(r.id); }} style={{ height: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{r.id}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
        {active.id === 'video' ? (() => {
          const dur = (items[cur]?.durationMs ?? 0) / 1000;
          const v = vfxMap[cur] ?? {};
          const set = (d: Partial<VideoFx>) => setVfxMap((m) => ({ ...m, [cur]: { ...(m[cur] ?? {}), ...d } }));
          return (
            <View style={{ gap: 6 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }} style={{ flexGrow: 0 }}>
                {SPEEDS.map((x) => pill(`${x}x`, (v.speed ?? 1) === x, () => set({ speed: x })))}
                {pill(v.mute ? 'Senza audio' : 'Con audio', !!v.mute, () => set({ mute: !v.mute }))}
              </ScrollView>
              {dur > 1 ? (
                <View style={{ paddingHorizontal: 18, gap: 2 }}>
                  <Slider label={tl('Inizio')} value={(v.trimStart ?? 0) / dur} min={0} onChange={(f) => set({ trimStart: Math.min(f * dur, (v.trimEnd ?? dur) - 0.5) })} />
                  <Slider label={tl('Fine')} value={(v.trimEnd ?? dur) / dur} min={0} onChange={(f) => set({ trimEnd: Math.max(f * dur, (v.trimStart ?? 0) + 0.5) })} />
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center' }}>{tl('Durata')}: {Math.max(0, ((v.trimEnd ?? dur) - (v.trimStart ?? 0)) / (v.speed ?? 1)).toFixed(1)} s</Text>
                </View>
              ) : null}
            </View>
          );
        })() : null}
        {active.id === 'adatta' ? (
          <Row style={{ justifyContent: 'center' }} gap={8}>{pill('Riempi lo schermo', fit === 'cover', () => setFit('cover'))}{pill('Mostra tutta la foto', fit === 'contain', () => setFit('contain'))}</Row>
        ) : null}
      </View>

      {/* strumenti: occupano tutta la riga, nessuno finisce sotto un altro */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 6, height: 70 }}>
        {tools.filter((x) => x.show).map((x) => {
          const on = active.id === x.id;
          return (
            <Pressable key={x.id} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={tl(x.label)} onPress={() => { buzz(); setTool(x.id); }} style={{ flex: 1, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.12)' }}>
              <Icon name={x.icon as never} size={20} color={on ? '#111' : '#fff'} />
              <Text numberOfLines={1} style={{ color: on ? '#111' : '#fff', fontWeight: '800', fontSize: 11 }}>{tl(x.label)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Aggiungi al recap')} onPress={publish} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
          <View style={{ height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: accent }}>
            <Icon name="check" size={22} color={onAccent} stroke={2.6} />
            <Text style={{ color: onAccent, fontSize: 17, fontWeight: '800' }}>{items.length > 1 ? tl('Pubblica {0} momenti', items.length) : tl(forPost ? 'Fatto' : 'Pubblica nel recap')}</Text>
          </View>
        </Pressable>
      </View>

      <Sheet visible={aiOpen} title="Modifica con AI" onClose={() => setAiOpen(false)}>
        <Body small muted style={{ marginBottom: 8 }}>Scrivi cosa vuoi cambiare: luce, colori, atmosfera, ritaglio, rotazione.</Body>
        <Input multiline value={aiText} onChangeText={setAiText} placeholder="Es. più calda e luminosa, ritagliala quadrata" style={{ minHeight: 70 }} />
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 8 }} gap={8}>
          {EDIT_SUGGESTIONS.map((x) => <Pill key={x} label={x} on={false} onPress={() => setAiText((v) => (v.trim() ? `${v.trim()}, ${x.toLowerCase()}` : x))} />)}
        </Row>
        {aiNote ? <Body small color="#ffb454" style={{ marginTop: 10 }}>{aiNote}</Body> : null}
        <Btn style={{ marginTop: 14 }} title="Applica" onPress={() => void runAi()} />
      </Sheet>
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

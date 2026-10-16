import { StoryFx, StoryStickers, storyTextStyle } from '@/components/stories/StoryFx';
import { backdropUri } from '@/lib/storyBackdrop';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { VideoPoster } from '@/components/stories/VideoPoster';
import { Animated, Keyboard, PanResponder, Pressable, TextInput, View } from 'react-native';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/T';

import { UserAvatar } from '@/components/network';
import { Body, Btn, Item, Pill, Row, Sheet } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { confirmDelete } from '@/lib/confirm';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { STORY_SECONDS, addView, ago, tintOfFilter, type Story } from '@/lib/stories';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

/** Il video parte sempre senza audio: il suono si attiva solo toccando il volume. */
export function StoryVideo({ uri, controls, sound, poster, paused, onShown }: { uri: string; controls?: boolean; sound?: boolean; poster?: string; /** tenendo premuto la storia si ferma, anche il video */ paused?: boolean; /** il primo fotogramma è a schermo: da qui parte il tempo della storia */ onShown?: () => void }) {
  const p = useVideoPlayer(uri, (pl) => { pl.loop = false; pl.muted = true; if (!controls) pl.play(); });
  const [shown, setShown] = useState(false);
  useEffect(() => { p.muted = !sound; }, [p, sound]);
  useEffect(() => { if (controls) return; if (paused) p.pause(); else p.play(); }, [p, paused, controls]);
  return (
    <View style={{ width: '100%', height: '100%' }}>
      {poster ? <Image source={{ uri: poster }} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} contentFit="cover" cachePolicy="memory-disk" transition={0} /> : null}
      <VideoView player={p} style={{ width: '100%', height: '100%', opacity: shown || !poster ? 1 : 0 }} nativeControls={!!controls} contentFit="cover" onFirstFrameRender={() => { setShown(true); onShown?.(); }} />
    </View>
  );
}

/** Visualizzatore a schermo intero: tocca a destra per avanzare, a sinistra per tornare, tieni premuto per fermare. */
export function StoryPlayer({ stories, start, onClose, onEnd, onSkip }: { stories: Story[]; start: number; onClose: () => void; /** scorri a sinistra: salta alla persona successiva (+1); a destra torna alla precedente (-1) */ onSkip?: (dir: 1 | -1) => boolean; /** dopo l'ultima storia: passa alla persona successiva (se manca, chiude) */ onEnd?: () => void }) {
  const me = useApp((s) => s.account.name);
  const insets = useSafeAreaInsets();
  const kb = useKeyboardInset();
  const net = useNet();
  const goBack = onClose;
  const [i, setI] = useState(start);
  const [p, setP] = useState(0);
  const [held, setHeld] = useState(false);
  /* il tempo di una storia video parte solo quando il video si vede davvero (con un limite di 3 s per non restare fermi) */
  const [ready, setReady] = useState(false);
  const [viewers, setViewers] = useState(false);
  const [opts, setOpts] = useState(false);
  const [sound, setSound] = useState(false);
  const [reply, setReply] = useState('');
  const [typing, setTyping] = useState(false);
  const cur = stories[Math.min(i, stories.length - 1)];
  const mine = cur?.author === me;
  const paused = held || viewers || typing || opts;
  const secs = cur?.kind === 'video' ? 10 : STORY_SECONDS;
  const iRef = useRef(i); iRef.current = i;

  // segno la storia come vista
  useEffect(() => {
    if (!cur || mine) return;
    const st = useNet.getState();
    if (!(st.storySeen ?? []).includes(cur.id)) st.patch({ storySeen: [...(st.storySeen ?? []), cur.id], stories: addView(st.stories ?? [], cur.id, me) });
  }, [cur?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setP(0); setReady(false); }, [i]);
  useEffect(() => { if (ready || !cur) return; if (cur.kind !== 'video') { setReady(true); return; } const h = setTimeout(() => setReady(true), 3000); return () => clearTimeout(h); }, [cur?.id, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  /* anteprime e file dei momenti successivi si scaricano in anticipo, così non si aspetta al cambio */
  useEffect(() => {
    const nxt = stories.slice(i + 1, i + 4);
    const imgs = nxt.flatMap((x) => (x.kind === 'video' ? [x.poster] : [x.uri])).filter((u): u is string => !!u);
    if (imgs.length) void Image.prefetch(imgs, 'memory-disk').catch(() => undefined);
    nxt.filter((x) => x.kind === 'video' && x.uri && /^https?:/.test(x.uri)).forEach((x) => { fetch(x.uri as string).then((r) => r.blob()).catch(() => undefined); });
  }, [i, stories]);
  const closing = useRef(false);
  const dragY = useRef(new Animated.Value(0)).current;
  const typingRef = useRef(false);
  const skipRef = useRef(onSkip); skipRef.current = onSkip;
  /* gesti del recap: giù = chiudi, sinistra = persona successiva, destra = persona precedente */
  const swipe = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_e, g) => !typingRef.current && !closing.current && (Math.abs(g.dx) > 18 || g.dy > 18) && (Math.abs(g.dx) > Math.abs(g.dy) * 1.2 || g.dy > Math.abs(g.dx) * 1.2),
    onPanResponderGrant: () => setHeld(true),
    onPanResponderMove: (_e, g) => { if (g.dy > 0 && Math.abs(g.dy) > Math.abs(g.dx)) dragY.setValue(g.dy); },
    onPanResponderRelease: (_e, g) => {
      setHeld(false);
      if (g.dy > 110 && g.dy > Math.abs(g.dx)) { Animated.timing(dragY, { toValue: 600, duration: 160, useNativeDriver: false }).start(() => { if (!closing.current) { closing.current = true; goBack(); } }); return; }
      Animated.spring(dragY, { toValue: 0, useNativeDriver: false, friction: 8 }).start();
      if (Math.abs(g.dx) > 70 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2) { const dir: 1 | -1 = g.dx < 0 ? 1 : -1; if (skipRef.current?.(dir)) closing.current = true; }
    },
    onPanResponderTerminate: () => { setHeld(false); Animated.spring(dragY, { toValue: 0, useNativeDriver: false }).start(); },
  })).current;
  // si chiude una volta sola: prima il timer continuava a girare e chiamava «indietro» a raffica, fino a uscire dalla schermata
  const close = () => { if (closing.current) return; closing.current = true; goBack(); };
  const next = () => { if (closing.current) return; if (iRef.current >= stories.length - 1) { if (onEnd) { closing.current = true; onEnd(); } else close(); } else setI(iRef.current + 1); };
  useEffect(() => {
    if (!cur || paused || !ready || closing.current) return;
    const h = setInterval(() => setP((x) => x + 50 / (secs * 1000)), 50);
    return () => clearInterval(h);
  }, [cur?.id, paused, ready, secs]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (p >= 1) next(); }, [p]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cur) return <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}><Body style={{ color: '#fff' }}>{tl('Il recap è vuoto.')}</Body><Text onPress={goBack} style={{ color: '#8fa4ff', marginTop: 14, fontWeight: '800' }}>{tl('Indietro')}</Text></View>;

  const send = (text: string) => {
    const t = text.trim(); if (!t) return;
    const chat = useChat.getState();
    const id = chat.ensureDm(cur.author, me);
    chat.send(id, me, { kind: 'text', text: t, storyReply: { author: cur.author, kind: cur.kind, mine: false, ...(cur.uri ? { uri: cur.uri } : {}), ...(cur.kind === 'text' ? { text: cur.text, bg: cur.bg } : {}) } });
    setReply(''); setTyping(false); Keyboard.dismiss(); toast(tl('Inviato a {0}', cur.author));
  };
  const remove = () => confirmDelete(tl('questo momento del recap'), () => {
    net.patch({ stories: (net.stories ?? []).filter((s) => s.id !== cur.id) });
    /* tolto l'ultimo momento è la pagina del recap a chiudersi (e a proporre di aggiungerne uno) */
    if (stories.length > 1) setI(Math.max(0, i - 1));
  });
  const viewerList = cur.views;

  typingRef.current = typing;
  const back = backdropUri();
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {back ? <Image source={{ uri: back }} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} contentFit="cover" transition={0} /> : null}
    <Animated.View {...swipe.panHandlers} style={{ flex: 1, backgroundColor: '#000', transform: [{ translateY: dragY }], borderRadius: dragY.interpolate({ inputRange: [0, 200], outputRange: [0, 24], extrapolate: 'clamp' }), overflow: 'hidden' }}>
      {cur.kind === 'text' ? (
        <LinearGradient colors={cur.bg ?? ['#6c8cff', '#3b2a7a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800', textAlign: 'center' }}>{cur.text}</Text>
        </LinearGradient>
      ) : (
        <View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }}>
          {cur.kind === 'video' && cur.uri ? <StoryVideo key={cur.id} uri={cur.uri} sound={sound} poster={cur.poster} paused={paused} onShown={() => setReady(true)} /> : <Image source={{ uri: cur.uri }} style={{ width: '100%', height: '100%' }} contentFit={cur.fit === 'contain' ? 'contain' : 'cover'} />}
          <StoryFx s={cur} />
          {cur.text ? <View pointerEvents="none" style={[{ position: 'absolute', start: 16, end: 16, alignItems: 'center' }, cur.textPos === 'alto' ? { top: insets.top + 100 } : cur.textPos === 'centro' ? { top: '46%' } : { bottom: insets.bottom + 90 }]}><Text style={storyTextStyle(cur)}>{cur.text}</Text></View> : null}
          <StoryStickers s={cur} bottom={insets.bottom + 70 + (cur.text && !cur.textPos ? 52 : 0)} />
        </View>
      )}
      {/* zone di tocco: sinistra indietro, destra avanti, pressione lunga ferma */}
      <View pointerEvents={typing ? 'none' : 'auto'} style={{ position: 'absolute', top: insets.top + 70, bottom: insets.bottom + 80, start: 0, end: 0, flexDirection: 'row' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Momento precedente')} style={{ flex: 1 }} onPress={() => (i > 0 ? setI(i - 1) : setP(0))} onLongPress={() => setHeld(true)} onPressOut={() => setHeld(false)} delayLongPress={200} />
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Momento successivo')} style={{ flex: 2 }} onPress={next} onLongPress={() => setHeld(true)} onPressOut={() => setHeld(false)} delayLongPress={200} />
      </View>
      {typing ? <Pressable accessibilityRole="button" accessibilityLabel={tl('Chiudi la tastiera')} onPress={() => Keyboard.dismiss()} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(0,0,0,0.35)' }} /> : null}
      <View pointerEvents={held ? 'none' : 'box-none'} style={{ paddingTop: insets.top + 8, paddingHorizontal: 10, opacity: held ? 0 : 1 }}>
        {/* miniature delle foto, appena visibili in alto: tocca per saltare; la linea sotto la corrente mostra lo scorrere del tempo */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: -2 }}>
          {stories.map((s, k) => (
            <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={tl('Vai al momento {0}', k + 1)} accessibilityState={{ selected: k === i }} onPress={() => setI(k)} hitSlop={6}
              style={{ width: k === i ? 34 : 28, opacity: k === i ? 1 : 0.55 }}>
              <View style={{ height: k === i ? 22 : 16, borderRadius: 7, overflow: 'hidden', borderWidth: k === i ? 1.5 : 0, borderColor: '#fff', backgroundColor: '#222' }}>
                {s.kind === 'photo' ? <Image source={{ uri: s.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  : s.kind === 'text' ? <LinearGradient colors={s.bg ?? ['#6c8cff', '#3b2a7a']} style={{ flex: 1 }} />
                  : <VideoPoster uri={s.uri} poster={s.poster} width={34} height={22} />}
              </View>
              {k === i ? <View style={{ height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginTop: 3, overflow: 'hidden' }}><View style={{ width: `${Math.min(100, p * 100)}%`, height: 2, backgroundColor: '#fff' }} /></View> : null}
            </Pressable>
          ))}
        </View>
        <Row style={{ marginTop: 10 }} gap={10}>
          <UserAvatar name={cur.author} size={36} link={false} />
          <View style={{ flex: 1 }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{mine ? tl('Il tuo recap') : cur.author}</Text><Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{tl(ago(cur.ts, Date.now()))}</Text></View>
          {cur.kind === 'video' ? <Pressable accessibilityRole="button" accessibilityLabel={sound ? tl('Spegni il volume') : tl('Attiva il volume')} onPress={() => setSound((v) => !v)} hitSlop={10} style={{ padding: 6 }}><Icon name={sound ? 'volume' : 'volume-off'} size={22} color="#fff" /></Pressable> : null}
          {mine ? <Pressable accessibilityRole="button" accessibilityLabel={tl('Impostazioni del momento')} onPress={() => setOpts(true)} hitSlop={10} style={{ padding: 6 }}><Icon name="gear" size={22} color="#fff" /></Pressable> : null}
          {mine ? <Pressable accessibilityRole="button" accessibilityLabel={tl('Aggiungi al recap')} onPress={() => { onClose(); go('storyCreate'); }} hitSlop={10} style={{ padding: 6 }}><Icon name="plus" size={24} color="#fff" /></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Chiudi')} onPress={close} hitSlop={10} style={{ padding: 6 }}><Icon name="x" size={24} color="#fff" /></Pressable>
        </Row>
      </View>
      <View style={{ flex: 1 }} pointerEvents="none" />
      <View pointerEvents={held ? 'none' : 'auto'} style={{ opacity: held ? 0 : 1, paddingHorizontal: 14, paddingTop: 8, paddingBottom: (kb.height > 0 ? kb.height : 0) + 8, backgroundColor: typing ? 'rgba(0,0,0,0.55)' : 'transparent' }}>
        {mine ? (
          <Pressable accessibilityRole="button" onPress={() => setViewers(true)} style={{ alignSelf: 'center', flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 }}>
            <Icon name="eye" size={18} color="#fff" /><Text style={{ color: '#fff', fontWeight: '800' }}>{tl('{0} visualizzazioni', viewerList.length)}</Text>
          </Pressable>
        ) : (
          <Row gap={10}>
            <TextInput value={reply} onChangeText={setReply} onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} onSubmitEditing={() => send(reply)} returnKeyType="send" placeholder={tl('Rispondi a {0}…', cur.author.split(' ')[0])} placeholderTextColor="rgba(255,255,255,0.7)" accessibilityLabel={tl('Rispondi al recap')} style={{ flex: 1, color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 }} />
            <Pressable accessibilityRole="button" accessibilityLabel={tl('Mi piace al recap')} onPress={() => send(tl('mi piace'))} hitSlop={8} style={{ padding: 8 }}><Icon name="heart" size={26} color="#fff" /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={tl('Invia')} onPress={() => send(reply)} hitSlop={8} style={{ padding: 8 }}><Icon name="send" size={24} color="#fff" /></Pressable>
          </Row>
        )}
      </View>
      <Sheet visible={opts} title={tl('Impostazioni del momento')} onClose={() => setOpts(false)}>
        <Body bold style={{ marginBottom: 6 }}>{tl('Quanto resta')}</Body>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
          {(['day', 'week', 'moment'] as const).map((k) => <Pill key={k} label={tl(k === 'day' ? '24 ore' : k === 'week' ? '7 giorni' : 'Fisso nel profilo')} on={(cur.keep ?? 'day') === k} onPress={() => net.patch({ stories: (net.stories ?? []).map((x) => (x.id === cur.id ? { ...x, keep: k === 'day' ? undefined : k } : x)) })} />)}
        </Row>
        <Item onPress={() => { setOpts(false); setViewers(true); }}><Row><Body style={{ flex: 1 }}>{tl('Chi ha visto il recap')}</Body><Body muted>{cur.views.length}</Body></Row></Item>
        <Btn style={{ marginTop: 12 }} ghost danger icon="trash" title={tl('Elimina questo momento')} onPress={() => { setOpts(false); remove(); }} />
        <Btn style={{ marginTop: 8 }} icon="plus" title={tl('Aggiungi un altro momento')} onPress={() => { setOpts(false); onClose(); go('storyCreate'); }} />
      </Sheet>
      <Sheet visible={viewers} title={tl('Chi ha visto il recap')} onClose={() => setViewers(false)}>
        {viewerList.length === 0 ? <Body muted>{tl('Nessuno l’ha ancora visto.')}</Body> : viewerList.map((n, k) => (
          <Item key={n} last={k === viewerList.length - 1}><Row gap={10}><UserAvatar name={n} size={34} /><Body bold>{n}</Body></Row></Item>
        ))}
      </Sheet>
    </Animated.View>
    </View>
  );
}

import { mapsUrl } from '@/lib/maps';
import type { Sponsor } from '@/store/network';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Linking, PanResponder, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/T';

import { SharePostSheet } from '@/components/feed/SharePostSheet';
import { UserAvatar, openSheet } from '@/components/network';
import { go } from '@/lib/nav';
import { toast } from '@/store/toast';
import { t as tl } from '@/i18n/core';
import { weekdayShortDate } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { addSignal, type ThemeWeights } from '@/lib/relevance';
import { SWIPE_SIGNAL, dwellSignal, pickMixed, rankedPool, record, remaining, undoLast, type DeckCard, type SwipeRec } from '@/lib/swipeDeck';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';

export type SwipeCandidate = DeckCard & { /** per idee e servizi: dove porta il pulsante «apri» */ link?: { page: string; params: Record<string, string> }; /** inserzione di un'attività */ sponsor?: Sponsor; tag?: string; uri?: string; poster?: string; /** foto del carosello: nello Swipe non si scorrono, si scelgono */ uris?: string[]; /** file incluso nell'app (require) */ asset?: number; media?: 'photo' | 'video' | null };
const buzz = () => { if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined); };
/** Quando compare la scritta piena («MI INTERESSA») la scelta è presa: il gesto si completa da solo. Prima, il post torna al centro. */
const THRESHOLD = 64;

/** Prossima carta: ogni cinque scelte tocca a un'inserzione (se ce n'è una non ancora vista), altrimenti la scelta normale per interesse. */
function pickNext(list: SwipeCandidate[], sw: SwipeRec[] | undefined, weights: ThemeWeights | undefined, me: string, n: number): SwipeCandidate | null {
  const swiped = new Set((sw ?? []).map((r) => r.key));
  const ads = list.filter((c) => c.sponsor && !swiped.has(c.key));
  if (ads.length && n % 5 === 3) return ads[0];
  return pickMixed(rankedPool(list.filter((c) => !c.sponsor), sw, weights, me), n) as SwipeCandidate | null;
}

/** Pulsante tondo della colonna di azioni a destra. */
function RailBtn({ icon, label, onPress, on }: { icon: string; label: string; onPress: () => void; on?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!on }} onPress={onPress} hitSlop={6} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.92 : 1 }] })}>
      <Icon name={icon} size={25} color={on ? '#ff3b5c' : '#fff'} fill={on ? '#ff3b5c' : 'none'} />
    </Pressable>
  );
}

type Vid = { rate: (r: number) => void; toggle: () => boolean; seek: (f: number) => void; frac: () => number };
/** Video del post: parte da solo, muto finché non attivi l'audio, in loop. */
function DeckVideo({ source, muted, controls, poster }: { source: number | { uri: string }; muted: boolean; controls: React.MutableRefObject<Vid | null>; poster?: string }) {
  const [shown, setShown] = useState(false);
  const p = useVideoPlayer(source, (pl) => { pl.loop = true; pl.muted = true; pl.play(); });
  useEffect(() => { p.muted = muted; }, [p, muted]);
  useEffect(() => {
    controls.current = {
      rate: (r) => { p.playbackRate = r; },
      toggle: () => { if (p.playing) { p.pause(); return false; } p.play(); return true; },
      seek: (f) => { const d = p.duration || 0; if (d > 0) p.currentTime = Math.max(0, Math.min(d, f * d)); },
      frac: () => (p.duration > 0 ? p.currentTime / p.duration : 0),
    };
    return () => { controls.current = null; };
  }, [p, controls]);
  return (
    <View style={{ width: '100%', height: '100%' }}>
      {poster ? <Image source={{ uri: poster }} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} contentFit="cover" cachePolicy="memory-disk" transition={0} /> : null}
      <VideoView player={p} pointerEvents="none" style={{ width: '100%', height: '100%', opacity: shown || !poster ? 1 : 0 }} nativeControls={false} contentFit="cover" onFirstFrameRender={() => setShown(true)} />
    </View>
  );
}

/**
 * Swipe a schermo intero: si vede solo il post, come nel recap. A sinistra «mi interessa», a destra «non mi interessa».
 * Toccando il post compare la spiegazione.
 */
export function SwipeDeck({ cards, onClose, onDismiss, backdrop, startKey }: { cards: SwipeCandidate[]; onClose: () => void; /** chiusura tirando giù (come i recap): se manca si usa onClose */ onDismiss?: () => void; /** schermata di partenza, che si vede dietro mentre tiri giù */ backdrop?: string | null; startKey?: string }) {
  const me = useApp((s) => s.account.name);
  const swipes = useNet((s) => s.swipes);
  const weights = useNet((s) => s.themeWeights);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [help, setHelp] = useState(false);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [fast, setFast] = useState(false);
  const [prog, setProg] = useState(0);
  const vid = useRef<Vid | null>(null);
  const shownAt = useRef(Date.now());
  const maxFrac = useRef(0);
  const [pic, setPic] = useState(0);
  const lastTap = useRef(0);
  const x = useRef(new Animated.Value(0)).current;
  const [sharing, setSharing] = useState(false);
  const [startDone, setStartDone] = useState(false);
  const dragY = useRef(new Animated.Value(0)).current;
  const dragRad = dragY.interpolate({ inputRange: [0, 200], outputRange: [0, 24], extrapolate: 'clamp' });
  const donated = useNet((s) => s.dailyPoint.lastGiven === weekdayShortDate());
  /* se arrivi toccando un contenuto, si parte proprio da quello (finché non lo scegli) */
  const [forced, setForced] = useState<SwipeCandidate | null>(null);
  const computed = useMemo(() => {
    /* il contenuto toccato si vede SEMPRE per primo, anche se l'avevi già scelto in passato (come un reel che si apre) */
    const first = startKey && !startDone ? cards.find((c) => c.key === startKey) : undefined;
    if (first) return first;
    return pickNext(cards as SwipeCandidate[], swipes, weights, me, (swipes ?? []).length);
  }, [cards, swipes, weights, me, startKey, startDone]);
  /* dopo una scelta la carta pronta sotto passa subito davanti; il salvataggio (e il ricalcolo pesante) arriva dopo, a carta già a schermo */
  const card = forced ?? computed;
  const liked = useNet((s) => !!card && s.likedPosts.includes(card.key));
  const left = remaining(cards, swipes, weights, me);
  /* la carta successiva è già pronta sotto (foto o anteprima del video): quando la corrente se ne va, c'è subito qualcosa */
  const upcoming: SwipeCandidate | null = useMemo(() => (card ? pickNext(cards as SwipeCandidate[], [...(swipes ?? []), { key: card.key, dir: 'yes', ts: 0 }], weights, me, (swipes ?? []).length + 1) : null), [cards, swipes, weights, me, card?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const upcomingUri = upcoming ? (upcoming.media === 'video' ? upcoming.poster : upcoming.uris?.[0] ?? upcoming.uri) : undefined;
  useLayoutEffect(() => { x.setValue(0); }, [card?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const cardRef = useRef(card); cardRef.current = card;
  const upRef = useRef(upcoming); upRef.current = upcoming;
  const isVideo = !!card && card.media === 'video' && (!!card.asset || !!card.uri);
  /* le foto (e le anteprime dei video) dei prossimi post si scaricano in anticipo: niente attesa quando scegli */
  useEffect(() => {
    const seen = new Set((swipes ?? []).map((r) => r.key));
    const urls = cards.filter((c) => !seen.has(c.key) && c.key !== card?.key).slice(0, 14).flatMap((c) => (c.media === 'video' ? [c.poster] : c.uris ?? [c.uri])).filter((u): u is string => !!u);
    if (urls.length) void Image.prefetch(urls, 'memory-disk').catch(() => undefined);
    /* i file dei prossimi video si scaldano in anticipo (conta soprattutto con Expo, che li serve dal computer) */
    cards.filter((c) => c.media === 'video' && !seen.has(c.key) && c.key !== card?.key && c.uri && /^https?:/.test(c.uri)).slice(0, 3).forEach((c) => { fetch(c.uri as string).then((r) => r.blob()).catch(() => undefined); });
  }, [card?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  /* nuovo post: azzera il cronometro di visione e lo stato del video */
  useEffect(() => { shownAt.current = Date.now(); maxFrac.current = 0; setPaused(false); setFast(false); setProg(0); setPic(0); }, [card?.key]);
  useEffect(() => {
    if (!isVideo) return;
    const h = setInterval(() => { const f = vid.current?.frac() ?? 0; setProg((o) => (Math.abs(o - f) > 0.015 ? f : o)); if (f > maxFrac.current) maxFrac.current = f; }, 500);
    return () => clearInterval(h);
  }, [isVideo, card?.key]);
  /** Il tempo passato sul post entra nell'algoritmo, anche se non fai uno swipe. */
  const dwellFor = (c: SwipeCandidate) => dwellSignal(Date.now() - shownAt.current, c.media === 'video' ? maxFrac.current : undefined);
  const leave = () => {
    const c = cardRef.current; if (c) { const d = dwellFor(c); if (d > 0) { const st = useNet.getState(); st.patch({ themeWeights: addSignal(st.themeWeights, `${c.text} ${c.tag ?? ''}`, d) }); } }
    onClose();
  };

  const decide = (dir: 'yes' | 'no') => {
    const c = cardRef.current; if (!c) return;
    buzz();
    setStartDone(true);
    const dw = dwellFor(c);
    if (upRef.current) setForced(upRef.current);
    setTimeout(() => {
      const st = useNet.getState();
      st.patch({ swipes: record(st.swipes, c.key, dir, Date.now()), themeWeights: addSignal(st.themeWeights, `${c.text} ${c.tag ?? ''}`, dir === 'yes' ? SWIPE_SIGNAL + dw : -SWIPE_SIGNAL + dw) });
      if (dir === 'yes') st.bumpReach(c.key, 'like');
    }, 280);
    /* x resta a fine corsa: la carta scelta non ricompare per un attimo; si azzera quando arriva la nuova */
  };
  const fling = (dir: 'yes' | 'no') => Animated.timing(x, { toValue: dir === 'yes' ? -width * 1.2 : width * 1.2, duration: 180, useNativeDriver: false }).start(() => decide(dir));
  const leaveRef = useRef(leave); leaveRef.current = leave;
  /* tirare giù con il dito equivale a premere la X */
  const pullDown = (g: { dx: number; dy: number }) => g.dy > 10 && g.dy > Math.abs(g.dx) * 1.5;
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_e, g) => (Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2) || pullDown(g),
    onMoveShouldSetPanResponder: (_e, g) => (Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2) || pullDown(g),
    onPanResponderMove: (e, g) => { if (g.dy > Math.abs(g.dx) * 1.5) { x.setValue(0); dragY.setValue(Math.max(0, g.dy)); } else { dragY.setValue(0); x.setValue(g.dx); } },
    onPanResponderRelease: (_e, g) => {
      if (g.dy > 110 && g.dy > Math.abs(g.dx) * 1.5) { Animated.timing(dragY, { toValue: 900, duration: 170, useNativeDriver: false }).start(() => { const c = cardRef.current; if (c) { const d = dwellSignal(Date.now() - shownAt.current, c.media === 'video' ? maxFrac.current : undefined); if (d > 0) { const st = useNet.getState(); st.patch({ themeWeights: addSignal(st.themeWeights, `${c.text} ${c.tag ?? ''}`, d) }); } } (onDismiss ?? onClose)(); setTimeout(() => dragY.setValue(0), 400); }); return; }
      if (g.dy > 0 && Math.abs(g.dx) < 24) { Animated.spring(dragY, { toValue: 0, useNativeDriver: false, friction: 8 }).start(); }
      if (g.dx <= -THRESHOLD || g.vx < -0.9) fling('yes');
      else if (g.dx >= THRESHOLD || g.vx > 0.9) fling('no');
      else Animated.spring(x, { toValue: 0, useNativeDriver: false, friction: 7 }).start();
    },
  })).current;
  const rot = x.interpolate({ inputRange: [-width, 0, width], outputRange: ['-9deg', '0deg', '9deg'] });
  const yesOp = x.interpolate({ inputRange: [-THRESHOLD, -16, 0], outputRange: [1, 0.1, 0], extrapolate: 'clamp' });
  const noOp = x.interpolate({ inputRange: [0, 16, THRESHOLD], outputRange: [0, 0.1, 1], extrapolate: 'clamp' });
  const undo = () => { const st = useNet.getState(); const u = undoLast(st.swipes); if (u.undone) { setForced(null); st.patch({ swipes: u.swipes }); buzz(); } };
  const close = (
    <Pressable accessibilityRole="button" accessibilityLabel={tl('Chiudi')} onPress={leave} hitSlop={12} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={20} color="#fff" /></Pressable>
  );

  if (!card) {
    return (
      <View style={{ flex: 1, backgroundColor: '#07080d', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 }}>
        <View style={{ position: 'absolute', top: insets.top + 10, end: 16 }}>{close}</View>
        <Icon name="sparkle" size={38} color="#8fa4ff" />
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center' }}>{tl('Per ora hai visto tutto')}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>{tl('Quando ci saranno nuovi post che potrebbero interessarti, li trovi qui. I tuoi preferiti sono già in «Per te».')}</Text>
        {(swipes ?? []).length ? <Pressable accessibilityRole="button" onPress={undo} style={{ marginTop: 10 }}><Text style={{ color: '#8fa4ff', fontWeight: '800' }}>{tl('Annulla l’ultima scelta')}</Text></Pressable> : null}
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {backdrop ? <Image source={{ uri: backdrop }} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} contentFit="cover" transition={0} /> : null}
      <Animated.View style={{ flex: 1, backgroundColor: '#000', overflow: 'hidden', borderRadius: dragRad, transform: [{ translateY: dragY }] }}>
      {upcomingUri ? <Image source={{ uri: upcomingUri }} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} contentFit="cover" cachePolicy="memory-disk" transition={0} /> : null}
      <Animated.View {...pan.panHandlers} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, transform: [{ translateX: x }, { rotate: rot }] }}>
        <Pressable accessibilityRole="button" accessibilityLabel={isVideo ? tl('Video di {0}. Tocca per mettere in pausa o riprendere, tieni premuto per accelerare', card.author) : tl('Post di {0}', card.author)}
          onPress={() => {
            const now = Date.now();
            /* doppio tocco su un carosello: foto successiva; un tocco su un video: pausa o riprendi */
            if (card.uris && card.uris.length > 1 && now - lastTap.current < 300) { lastTap.current = 0; setPic((i) => (i + 1) % card.uris!.length); buzz(); return; }
            lastTap.current = now;
            if (isVideo) setPaused(!(vid.current?.toggle() ?? true));
          }}
          delayLongPress={260} onLongPress={() => { if (isVideo) { vid.current?.rate(2); setFast(true); } }} onPressOut={() => { if (fast) { vid.current?.rate(1); setFast(false); } }} style={{ flex: 1 }}>
          {isVideo ? <DeckVideo key={card.key} source={card.asset ?? { uri: card.uri as string }} muted={muted} controls={vid} poster={card.poster} /> : card.asset ? <Image key={card.key} recyclingKey={card.key} source={card.asset} pointerEvents="none" style={{ width: '100%', height: '100%' }} contentFit="cover" /> : card.uri ? <Image key={card.key} recyclingKey={card.key} source={{ uri: card.uris?.[pic] ?? card.uri }} pointerEvents="none" style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" priority="high" transition={0} /> : (
            <LinearGradient colors={['#4a3bd1', '#1b1f3a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, padding: 28, justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900' }}>{card.text}</Text>
            </LinearGradient>
          )}
          <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']} pointerEvents="none" style={{ position: 'absolute', top: 0, start: 0, end: 0, height: insets.top + 110 }} />
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']} pointerEvents="none" style={{ position: 'absolute', bottom: 0, start: 0, end: 0, height: 330 }} />
        </Pressable>
        {(card as SwipeCandidate).sponsor ? (
          <>
            <View pointerEvents="none" style={{ position: 'absolute', start: 16, top: insets.top + 64, paddingHorizontal: 12, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.4 }}>{tl('Sponsorizzato')}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel={`${(card as SwipeCandidate).sponsor!.cta}: ${card.author}`} onPress={() => { Linking.openURL(mapsUrl(`${card.author} ${(card as SwipeCandidate).sponsor!.place}`, Platform.OS)).catch(() => undefined); }} style={{ position: 'absolute', start: 18, end: 84, bottom: insets.bottom + 40, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#111', fontSize: 15.5, fontWeight: '800' }}>{tl((card as SwipeCandidate).sponsor!.cta)}</Text>
            </Pressable>
          </>
        ) : null}
        <View pointerEvents="none" style={{ position: 'absolute', start: 18, end: 84, bottom: insets.bottom + 104 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <UserAvatar name={card.author} size={38} />
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 17, flex: 1 }}>{card.author}</Text>
            {card.tag ? <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.22)' }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{card.tag}</Text></View> : null}
          </View>
          {card.uri || card.asset ? <Text numberOfLines={4} style={{ color: '#fff', fontSize: 16, marginTop: 10, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 }}>{card.text}</Text> : null}
        </View>
        {card.uris && card.uris.length > 1 ? (
          <View style={{ position: 'absolute', top: insets.top + 60, alignSelf: 'center', flexDirection: 'row', gap: 10, padding: 8, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}>
            {card.uris.map((u, i) => (
              <Pressable key={u + i} onPress={() => setPic(i)} hitSlop={4} accessibilityRole="button" accessibilityState={{ selected: pic === i }} accessibilityLabel={tl('Foto {0} di {1}', i + 1, card.uris!.length)} style={{ width: 58, height: 76, borderRadius: 12, overflow: 'hidden', borderWidth: pic === i ? 3 : 1.5, borderColor: pic === i ? '#fff' : 'rgba(255,255,255,0.55)', opacity: pic === i ? 1 : 0.92 }}>
                <Image source={{ uri: u }} pointerEvents="none" style={{ width: '100%', height: '100%' }} contentFit="cover" />
              </Pressable>
            ))}
          </View>
        ) : null}
        {isVideo && paused ? <View pointerEvents="none" style={{ position: 'absolute', top: '42%', alignSelf: 'center', width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={34} color="#fff" /></View> : null}
        {isVideo && fast ? <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 60, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)' }}><Text style={{ color: '#fff', fontWeight: '900' }}>{tl('Velocità 2×')}</Text></View> : null}
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 90, end: 20, opacity: yesOp, borderWidth: 4, borderColor: '#2fd58a', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5, transform: [{ rotate: '10deg' }] }}><Text style={{ color: '#2fd58a', fontWeight: '900', fontSize: 26 }}>{tl('MI INTERESSA')}</Text></Animated.View>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 90, start: 20, opacity: noOp, borderWidth: 4, borderColor: '#ff5d6c', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5, transform: [{ rotate: '-10deg' }] }}><Text style={{ color: '#ff5d6c', fontWeight: '900', fontSize: 26 }}>{tl('NON MI INTERESSA')}</Text></Animated.View>
      </Animated.View>

      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 10, start: 16, end: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.45)' }}><Text style={{ color: '#fff', fontSize: 12.5, fontWeight: '800' }}>{tl('{0} da scoprire', left)}</Text></View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {isVideo ? <Pressable accessibilityRole="button" accessibilityLabel={muted ? tl('Attiva l’audio') : tl('Spegni l’audio')} onPress={() => setMuted((m) => !m)} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}><Icon name={muted ? 'volume-off' : 'volume'} size={20} color="#fff" /></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Come funziona')} onPress={() => setHelp((v) => !v)} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}><Icon name="help" size={20} color="#fff" /></Pressable>
          {close}
        </View>
      </View>

      {isVideo ? (
        <View style={{ position: 'absolute', start: 18, end: 18, bottom: insets.bottom + 84, height: 28, justifyContent: 'center' }}>
          <Pressable accessibilityRole="adjustable" accessibilityLabel={tl('Avanza nel video')} hitSlop={{ top: 14, bottom: 14 }} onPress={(e) => { const w = width - 36; vid.current?.seek(Math.max(0, Math.min(1, e.nativeEvent.locationX / w))); }} style={{ height: 28, justifyContent: 'center' }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' }}><View style={{ width: `${Math.round(prog * 100)}%`, height: 4, borderRadius: 2, backgroundColor: '#fff' }} /></View>
          </Pressable>
        </View>
      ) : null}

      {card ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', end: 12, bottom: insets.bottom + 100, alignItems: 'center', gap: 16 }}>
          <RailBtn icon="heart" label={liked ? tl('Togli il mi piace') : tl('Mi piace')} on={liked} onPress={() => { useNet.getState().likePost(card.key); buzz(); }} />
          <RailBtn icon="comment" label={tl('Apri il post e i commenti')} onPress={() => { const l = (card as SwipeCandidate).link; if (l) go(l.page, l.params); else go('postPage', { key: card.key }); }} />
          <RailBtn icon="send" label={tl('Condividi nell’app')} onPress={() => setSharing(true)} />
          {!donated && card.author !== me ? <RailBtn icon="coin" label={tl('Dona il LifePoint di oggi')} onPress={() => openSheet('donate', { author: card.author, key: card.key })} /> : null}
        </View>
      ) : null}
      {card ? <SharePostSheet visible={sharing} onClose={() => setSharing(false)} author={card.author} text={card.text} media={card.media} uri={card.uri} likeKey={card.key} /> : null}

      <View pointerEvents="box-none" style={{ position: 'absolute', start: 0, end: 0, bottom: insets.bottom + 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 26 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Mi interessa')} onPress={() => fling('yes')} style={({ pressed }) => ({ width: 64, height: 64, borderRadius: 32, backgroundColor: '#2fd58a', alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.92 : 1 }] })}><Icon name="compass" size={28} color="#fff" /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Torna all’ultimo')} onPress={undo} disabled={!(swipes ?? []).length} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', opacity: (swipes ?? []).length ? 1 : 0.35 }}><Icon name="repeat" size={20} color="#fff" /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Non mi interessa')} onPress={() => fling('no')} style={({ pressed }) => ({ width: 64, height: 64, borderRadius: 32, backgroundColor: '#ff5d6c', alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.92 : 1 }] })}><Icon name="x" size={28} color="#fff" /></Pressable>
      </View>

      {help ? (
        <Pressable onPress={() => setHelp(false)} accessibilityRole="button" accessibilityLabel={tl('Chiudi la spiegazione')} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Icon name="arrow-left" size={34} color="#2fd58a" /><Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', flexShrink: 1 }}>{tl('Swipe a sinistra: mi interessa')}</Text></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', flexShrink: 1, textAlign: 'right' }}>{tl('Swipe a destra: non mi interessa')}</Text><Icon name="arrow-right" size={34} color="#ff5d6c" /></View>
          <Text style={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center', fontSize: 14 }}>{tl('Quelli che ti interessano tornano in «Per te», nell’ordine in cui li scegli. Gli altri, e quelli simili, non te li propongo più.')}</Text>
          <Text style={{ color: '#8fa4ff', fontWeight: '800' }}>{tl('Tocca per continuare')}</Text>
        </Pressable>
      ) : null}
      </Animated.View>
    </View>
  );
}

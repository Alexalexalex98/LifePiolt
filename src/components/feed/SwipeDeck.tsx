import { useVideoFx } from '@/hooks/use-video-fx';
import { cachedThumb, videoThumb } from '@/lib/videoThumb';
import { acquirePlayer, preloadPlayer, releaseAllPlayers, releaseExcept } from '@/lib/videoPool';
import { liveAccent } from '@/lib/liveTheme';
import type { VideoFx } from '@/lib/videoFx';
import { StoryFx } from '@/components/stories/StoryFx';
import { useIsFocused } from 'expo-router';
import { findItem, itemLine } from '@/lib/menu';
import { useMenus } from '@/store/menus';
import { mapsUrl } from '@/lib/maps';
import { postByKey } from '@/lib/network';
import type { Sponsor } from '@/store/network';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LogoLoader } from '@/components/LogoLoader';
import { Animated, AppState, Easing, Linking, PanResponder, Platform, Pressable, View, useWindowDimensions } from 'react-native';
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
import { SWIPE_SIGNAL, dedupeCards, dwellSignal, pickMixed, rankedPool, record, remaining, undoLast, type DeckCard, type SwipeRec } from '@/lib/swipeDeck';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';

export type SwipeCandidate = DeckCard & { /** per idee e servizi: dove porta il pulsante «apri» */ link?: { page: string; params: Record<string, string> }; /** inserzione di un'attività */ sponsor?: Sponsor; /** piatto del menù legato al contenuto */ menuItem?: string; tag?: string; uri?: string; poster?: string; /** foto del carosello: nello Swipe non si scorrono, si scelgono */ uris?: string[]; /** file incluso nell'app (require) */ asset?: number; media?: 'photo' | 'video' | null; /** filtri e ritocchi dell'editor */ fx?: { filter?: string; adj?: import('@/lib/stories').Adjust; video?: VideoFx } };
const buzz = () => { if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined); };
/** Quando compare la scritta piena («MI INTERESSA») la scelta è presa: il gesto si completa da solo. Prima, il post torna al centro. */
const THRESHOLD = 64;

/** Prossima carta: ogni cinque scelte tocca a un'inserzione (se ce n'è una non ancora vista), altrimenti la più adatta ai tuoi interessi (con video e foto a turno). */
function choose(pool: SwipeCandidate[], ads: SwipeCandidate[], n: number): SwipeCandidate | null {
  if (ads.length && n % 5 === 3) return ads[0];
  return pickMixed(pool, n) as SwipeCandidate | null;
}

/** Pulsante tondo della colonna di azioni a destra. */
function RailBtn({ icon, label, onPress, on, count, onCount }: { icon: string; label: string; onPress: () => void; on?: boolean; /** numero sotto il pulsante; se c'è onCount il numero è toccabile (es. chi ha messo mi piace) */ count?: number; onCount?: () => void }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!on }} onPress={onPress} hitSlop={6} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.92 : 1 }] })}>
      <Icon name={icon} size={25} color={on ? '#ff3b5c' : '#fff'} fill={on ? '#ff3b5c' : 'none'} />
    </Pressable>
    {count !== undefined ? <Pressable disabled={!onCount} onPress={onCount} hitSlop={8} accessibilityRole={onCount ? 'button' : 'text'} accessibilityLabel={`${label}: ${count}`}><Text style={{ color: '#fff', fontSize: 12.5, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 }}>{count}</Text></Pressable> : null}
    </View>
  );
}

type Vid = { rate: (r: number) => void; toggle: () => boolean; seek: (f: number) => void; frac: () => number };
/** Video del post: parte da solo, muto finché non attivi l'audio, in loop. */
function DeckVideo({ playerKey, source, muted, controls, poster, vfx }: { playerKey: string; vfx?: VideoFx; source: number | { uri: string }; muted: boolean; controls: React.MutableRefObject<Vid | null>; poster?: string }) {
  const [shown, setShown] = useState(false);
  /* `ready` = il video sta davvero andando (primo fotogramma o tempo che avanza): finché non lo e', si vede il caricamento */
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  /* il lettore può essere già pronto: l'ha caricato in anticipo la carta sotto */
  const p = useMemo(() => acquirePlayer(playerKey, source), [playerKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { p.play(); } catch { /* rilasciato */ } const f = setTimeout(() => setShown(true), 1200); return () => clearTimeout(f); }, [p]);
  useEffect(() => {
    const poll = setInterval(() => { try { if (p.currentTime > 0.05 || p.status === 'readyToPlay' && p.playing) setReady(true); } catch { /* rilasciato */ } }, 250);
    const slowT = setTimeout(() => { setSlow(true); try { p.play(); } catch { /* rilasciato */ } }, 6000);
    return () => { clearInterval(poll); clearTimeout(slowT); };
  }, [p]);
  useVideoFx(p, vfx);
  if (vfx?.mute) muted = true;
  /* uscendo dalla schermata (o con l'app in secondo piano) il video si ferma e il volume si toglie; al ritorno riparte solo se non l'avevi messo in pausa tu */
  const focused = useIsFocused();
  const resume = useRef(true);
  useEffect(() => {
    if (!focused) { resume.current = p.playing; p.pause(); p.muted = true; return; }
    p.muted = muted;
    if (resume.current) p.play();
  }, [p, muted, focused]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st !== 'active') { resume.current = p.playing; p.pause(); p.muted = true; } else if (focused) { p.muted = muted; if (resume.current) p.play(); } });
    return () => sub.remove();
  }, [p, muted, focused]);
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
      {/* su Android la superficie normale non segue rotazione e spostamento della carta e lascia l'ultimo fotogramma: qui serve la «textureView». Il video resta nascosto finché non c'è il primo fotogramma. */}
      <VideoView player={p} pointerEvents="none" surfaceType="textureView" style={{ width: '100%', height: '100%', opacity: shown ? 1 : 0 }} nativeControls={false} contentFit="cover" onFirstFrameRender={() => { setShown(true); setReady(true); }} />
      {!ready ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center', gap: 8 }}><LogoLoader size={64} />{slow ? <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 4 }}>{tl('Il video sta impiegando più del previsto…')}</Text> : null}</View> : null}
    </View>
  );
}

/**
 * Swipe a schermo intero: si vede solo il post, come nel recap. A sinistra «mi interessa», a destra «non mi interessa».
 * Toccando il post compare la spiegazione.
 */
export function SwipeDeck({ cards: cardsIn, onClose, onDismiss, backdrop, startKey }: { cards: SwipeCandidate[]; onClose: () => void; /** chiusura tirando giù (come i recap): se manca si usa onClose */ onDismiss?: () => void; /** schermata di partenza, che si vede dietro mentre tiri giù */ backdrop?: string | null; startKey?: string }) {
  const me = useApp((s) => s.account.name);
  /* niente carte doppie e niente carte la cui foto non si carica (si vedevano nere): spariscono e passa la prossima */
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const cards = useMemo(() => dedupeCards(cardsIn as SwipeCandidate[]).filter((c) => !broken.has(c.key)), [cardsIn, broken]);
  const markBroken = (k: string) => setBroken((s) => (s.has(k) ? s : new Set(s).add(k)));
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  /* le scelte si tengono qui, in locale, e si salvano tutte insieme dopo una pausa o all'uscita: salvare a ogni scelta faceva ricalcolare
     l'intera Home sotto lo Swipe e bloccava per un attimo il cambio di immagine */
  const [swipes, setSwipes] = useState(() => useNet.getState().swipes);
  const [weights, setWeights] = useState(() => useNet.getState().themeWeights);
  const swRef = useRef(swipes); swRef.current = swipes;
  const wRef = useRef(weights); wRef.current = weights;
  const reachQ = useRef<string[]>([]);
  const dirty = useRef(false);
  const flushT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = () => {
    if (flushT.current) { clearTimeout(flushT.current); flushT.current = null; }
    if (!dirty.current) return;
    dirty.current = false;
    const st = useNet.getState();
    st.patch({ swipes: swRef.current, themeWeights: wRef.current });
    reachQ.current.splice(0).forEach((k) => st.bumpReach(k, 'like'));
  };
  const flushRef = useRef(flush); flushRef.current = flush;
  const later = () => { dirty.current = true; if (flushT.current) clearTimeout(flushT.current); flushT.current = setTimeout(() => flushRef.current(), 3000); };
  useEffect(() => () => { flushRef.current(); }, []);
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
  const radV = useRef(new Animated.Value(0)).current; // angoli: unico valore che non può usare il driver nativo
  const dragRad = radV.interpolate({ inputRange: [0, 200], outputRange: [0, 24], extrapolate: 'clamp' });
  const donated = useNet((s) => s.dailyPoint.lastGiven === weekdayShortDate());
  /* se arrivi toccando un contenuto, si parte proprio da quello (finché non lo scegli) */
  const [forced, setForced] = useState<SwipeCandidate | null>(null);
  /* la classifica si calcola UNA volta a ogni scelta e serve per la carta, per quella dopo e per il conteggio (prima si rifaceva tre volte) */
  const pool = useMemo(() => rankedPool((cards as SwipeCandidate[]).filter((c) => !c.sponsor), swipes, weights, me), [cards, swipes, weights, me]);
  const adsLeft = useMemo(() => { const done = new Set((swipes ?? []).map((r) => r.key)); return (cards as SwipeCandidate[]).filter((c) => c.sponsor && !done.has(c.key)); }, [cards, swipes]);
  const computed = useMemo(() => {
    /* il contenuto toccato si vede SEMPRE per primo, anche se l'avevi già scelto in passato (come un reel che si apre) */
    const first = startKey && !startDone ? cards.find((c) => c.key === startKey) : undefined;
    if (first) return first;
    return choose(pool, adsLeft, (swipes ?? []).length);
  }, [cards, pool, adsLeft, swipes, startKey, startDone]);
  /* dopo una scelta la carta pronta sotto passa subito davanti; il salvataggio (e il ricalcolo pesante) arriva dopo, a carta già a schermo */
  const card = forced ?? computed;
  const liked = useNet((s) => !!card && s.likedPosts.includes(card.key));
  const left = pool.length + adsLeft.length;
  /* la carta successiva è già pronta sotto (foto o anteprima del video): quando la corrente se ne va, c'è subito qualcosa */
  const upcoming: SwipeCandidate | null = useMemo(() => (card ? choose(pool.filter((c) => c.key !== card.key), adsLeft.filter((c) => c.key !== card.key), (swipes ?? []).length + 1) : null), [pool, adsLeft, swipes, card?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const likeCount = useNet((x) => (card ? postByKey(card.key)?.likes ?? 0 : 0));
  const commentCount = useNet((x) => (card ? (x.comments?.[card.key] ?? []).length : 0));
  const dishItem = useMenus((m) => findItem(m.byOwner[card?.author ?? ''], (card as SwipeCandidate | null)?.menuItem));
  const dishLine = dishItem ? itemLine(dishItem) : null;
  const isSponsored = !!(card as SwipeCandidate | null)?.sponsor;
  /* i video senza anteprima ne ricevono una subito: così non si vede mai il nero ad aspettare il primo fotogramma */
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const posterOf = (c: SwipeCandidate | null | undefined) => (c ? c.poster ?? thumbs[c.key] ?? (c.uri ? cachedThumb(c.uri) : undefined) : undefined);
  const curUnder = card ? (card.media === 'video' ? posterOf(card as SwipeCandidate) : card.uris?.[pic] ?? card.uri) : undefined;
  const upcomingUri = upcoming ? (upcoming.media === 'video' ? posterOf(upcoming) : upcoming.uris?.[0] ?? upcoming.uri) : undefined;
  useLayoutEffect(() => { x.setValue(0); }, [card?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const cardRef = useRef(card); cardRef.current = card;
  const upRef = useRef(upcoming); upRef.current = upcoming;
  const isVideo = !!card && card.media === 'video' && (!!card.asset || !!card.uri);
  /* le foto (e le anteprime dei video) dei prossimi post si scaricano in anticipo: niente attesa quando scegli */
  useEffect(() => {
    const seen = new Set((swipes ?? []).map((r) => r.key));
    const urls = cards.filter((c) => !seen.has(c.key) && c.key !== card?.key).slice(0, 6).flatMap((c) => (c.media === 'video' ? [c.poster] : c.uris ?? [c.uri])).filter((u): u is string => !!u);
    if (urls.length) void Image.prefetch(urls, 'memory-disk').catch(() => undefined);
    /* i file dei prossimi video si scaldano in anticipo (conta soprattutto con Expo, che li serve dal computer) */
    cards.filter((c) => c.media === 'video' && !seen.has(c.key) && c.key !== card?.key && c.uri && /^https?:/.test(c.uri)).slice(0, 1).forEach((c) => { fetch(c.uri as string).then((r) => r.blob()).catch(() => undefined); });
  }, [card?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const seen = new Set((swipes ?? []).map((r) => r.key));
    const want = [card, upcoming, ...cards.filter((c) => !seen.has(c.key)).slice(0, 4)].filter((c): c is SwipeCandidate => !!c && c.media === 'video' && !c.poster && !c.asset && !!c.uri);
    want.forEach((c) => { if (!thumbs[c.key]) void videoThumb(c.uri as string).then((u) => { if (u) setThumbs((t) => (t[c.key] ? t : { ...t, [c.key]: u })); }); });
  }, [card?.key, upcoming?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  /* il video che arriva dopo si carica già adesso (in pausa); gli altri lettori si liberano */
  useEffect(() => {
    const keep: string[] = [];
    if (card && card.media === 'video' && (card.asset || card.uri)) keep.push(card.key);
    if (upcoming && upcoming.media === 'video' && (upcoming.asset || upcoming.uri)) { keep.push(upcoming.key); preloadPlayer(upcoming.key, upcoming.asset ?? { uri: upcoming.uri as string }); }
    releaseExcept(keep);
  }, [card?.key, upcoming?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => releaseAllPlayers(), []);
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
    const c = cardRef.current; if (c) { const d = dwellFor(c); if (d > 0) { wRef.current = addSignal(wRef.current, `${c.text} ${c.tag ?? ''}`, d); dirty.current = true; } }
    flush();
    onClose();
  };

  const decide = (dir: 'yes' | 'no') => {
    const c = cardRef.current; if (!c) return;
    buzz();
    setStartDone(true);
    const dw = dwellFor(c);
    if (upRef.current) setForced(upRef.current);
    setSwipes((x) => record(x, c.key, dir, Date.now()));
    setWeights((w) => addSignal(w, `${c.text} ${c.tag ?? ''}`, dir === 'yes' ? SWIPE_SIGNAL + dw : -SWIPE_SIGNAL + dw));
    if (dir === 'yes') reachQ.current.push(c.key);
    later();
    /* x resta a fine corsa: la carta scelta non ricompare per un attimo; si azzera quando arriva la nuova */
  };
  const fling = (dir: 'yes' | 'no') => Animated.timing(x, { toValue: dir === 'yes' ? -width * 1.2 : width * 1.2, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => decide(dir));
  const leaveRef = useRef(leave); leaveRef.current = leave;
  /* tirare giù con il dito equivale a premere la X */
  const pullDown = (g: { dx: number; dy: number }) => g.dy > 10 && g.dy > Math.abs(g.dx) * 1.5;
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_e, g) => (Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2) || pullDown(g),
    onMoveShouldSetPanResponder: (_e, g) => (Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2) || pullDown(g),
    onPanResponderGrant: () => { x.stopAnimation(); dragY.stopAnimation(); },
    onPanResponderMove: (e, g) => { if (g.dy > Math.abs(g.dx) * 1.5) { x.setValue(0); dragY.setValue(Math.max(0, g.dy)); radV.setValue(Math.max(0, g.dy)); } else { dragY.setValue(0); radV.setValue(0); x.setValue(g.dx); } },
    onPanResponderRelease: (_e, g) => {
      if (g.dy > 110 && g.dy > Math.abs(g.dx) * 1.5) { Animated.timing(dragY, { toValue: 900, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => { const c = cardRef.current; if (c) { const d = dwellSignal(Date.now() - shownAt.current, c.media === 'video' ? maxFrac.current : undefined); if (d > 0) { wRef.current = addSignal(wRef.current, `${c.text} ${c.tag ?? ''}`, d); dirty.current = true; } } flushRef.current(); (onDismiss ?? onClose)(); setTimeout(() => { dragY.setValue(0); radV.setValue(0); }, 400); }); return; }
      if (g.dy > 0 && Math.abs(g.dx) < 24) { Animated.spring(dragY, { toValue: 0, useNativeDriver: true, friction: 9, tension: 120 }).start(); radV.setValue(0); }
      if (g.dx <= -THRESHOLD || g.vx < -0.5) fling('yes');
      else if (g.dx >= THRESHOLD || g.vx > 0.5) fling('no');
      else Animated.spring(x, { toValue: 0, useNativeDriver: true, friction: 8, tension: 140, velocity: g.vx }).start();
    },
  })).current;
  const rot = x.interpolate({ inputRange: [-width, 0, width], outputRange: ['-9deg', '0deg', '9deg'] });
  const yesOp = x.interpolate({ inputRange: [-THRESHOLD, -16, 0], outputRange: [1, 0.1, 0], extrapolate: 'clamp' });
  const noOp = x.interpolate({ inputRange: [0, 16, THRESHOLD], outputRange: [0, 0.1, 1], extrapolate: 'clamp' });
  const undo = () => { const u = undoLast(swRef.current); if (u.undone) { setForced(null); setSwipes(u.swipes); later(); buzz(); } };
  const close = (
    <Pressable accessibilityRole="button" accessibilityLabel={tl('Chiudi')} onPress={leave} hitSlop={12} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={20} color="#fff" /></Pressable>
  );

  if (!card) {
    return (
      <View style={{ flex: 1, backgroundColor: '#07080d', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 }}>
        <View style={{ position: 'absolute', top: insets.top + 10, end: 16 }}>{close}</View>
        <Icon name="sparkle" size={38} color={liveAccent()} />
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center' }}>{tl('Per ora hai visto tutto')}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>{tl('Quando ci saranno nuovi post che potrebbero interessarti, li trovi qui. I tuoi preferiti sono già in «Per te».')}</Text>
        {(swipes ?? []).length ? <Pressable accessibilityRole="button" onPress={undo} style={{ marginTop: 10 }}><Text style={{ color: liveAccent(), fontWeight: '800' }}>{tl('Annulla l’ultima scelta')}</Text></Pressable> : null}
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {backdrop ? <Image source={{ uri: backdrop }} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} contentFit="cover" transition={0} /> : null}
      <Animated.View style={{ flex: 1, backgroundColor: '#000', overflow: 'hidden', borderRadius: dragRad, transform: [{ translateY: dragY }] }}>
      {upcomingUri ? <Image source={{ uri: upcomingUri }} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} contentFit="cover" cachePolicy="memory-disk" transition={0} /> : null}
      {/* sotto la carta c'è sempre la sua stessa immagine (o l'anteprima del video): finché quella sopra non è pronta non si vede mai un'altra foto */}
      {curUnder ? <Image key={'under:' + card.key} source={{ uri: curUnder }} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} contentFit="cover" cachePolicy="memory-disk" transition={0} /> : null}
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
          {card.fx ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, zIndex: 1 }}><StoryFx s={card.fx as never} uri={card.media === 'video' ? undefined : card.uris?.[pic] ?? card.uri} /></View> : null}
          {isVideo ? <DeckVideo key={card.key} playerKey={card.key} vfx={card.fx?.video} source={card.asset ?? { uri: card.uri as string }} muted={muted} controls={vid} poster={posterOf(card as SwipeCandidate)} /> : card.asset ? <Image key={card.key} recyclingKey={card.key} source={card.asset} pointerEvents="none" style={{ width: '100%', height: '100%' }} contentFit="cover" /> : card.uri ? <Image key={card.key} recyclingKey={card.key} source={{ uri: card.uris?.[pic] ?? card.uri }} pointerEvents="none" style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" priority="high" transition={0} onLoad={() => setLoadedKey(card.key)} onError={() => markBroken(card.key)} /> : (
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
            <Pressable accessibilityRole="button" accessibilityLabel={`${(card as SwipeCandidate).sponsor!.cta}: ${card.author}`} onPress={() => { Linking.openURL(mapsUrl(`${card.author} ${(card as SwipeCandidate).sponsor!.place}`, Platform.OS)).catch(() => undefined); }} style={{ position: 'absolute', start: 18, end: 84, bottom: insets.bottom + 120, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#111', fontSize: 15.5, fontWeight: '800' }}>{tl((card as SwipeCandidate).sponsor!.cta)}</Text>
            </Pressable>
          </>
        ) : null}
        <View pointerEvents="none" style={{ position: 'absolute', start: 18, end: 84, bottom: insets.bottom + (isSponsored ? 184 : 104) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <UserAvatar name={card.author} size={38} />
            <Text numberOfLines={1} style={{ color: '#fff', fontWeight: '900', fontSize: 17, flex: 1 }}>{card.author}</Text>
            {card.tag && !isSponsored ? <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.22)' }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{card.tag}</Text></View> : null}
          </View>
          {dishLine ? <Text numberOfLines={1} style={{ color: '#fff', fontSize: 14.5, fontWeight: '800', marginTop: 8 }}>{dishLine}</Text> : null}
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
        {card && !isVideo && !card.asset && card.uri && loadedKey !== card.key ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center' }}><LogoLoader size={64} /></View> : null}
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
          <RailBtn icon="heart" label={liked ? tl('Togli il mi piace') : tl('Mi piace')} on={liked} count={likeCount} onCount={() => openSheet('likers', { key: card.key, author: card.author, count: likeCount })} onPress={() => { useNet.getState().likePost(card.key); buzz(); }} />
          <RailBtn icon="comment" label={tl('Commenti')} count={commentCount} onCount={(card as SwipeCandidate).link ? undefined : () => openSheet('comments', { key: card.key })} onPress={() => { const l = (card as SwipeCandidate).link; if (l) go(l.page, l.params); else openSheet('comments', { key: card.key }); }} />
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
          <Text style={{ color: liveAccent(), fontWeight: '800' }}>{tl('Tocca per continuare')}</Text>
        </Pressable>
      ) : null}
      </Animated.View>
    </View>
  );
}

import { snapBackdrop } from '@/lib/storyBackdrop';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/T';

import { UserAvatar } from '@/components/network';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { discoverAuthors, recapAuthors } from '@/lib/storyDiscover';
import { VideoPoster } from '@/components/stories/VideoPoster';
import { BACKGROUNDS, makeStory, purgeStories, storyGroups, timeLabel, type Story, type StoryGroup } from '@/lib/stories';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';
import { useStoryPeek } from '@/store/storyPeek';

const FRASI = ['Buongiorno dal lago', 'Giornata di corsa e caffè', 'Prova nuova ricetta stasera', 'Primo giorno di corso', 'Weekend in montagna', 'Studio spagnolo, dai che si può'];
/** Storie di esempio per la modalità demo: una volta sola, di chi segui. */
function useDemoStories() {
  const demo = useApp((s) => s.demo);
  const net = useNet();
  useEffect(() => {
    if (!demo || net.storiesSeeded) return;
    const now = Date.now();
    const authors = net.following.slice(0, 5);
    const list: Story[] = authors.flatMap((a, i) => Array.from({ length: i === 0 ? 4 : i === 1 ? 2 : 1 }, (_, k) => {
      const s = makeStory({ id: `demo-st-${i}-${k}`, author: a, now: now - (i + 1) * 47 * 60000 + k * 9 * 60000, kind: 'text', text: FRASI[(i + k) % FRASI.length], bg: BACKGROUNDS[(i + k) % BACKGROUNDS.length] });
      return s ? [s] : [];
    }).flat());
    net.patch({ stories: [...(net.stories ?? []), ...list], storiesSeeded: true });
  }, [demo, net.storiesSeeded]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Chi compare nel recap: «Seguiti» solo chi segui; «Per te» anche chi hai aiutato o scrive cose simili a quelle che ti piacciono. */
export function useRecapAllowed(mode: 'Per te' | 'Seguiti') {
  const me = useApp((s) => s.account.name);
  const following = useNet((s) => s.following);
  const posts = useNet((s) => s.posts);
  const liked = useNet((s) => s.likedPosts);
  const swipes = useNet((s) => s.swipes);
  const dailyHistory = useNet((s) => s.dailyHistory);
  const donorsLog = useNet((s) => s.donorsLog);
  return useMemo(() => {
    const authorOf = (k: string) => (k.startsWith('standalone:') ? posts.find((p) => 'standalone:' + p.id === k)?.author : undefined);
    const discovered = discoverAuthors({ me, following, dailyHistory, donorsLog, likedAuthors: liked.map(authorOf).filter((a): a is string => !!a), swipedYesAuthors: (swipes ?? []).filter((r) => r.dir === 'yes').map((r) => authorOf(r.key)).filter((a): a is string => !!a) });
    return new Set(recapAuthors(following, discovered, mode));
  }, [posts, liked, swipes, dailyHistory, donorsLog, following, me, mode]);
}

/** Fila di storie in cima alla Home: la tua con il «+», poi le persone che segui (anello colorato = ancora da vedere). */
export function StoriesBar({ mode = 'Per te' }: { mode?: 'Per te' | 'Seguiti' }) {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const stories = useNet((s) => s.stories);
  const seen = useNet((s) => s.storySeen);
  const following = useNet((s) => s.following);
  useDemoStories();
  const setPeek = useStoryPeek((x) => x.set);
  const peeking = useStoryPeek((x) => !!x.author);
  /* il tocco sul ventaglio è gestito a mano: una volta aperta l'anteprima il dito resta suo, anche se lo sposti fuori, e nient'altro si muove (barra, pagina, sezioni) */
  const hold = useRef<{ timer: ReturnType<typeof setTimeout> | null; on: boolean; x: number; y: number; moved: boolean }>({ timer: null, on: false, x: 0, y: 0, moved: false }).current;
  const endHold = () => { if (hold.timer) clearTimeout(hold.timer); hold.timer = null; if (hold.on) { hold.on = false; setPeek(null); } };
  const now = Date.now();
  const seenSet = useMemo(() => new Set(seen ?? []), [seen]);
  // pulizia delle scadute, una volta all'apertura
  useEffect(() => {
    const st = useNet.getState().stories;
    if (st && purgeStories(st, Date.now()).length !== st.length) useNet.getState().patch({ stories: purgeStories(st, Date.now()) });
  }, []);
  const allowed = useRecapAllowed(mode);
  const groups = useMemo(() => storyGroups(stories, me, (a) => allowed.has(a), seen ?? [], now), [stories, seen, allowed, me]); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = groups.find((g) => g.mine);
  const others = groups.filter((g) => !g.mine);
  const preview = (st: Story, w: number, h: number) => st.kind === 'text'
    ? <LinearGradient colors={st.bg ?? ['#6c8cff', '#3b2a7a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: w, height: h, padding: 8, justifyContent: 'center' }}><Text numberOfLines={5} style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{st.text}</Text></LinearGradient>
    : st.kind === 'photo' ? <Image source={{ uri: st.uri }} style={{ width: w, height: h }} contentFit="cover" />
    : <VideoPoster uri={st.uri} poster={st.poster} width={w} height={h} />;
  const card = (key: string, g: StoryGroup, label: string, onPress: () => void, extra?: React.ReactNode) => {
    const W = 84, H = 118;
    const shown = g.stories.slice(0, 3); // si vedono al massimo le prime tre
    const n = shown.length;
    /* già visto per intero: resta in fondo alla fila e si vede oscurato */
    const allSeen = !g.mine && g.unseen === 0;
    // la prima storia sta davanti dritta; le altre escono ai lati come un ventaglio
    const rot = [0, -11, 11];
    const dx = [0, -13, 13];
    return (
      <View key={key} accessible accessibilityRole="button"
        accessibilityLabel={`${label} · ${tl('Momenti: {0}', g.stories.length)}${g.unseen ? ` · ${tl('da vedere')}` : ''}`}
        accessibilityHint={tl('Tocca per entrare. Tieni premuto per un’anteprima senza essere visto')}
        onAccessibilityTap={onPress}
        onStartShouldSetResponder={() => true}
        onResponderTerminationRequest={() => !hold.on}
        onResponderGrant={(e) => { hold.moved = false; hold.x = e.nativeEvent.pageX; hold.y = e.nativeEvent.pageY; if (hold.timer) clearTimeout(hold.timer); hold.timer = setTimeout(() => { hold.timer = null; hold.on = true; setPeek(g.author); }, 450); }}
        onResponderMove={(e) => { if (!hold.on && (Math.abs(e.nativeEvent.pageX - hold.x) > 10 || Math.abs(e.nativeEvent.pageY - hold.y) > 10)) { hold.moved = true; if (hold.timer) { clearTimeout(hold.timer); hold.timer = null; } } }}
        onResponderRelease={() => { const wasPeek = hold.on; const tap = !wasPeek && !hold.moved && hold.timer != null; endHold(); if (tap) onPress(); }}
        onResponderTerminate={endHold}
        style={{ width: W + 40, height: H + 34, alignItems: 'center' }}>
        <View style={{ width: W + 40, height: H, alignItems: 'center', justifyContent: 'center' }}>
          {shown.map((st, k) => ({ st, k })).reverse().map(({ st, k }) => {
            const top = k === 0;
            return (
              <View key={st.id} style={{ position: 'absolute', width: W, height: H, borderRadius: 14, overflow: 'hidden', borderWidth: top && g.unseen ? 2.5 : 1.5, borderColor: top && g.unseen ? '#6c8cff' : 'rgba(255,255,255,0.55)', transform: [{ translateX: dx[k] }, { rotate: `${rot[k]}deg` }], shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } }}>
                {preview(st, W, H)}
                {!g.mine && seenSet.has(st.id) ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(8,10,20,0.62)' }} /> : null}
              </View>
            );
          })}
          {g.stories.length > 3 ? <View style={{ position: 'absolute', end: 4, top: 2, backgroundColor: '#4f8cff', borderRadius: 11, minWidth: 22, height: 22, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>+{g.stories.length - 3}</Text></View> : null}
          {extra}
        </View>
        <Text numberOfLines={1} style={{ color: g.unseen ? t.text : t.muted, opacity: allSeen ? 0.6 : 1, fontSize: 12, marginTop: 8, fontWeight: g.unseen ? '800' : '500' }}>{label}</Text>
      </View>
    );
  };
  return (
    <View>
      <Text accessibilityRole="header" style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, paddingHorizontal: 16, marginTop: 6 }}>{tl('RECAP')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ paddingStart: 22, paddingVertical: 8 }}>
        {mine ? card('me', mine, tl('Il tuo recap'), () => { void snapBackdrop().then(() => go('storyView', { author: me })); }, (
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Aggiungi un momento')} onPress={() => go('storyCreate')} hitSlop={8} style={{ position: 'absolute', end: 5, top: 5, width: 24, height: 24, borderRadius: 12, backgroundColor: '#4f8cff', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={14} color="#fff" /></Pressable>
        )) : (
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Aggiungi al tuo recap')} onPress={() => go('storyCreate')} style={({ pressed }) => ({ width: 84, height: 118, marginHorizontal: 20, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
            <LinearGradient colors={['#7b5cff', '#c13fd6', '#ff4d8d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 6 }}>
              <View>
                <View style={{ borderRadius: 26, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.9)' }}><UserAvatar name={me} size={44} link={false} /></View>
                <View style={{ position: 'absolute', end: -6, bottom: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={14} color="#7b5cff" stroke={3} /></View>
              </View>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13, textAlign: 'center', lineHeight: 16 }}>{tl('Il tuo recap')}</Text>
            </LinearGradient>
          </Pressable>
        )}
        </View>
      <ScrollView style={{ flex: 1 }} horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled scrollEnabled={!peeking} contentContainerStyle={{ paddingStart: 0, paddingEnd: 8, paddingVertical: 8, gap: 0 }} accessibilityLabel={tl('Recap della giornata')}>
        {others.map((g) => card(g.author, g, g.author.split(' ')[0], () => { void snapBackdrop().then(() => go('storyView', { author: g.author })); }))}
      </ScrollView>
      </View>
    </View>
  );
}

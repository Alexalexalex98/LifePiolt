import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/T';

import { UserAvatar } from '@/components/network';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { discoverAuthors, recapAuthors } from '@/lib/storyDiscover';
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
  const now = Date.now();
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
    : <View style={{ width: w, height: h, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={26} color="#fff" /></View>;
  const card = (key: string, g: StoryGroup, label: string, onPress: () => void, extra?: React.ReactNode) => {
    const W = 84, H = 118;
    const shown = g.stories.slice(0, 3); // si vedono al massimo le prime tre
    const n = shown.length;
    // la prima storia sta davanti dritta; le altre escono ai lati come un ventaglio
    const rot = [0, -11, 11];
    const dx = [0, -13, 13];
    return (
      <Pressable key={key} accessibilityRole="button"
        accessibilityLabel={`${label} · ${tl('Momenti: {0}', g.stories.length)}${g.unseen ? ` · ${tl('da vedere')}` : ''}`}
        accessibilityHint={tl('Tocca per entrare. Tieni premuto per un’anteprima senza essere visto')}
        onPress={onPress} onLongPress={() => setPeek(g.author)} onPressOut={() => setPeek(null)} onTouchEnd={() => setPeek(null)} onTouchCancel={() => setPeek(null)} delayLongPress={450}
        // col dito premuto puoi muoverti: l'anteprima resta finché non lo sollevi
        pressRetentionOffset={{ top: 4000, bottom: 4000, left: 4000, right: 4000 }}
        style={{ width: W + 40, height: H + 34, alignItems: 'center' }}>
        <View style={{ width: W + 40, height: H, alignItems: 'center', justifyContent: 'center' }}>
          {shown.map((st, k) => ({ st, k })).reverse().map(({ st, k }) => {
            const top = k === 0;
            return (
              <View key={st.id} style={{ position: 'absolute', width: W, height: H, borderRadius: 14, overflow: 'hidden', borderWidth: top && g.unseen ? 2.5 : 1.5, borderColor: top && g.unseen ? '#6c8cff' : 'rgba(255,255,255,0.55)', transform: [{ translateX: dx[k] }, { rotate: `${rot[k]}deg` }], shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } }}>
                {preview(st, W, H)}
              </View>
            );
          })}
          {g.stories.length > 3 ? <View style={{ position: 'absolute', end: 4, top: 2, backgroundColor: '#4f8cff', borderRadius: 11, minWidth: 22, height: 22, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>+{g.stories.length - 3}</Text></View> : null}
          {extra}
        </View>
        <Text numberOfLines={1} style={{ color: g.unseen ? t.text : t.muted, fontSize: 12, marginTop: 8, fontWeight: g.unseen ? '800' : '500' }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View>
      <Text accessibilityRole="header" style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, paddingHorizontal: 16, marginTop: 6 }}>{tl('RECAP')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled scrollEnabled={!peeking} contentContainerStyle={{ paddingStart: 22, paddingEnd: 8, paddingVertical: 8, gap: 0 }} accessibilityLabel={tl('Recap della giornata')}>
        {mine ? card('me', mine, tl('Tu'), () => go('storyView', { author: me }), (
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Aggiungi un momento')} onPress={() => go('storyCreate')} hitSlop={8} style={{ position: 'absolute', end: 5, top: 5, width: 24, height: 24, borderRadius: 12, backgroundColor: '#4f8cff', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={14} color="#fff" /></Pressable>
        )) : (
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Aggiungi un momento')} onPress={() => go('storyCreate')} style={{ width: 84, height: 118, marginHorizontal: 20, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.border, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <UserAvatar name={me} size={40} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="plus" size={14} color={t.accent} /><Text style={{ color: t.accent, fontWeight: '800', fontSize: 12 }}>{tl('Il tuo momento')}</Text></View>
          </Pressable>
        )}
        {others.map((g) => card(g.author, g, g.author.split(' ')[0], () => go('storyView', { author: g.author })))}
      </ScrollView>
    </View>
  );
}

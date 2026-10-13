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
import { BACKGROUNDS, makeStory, purgeStories, storyGroups, timeLabel, type Story, type StoryGroup } from '@/lib/stories';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';

const FRASI = ['Buongiorno dal lago', 'Giornata di corsa e caffè', 'Prova nuova ricetta stasera', 'Primo giorno di corso', 'Weekend in montagna', 'Studio spagnolo, dai che si può'];
/** Storie di esempio per la modalità demo: una volta sola, di chi segui. */
function useDemoStories() {
  const demo = useApp((s) => s.demo);
  const net = useNet();
  useEffect(() => {
    if (!demo || net.storiesSeeded) return;
    const now = Date.now();
    const authors = net.following.slice(0, 5);
    const list: Story[] = authors.flatMap((a, i) => {
      const s = makeStory({ id: `demo-st-${i}`, author: a, now: now - (i + 1) * 47 * 60000, kind: 'text', text: FRASI[i % FRASI.length], bg: BACKGROUNDS[i % BACKGROUNDS.length] });
      return s ? [s] : [];
    });
    net.patch({ stories: [...(net.stories ?? []), ...list], storiesSeeded: true });
  }, [demo, net.storiesSeeded]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Fila di storie in cima alla Home: la tua con il «+», poi le persone che segui (anello colorato = ancora da vedere). */
export function StoriesBar() {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const stories = useNet((s) => s.stories);
  const seen = useNet((s) => s.storySeen);
  const following = useNet((s) => s.following);
  useDemoStories();
  const now = Date.now();
  // pulizia delle scadute, una volta all'apertura
  useEffect(() => {
    const st = useNet.getState().stories;
    if (st && purgeStories(st, Date.now()).length !== st.length) useNet.getState().patch({ stories: purgeStories(st, Date.now()) });
  }, []);
  const groups = useMemo(() => storyGroups(stories, me, (a) => following.includes(a), seen ?? [], now), [stories, seen, following, me]); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = groups.find((g) => g.mine);
  const others = groups.filter((g) => !g.mine);
  const preview = (st: Story, w: number, h: number) => st.kind === 'text'
    ? <LinearGradient colors={st.bg ?? ['#6c8cff', '#3b2a7a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: w, height: h, padding: 8, justifyContent: 'center' }}><Text numberOfLines={5} style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{st.text}</Text></LinearGradient>
    : st.kind === 'photo' ? <Image source={{ uri: st.uri }} style={{ width: w, height: h }} contentFit="cover" />
    : <View style={{ width: w, height: h, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={26} color="#fff" /></View>;
  const card = (key: string, g: StoryGroup, label: string, onPress: () => void, extra?: React.ReactNode) => {
    const last = g.stories[g.stories.length - 1];
    const W = 88, H = 124;
    return (
      <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${label} · ${tl('Momenti: {0}', g.stories.length)}${g.unseen ? ` · ${tl('da vedere')}` : ''}`} onPress={onPress}
        style={{ width: W, height: H, borderRadius: 16, overflow: 'hidden', borderWidth: g.unseen ? 2.5 : 1, borderColor: g.unseen ? '#6c8cff' : t.border }}>
        {preview(last, W, H)}
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']} style={{ position: 'absolute', start: 0, end: 0, bottom: 0, paddingHorizontal: 7, paddingTop: 18, paddingBottom: 6 }}>
          <Text numberOfLines={1} style={{ color: '#fff', fontSize: 11.5, fontWeight: '800' }}>{label}</Text>
          <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10 }}>{g.stories.length > 1 ? tl('Momenti: {0}', g.stories.length) : timeLabel(last.ts)}</Text>
        </LinearGradient>
        {extra}
      </Pressable>
    );
  };
  return (
    <View>
      <Text accessibilityRole="header" style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, paddingHorizontal: 16, marginTop: 6 }}>{tl('LA GIORNATA')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 10 }} accessibilityLabel={tl('Momenti della giornata')}>
        {mine ? card('me', mine, tl('Tu'), () => go('storyView', { author: me }), (
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Aggiungi un momento')} onPress={() => go('storyCreate')} hitSlop={8} style={{ position: 'absolute', end: 5, top: 5, width: 24, height: 24, borderRadius: 12, backgroundColor: '#4f8cff', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={14} color="#fff" /></Pressable>
        )) : (
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Aggiungi un momento')} onPress={() => go('storyCreate')} style={{ width: 88, height: 124, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.border, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <UserAvatar name={me} size={40} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="plus" size={14} color={t.accent} /><Text style={{ color: t.accent, fontWeight: '800', fontSize: 12 }}>{tl('Il tuo momento')}</Text></View>
          </Pressable>
        )}
        {others.map((g) => card(g.author, g, g.author.split(' ')[0], () => go('storyView', { author: g.author })))}
      </ScrollView>
    </View>
  );
}

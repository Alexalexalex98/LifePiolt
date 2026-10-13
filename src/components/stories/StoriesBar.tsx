import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/T';

import { UserAvatar } from '@/components/network';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { BACKGROUNDS, makeStory, purgeStories, storyGroups, type Story } from '@/lib/stories';
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
  const ring = (colors: [string, string], child: React.ReactNode) => (
    <LinearGradient colors={colors} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>{child}</View>
    </LinearGradient>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 14 }} accessibilityLabel={tl('Storie')}>
      <Pressable accessibilityRole="button" accessibilityLabel={mine ? tl('La tua storia') : tl('Aggiungi una storia')} onPress={() => (mine ? go('storyView', { author: me }) : go('storyCreate'))} style={{ alignItems: 'center', width: 72 }}>
        {mine ? ring(['#6c8cff', '#a46bd6'], <UserAvatar name={me} size={56} />) : ring([t.border, t.border], <UserAvatar name={me} size={56} />)}
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Aggiungi una storia')} onPress={() => go('storyCreate')} hitSlop={8} style={{ position: 'absolute', end: 2, top: 44, width: 24, height: 24, borderRadius: 12, backgroundColor: '#4f8cff', borderWidth: 2, borderColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={13} color="#fff" />
        </Pressable>
        <Text numberOfLines={1} style={{ color: t.text, fontSize: 11.5, marginTop: 5 }}>{tl('La tua storia')}</Text>
      </Pressable>
      {others.map((g) => (
        <Pressable key={g.author} accessibilityRole="button" accessibilityLabel={`${tl('Storia di {0}', g.author)}${g.unseen ? ` · ${tl('da vedere')}` : ''}`} onPress={() => go('storyView', { author: g.author })} style={{ alignItems: 'center', width: 72 }}>
          {ring(g.unseen ? ['#ff7a59', '#c13fd6'] : [t.border, t.border], <UserAvatar name={g.author} size={56} />)}
          <Text numberOfLines={1} style={{ color: g.unseen ? t.text : t.muted, fontSize: 11.5, marginTop: 5, fontWeight: g.unseen ? '700' : '400' }}>{g.author.split(' ')[0]}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

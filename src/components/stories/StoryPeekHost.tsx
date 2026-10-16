import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/T';

import { StoryFx } from '@/components/stories/StoryFx';
import { StoryVideo } from '@/components/stories/StoryPlayer';
import { UserAvatar } from '@/components/network';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { inFlow, ago, timeLabel } from '@/lib/stories';
import { useNet } from '@/store/network';
import { useStoryPeek } from '@/store/storyPeek';

/**
 * Anteprima anonima: tenendo premuto il ventaglio le foto di quella persona si ingrandiscono (meno di mezzo schermo) e scorrono da sole.
 * Non conta come visualizzazione: chi ha pubblicato non vede che le hai guardate. I video si vedono senza audio. Finché il dito resta sullo schermo (anche se lo sposti) l'anteprima resta; quando lo togli sparisce.
 */
export function StoryPeekHost() {
  const author = useStoryPeek((s) => s.author);
  const stories = useNet((s) => s.stories);
  const [i, setI] = useState(0);
  const { width, height } = useWindowDimensions();
  const list = author ? (stories ?? []).filter((s) => s.author === author && inFlow(s, Date.now())).sort((a, b) => a.ts - b.ts) : [];
  useEffect(() => { setI(0); }, [author]);
  useEffect(() => {
    if (!author || list.length < 2) return;
    const h = setInterval(() => setI((x) => (x + 1) % list.length), list[Math.min(i, list.length - 1)]?.kind === 'video' ? 4200 : 1600);
    return () => clearInterval(h);
  }, [author, list.length, i]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!author || !list.length) return null;
  const cur = list[Math.min(i, list.length - 1)];
  const h = Math.min(height * 0.46, width * 0.8 * 4 / 3), w = h * 3 / 4;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <View style={{ width: w, height: h, borderRadius: 20, overflow: 'hidden', backgroundColor: '#111', borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' }}>
        {cur.kind === 'text'
          ? <LinearGradient colors={cur.bg ?? ['#6c8cff', '#3b2a7a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}><Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>{cur.text}</Text></LinearGradient>
          : cur.kind === 'photo' ? <Image source={{ uri: cur.uri }} style={{ width: w, height: h }} contentFit="cover" />
          : cur.uri ? <StoryVideo key={cur.id} uri={cur.uri} poster={cur.poster} sound={false} /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={40} color="#fff" /></View>}
        <StoryFx s={cur} />
        <View style={{ position: 'absolute', top: 8, start: 8, end: 8, flexDirection: 'row', gap: 3 }}>
          {list.map((s, k) => <View key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: k <= i ? '#fff' : 'rgba(255,255,255,0.35)' }} />)}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <UserAvatar name={author} size={28} />
        <Text style={{ color: '#fff', fontWeight: '800' }}>{author}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.75)' }}>{timeLabel(cur.ts)} · {tl(ago(cur.ts, Date.now()))}</Text>
      </View>
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6 }}>{tl('Anteprima: la persona non vede che hai guardato')}</Text>
    </View>
  );
}

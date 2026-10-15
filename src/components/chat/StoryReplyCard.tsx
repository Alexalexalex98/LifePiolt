import { Image } from 'expo-image';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { openMedia } from '@/components/network';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import type { ChatMessage } from '@/store/chat';

/** Risposta a un recap: sopra il messaggio si vede la foto o il video a cui si risponde. */
export function StoryReplyCard({ m, mine, meta }: { m: ChatMessage; mine: boolean; meta: string }) {
  const s = m.storyReply;
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    if (!s || s.kind !== 'video' || !s.uri || Platform.OS === 'web') return;
    let alive = true;
    void VideoThumbnails.getThumbnailAsync(s.uri, { time: 800, quality: 0.5 }).then((r) => { if (alive) setThumb(r.uri); }).catch(() => undefined);
    return () => { alive = false; };
  }, [s?.uri, s?.kind]);
  if (!s) return null;
  const label = mine ? tl('Hai risposto al recap di {0}', s.author.split(' ')[0]) : tl('Ha risposto al tuo recap');
  const open = () => { if (s.kind !== 'text' && s.uri) openMedia({ media: s.kind, seed: s.author, uri: s.uri }); };
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={{ color: meta, fontSize: 11.5, marginBottom: 4 }}>{label}</Text>
      <Pressable accessibilityRole="imagebutton" accessibilityLabel={tl('Recap a cui si risponde')} onPress={open} style={{ width: 128, height: 200, borderRadius: 16, overflow: 'hidden', backgroundColor: '#111' }}>
        {s.kind === 'photo' && s.uri ? <Image source={{ uri: s.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          : s.kind === 'video' ? <>{thumb ? <Image source={{ uri: thumb }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : null}<View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={20} color="#fff" /></View></View></>
          : <LinearGradient colors={s.bg ?? ['#6c8cff', '#3b2a7a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 10 }}><Text numberOfLines={6} style={{ color: '#fff', fontWeight: '800', fontSize: 14, textAlign: 'center' }}>{s.text}</Text></LinearGradient>}
      </Pressable>
    </View>
  );
}

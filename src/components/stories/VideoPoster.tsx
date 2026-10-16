import { Image } from 'expo-image';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/lib/icons';

const cache = new Map<string, string>();

/** Anteprima di un video: usa il fotogramma già pronto, altrimenti lo ricava dal video (e lo ricorda). Mentre arriva resta un riquadro scuro con il simbolo play. */
export function VideoPoster({ uri, poster, width, height }: { uri?: string; poster?: string; width: number; height: number }) {
  const [thumb, setThumb] = useState<string | null>(poster ?? (uri ? cache.get(uri) ?? null : null));
  useEffect(() => {
    if (poster || !uri || cache.has(uri)) return;
    let live = true;
    VideoThumbnails.getThumbnailAsync(uri, { time: 500, quality: 0.5 }).then((r) => { cache.set(uri, r.uri); if (live) setThumb(r.uri); }).catch(() => undefined);
    return () => { live = false; };
  }, [uri, poster]);
  return (
    <View style={{ width, height, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' }}>
      {thumb ? <Image source={{ uri: thumb }} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} contentFit="cover" cachePolicy="memory-disk" transition={150} /> : null}
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={16} color="#fff" /></View>
    </View>
  );
}

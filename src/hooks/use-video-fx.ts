import type { VideoPlayer } from 'expo-video';
import { useEffect } from 'react';

import { loopTarget, type VideoFx } from '@/lib/videoFx';

/** Applica al lettore il montaggio scelto nell'editor: velocità, inizio e fine, ritorno all'inizio del taglio. */
export function useVideoFx(p: VideoPlayer, v?: VideoFx) {
  const speed = v?.speed, start = v?.trimStart, end = v?.trimEnd;
  useEffect(() => {
    try { p.playbackRate = speed ?? 1; } catch { /* lettore già rilasciato */ }
    if (start === undefined && end === undefined) return;
    try { p.timeUpdateEventInterval = 0.1; if (start) p.currentTime = start; } catch { /* idem */ }
    const sub = p.addListener('timeUpdate', ({ currentTime }) => {
      const to = loopTarget(currentTime, { trimStart: start, trimEnd: end });
      if (to !== null) { try { p.currentTime = to; } catch { /* idem */ } }
    });
    return () => sub.remove();
  }, [p, speed, start, end]);
}

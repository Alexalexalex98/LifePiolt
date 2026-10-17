import { createVideoPlayer, type VideoPlayer, type VideoSource } from 'expo-video';

/**
 * Lettori video già pronti: il video che sta per comparire nello Swipe si carica in anticipo, in pausa e muto,
 * così quando arriva a schermo ha già i primi fotogrammi invece di far aspettare qualche secondo.
 */
const pool = new Map<string, VideoPlayer>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function acquirePlayer(key: string, source: VideoSource): VideoPlayer {
  const t = timers.get(key);
  if (t) { clearTimeout(t); timers.delete(key); }
  let p = pool.get(key);
  if (!p) {
    p = createVideoPlayer(source);
    p.loop = true; p.muted = true;
    pool.set(key, p);
  }
  return p;
}
/** Comincia a caricare senza far partire il video. */
export function preloadPlayer(key: string, source: VideoSource) {
  try { acquirePlayer(key, source).pause(); } catch { /* il lettore potrebbe essere già stato rilasciato */ }
}
/** Libera i lettori che non servono più (dopo una breve attesa, così un «annulla» ritrova il video). */
export function releaseExcept(keep: string[], delayMs = 1500) {
  for (const [key, p] of pool) {
    if (keep.includes(key) || timers.has(key)) continue;
    timers.set(key, setTimeout(() => {
      timers.delete(key);
      if (pool.get(key) === p) { pool.delete(key); try { p.release(); } catch { /* già libero */ } }
    }, delayMs));
  }
}
export function releaseAllPlayers() { releaseExcept([], 0); }

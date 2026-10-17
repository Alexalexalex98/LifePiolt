import * as VideoThumbnails from 'expo-video-thumbnails';

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | undefined>>();
export const cachedThumb = (uri: string) => cache.get(uri);
/** Primo fotogramma di un video (file o indirizzo): si ricorda, e se già richiesto non si rifà. */
export function videoThumb(uri: string, time = 300): Promise<string | undefined> {
  const hit = cache.get(uri);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(uri);
  if (!p) {
    p = VideoThumbnails.getThumbnailAsync(uri, { time, quality: 0.5 }).then((r) => { cache.set(uri, r.uri); return r.uri; }).catch(() => undefined).finally(() => pending.delete(uri));
    pending.set(uri, p);
  }
  return p;
}

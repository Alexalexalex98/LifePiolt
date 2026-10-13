/**
 * Modificare ed eliminare i propri post (modulo PURO, nessun alias '@/'). Il riferimento è quello dei mi piace:
 * 'standalone:<id>' per un post del profilo, 'community:<id>:<posizione>' per un post in una community.
 * Solo l'autore può modificare o eliminare; chi modifica può cambiare testo e argomento, non l'immagine.
 */
export type PostLike = { author: string; text: string; tag?: string; editedAt?: number; media?: 'photo' | 'video' | null; uri?: string; hideLikes?: boolean; commentsOff?: boolean };
/** Tutto ciò che l'autore può cambiare: testo, argomento, foto o video (o toglierli), mi piace visibili, commenti. */
export type PostPatch = { text: string; tag?: string; media?: 'photo' | 'video' | null; uri?: string; hideLikes?: boolean; commentsOff?: boolean };
export type CommLike<P> = { id: number | string; posts: P[] };

export type Ref = { kind: 'standalone'; id: string } | { kind: 'community'; id: string; index: number };
export function parseRef(ref: string): Ref | null {
  const a = ref.split(':');
  if (a[0] === 'standalone' && a[1]) return { kind: 'standalone', id: a[1] };
  if (a[0] === 'community' && a[1] && /^\d+$/.test(a[2] ?? '')) return { kind: 'community', id: a[1], index: Number(a[2]) };
  return null;
}

export const MAX_POST = 2000;
export function validatePostText(text: string, hasMedia: boolean): string | null {
  if (!text.trim() && !hasMedia) return 'Scrivi qualcosa: un post senza testo e senza foto non si può salvare.';
  if (text.length > MAX_POST) return `Il testo è troppo lungo (massimo ${MAX_POST} caratteri).`;
  return null;
}

/** Modifica un post del profilo. Restituisce la nuova lista (stesso array se nulla è cambiato o non è dell'autore). */
export function editStandalone<P extends PostLike & { id: number }>(posts: P[], id: string, me: string, patch: PostPatch, now: number): P[] {
  const i = posts.findIndex((p) => String(p.id) === id);
  if (i < 0 || posts[i].author !== me) return posts;
  const cur = posts[i];
  const next: P = { ...cur, text: patch.text.trim(), tag: patch.tag ?? cur.tag };
  if ('media' in patch) { next.media = patch.media ?? null; next.uri = patch.media ? patch.uri : undefined; }
  if (patch.hideLikes !== undefined) next.hideLikes = patch.hideLikes || undefined;
  if (patch.commentsOff !== undefined) next.commentsOff = patch.commentsOff || undefined;
  const same = next.text === cur.text && next.tag === cur.tag && next.media === cur.media && next.uri === cur.uri && !!next.hideLikes === !!cur.hideLikes && !!next.commentsOff === !!cur.commentsOff;
  if (same) return posts;
  const out = [...posts]; out[i] = { ...next, editedAt: now };
  return out;
}
export function editInCommunity<P extends PostLike, C extends CommLike<P>>(comms: C[], cid: string, index: number, me: string, patch: Pick<PostPatch, 'text' | 'media' | 'uri'>, now: number): C[] {
  return comms.map((c) => {
    if (String(c.id) !== cid || !c.posts[index] || c.posts[index].author !== me) return c;
    const cur = c.posts[index];
    const next: P = { ...cur, text: patch.text.trim() };
    if ('media' in patch) { next.media = patch.media ?? null; next.uri = patch.media ? patch.uri : undefined; }
    if (next.text === cur.text && next.media === cur.media && next.uri === cur.uri) return c;
    const posts = [...c.posts]; posts[index] = { ...next, editedAt: now };
    return { ...c, posts };
  });
}
export function removeStandalone<P extends PostLike & { id: number }>(posts: P[], id: string, me: string): P[] {
  return posts.filter((p) => !(String(p.id) === id && p.author === me));
}
export function removeInCommunity<P extends PostLike, C extends CommLike<P>>(comms: C[], cid: string, index: number, me: string): C[] {
  return comms.map((c) => (String(c.id) === cid && c.posts[index]?.author === me ? { ...c, posts: c.posts.filter((_, i) => i !== index) } : c));
}
export const isMine = (author: string, me: string) => !!me && author === me;

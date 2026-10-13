/**
 * Modificare ed eliminare i propri post (modulo PURO, nessun alias '@/'). Il riferimento è quello dei mi piace:
 * 'standalone:<id>' per un post del profilo, 'community:<id>:<posizione>' per un post in una community.
 * Solo l'autore può modificare o eliminare; chi modifica può cambiare testo e argomento, non l'immagine.
 */
export type PostLike = { author: string; text: string; tag?: string; editedAt?: number };
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
export function editStandalone<P extends PostLike & { id: number }>(posts: P[], id: string, me: string, patch: { text: string; tag?: string }, now: number): P[] {
  const i = posts.findIndex((p) => String(p.id) === id);
  if (i < 0 || posts[i].author !== me) return posts;
  const cur = posts[i], text = patch.text.trim(), tag = patch.tag ?? cur.tag;
  if (text === cur.text && tag === cur.tag) return posts;
  const next = [...posts]; next[i] = { ...cur, text, tag, editedAt: now };
  return next;
}
export function editInCommunity<P extends PostLike, C extends CommLike<P>>(comms: C[], cid: string, index: number, me: string, text: string, now: number): C[] {
  return comms.map((c) => {
    if (String(c.id) !== cid || !c.posts[index] || c.posts[index].author !== me) return c;
    if (c.posts[index].text === text.trim()) return c;
    const posts = [...c.posts]; posts[index] = { ...posts[index], text: text.trim(), editedAt: now };
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

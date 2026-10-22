/** Post in stile Threads/X (modulo PURO): repost, citazioni, fili di post dello stesso autore, post riposati di una persona. */
export type Repost = { key: string; by: string; ts: number; /** testo aggiunto: citazione */ note?: string };
export type PostLite = { author: string; text: string; media?: 'photo' | 'video' | null; tag?: string; likes: number; ts?: number; uri?: string; poster?: string; uris?: string[]; editedAt?: number; hideLikes?: boolean; commentsOff?: boolean; fx?: unknown; menuItem?: string };
type StoredPost = PostLite & { id: number };
type StoredCommunity = { id: number; posts: PostLite[] };

/** Il post a cui si riferisce una chiave («standalone:12» o «community:3:0»). */
export function resolvePost(key: string, posts: StoredPost[], communities: StoredCommunity[]): PostLite | null {
  const [kind, a, b] = key.split(':');
  if (kind === 'standalone') return posts.find((p) => p.id === Number(a)) ?? null;
  if (kind === 'community') return communities.find((c) => c.id === Number(a))?.posts[Number(b)] ?? null;
  return null;
}

export const repostCount = (list: Repost[], key: string): number => list.filter((r) => r.key === key && !r.note).length;
export const quoteCount = (list: Repost[], key: string): number => list.filter((r) => r.key === key && !!r.note).length;
export const hasReposted = (list: Repost[], key: string, by: string): boolean => list.some((r) => r.key === key && r.by === by && !r.note);

/** Ripubblica o annulla: un solo repost semplice per persona e per post. Le citazioni si aggiungono sempre. */
export function toggleRepostList(list: Repost[], key: string, by: string, now: number, note?: string): Repost[] {
  if (note?.trim()) return [{ key, by, ts: now, note: note.trim().slice(0, 280) }, ...list];
  return hasReposted(list, key, by) ? list.filter((r) => !(r.key === key && r.by === by && !r.note)) : [{ key, by, ts: now }, ...list];
}

/** I post che una persona ha ripubblicato, dal più recente; i post che non esistono più si saltano. */
export function repostsOf(list: Repost[], name: string, posts: StoredPost[], communities: StoredCommunity[]): { r: Repost; post: PostLite }[] {
  const out: { r: Repost; post: PostLite }[] = [];
  for (const r of list.filter((x) => x.by === name).sort((a, b) => b.ts - a.ts)) {
    const post = resolvePost(r.key, posts, communities);
    if (post) out.push({ r, post });
  }
  return out;
}

/** Due post di fila dello stesso autore formano un filo: si disegna la linea verticale tra loro. */
export function threadFlags<T extends { author: string; kind?: string }>(items: T[]): { up: boolean; down: boolean }[] {
  const same = (a?: T, b?: T) => !!a && !!b && a.kind !== 'repost' && b.kind !== 'repost' && a.author === b.author;
  return items.map((it, i) => ({ up: same(items[i - 1], it), down: same(it, items[i + 1]) }));
}

/** 1200 -> «1,2K», 15300 -> «15K». */
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(Math.floor(n / 100) / 10).toString().replace('.', ',')}K`;
  if (n < 1e6) return `${Math.floor(n / 1000)}K`;
  return `${(Math.floor(n / 1e5) / 10).toString().replace('.', ',')}M`;
}

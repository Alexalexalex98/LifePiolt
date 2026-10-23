import { AppState } from 'react-native';

import { useApp } from '@/store/app';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';
import { refreshShared } from './sharedCommands';
import { deletePost, ensurePublicProfile, fetchFeed, insertPost, lastPostError, myLikes, setLike, socialSession, updatePost, uploadMedia, type Social } from './socialApi';
import { mergeRemote, toInsertRow, type LocalPostLike, type RemotePost } from './socialCore';

/**
 * Collega i post dell'app al server: così su iPhone e su Android si vedono gli stessi contenuti.
 *  - un post tuo, creato qui, viene pubblicato (con le sue foto e i suoi video);
 *  - quando lo modifichi o lo elimini, cambia anche sul server;
 *  - i mi piace si mandano al server;
 *  - i post degli altri (e i tuoi pubblicati da un altro telefono) arrivano nel feed.
 * Se il server non è collegato o non hai fatto l'accesso, non cambia niente: l'app resta come prima, sul telefono.
 * Non tocca chat, finanze, salute o documenti: solo i post che pubblichi.
 */
type NetPost = LocalPostLike & Record<string, unknown>;
const publishing = new Set<number>();
const failed = new Set<number>();
let ready = false;
let lastPull = 0;
let started = false;

const mine = (p: NetPost, me: string) => p.author === me;
const postKey = (id: number) => `standalone:${id}`;

async function publishNew(s: Social) {
  const net = useNet.getState();
  for (const p of net.posts as NetPost[]) {
    if (!mine(p, s.name) || p.remoteId || p.sponsor || publishing.has(p.id)) continue;
    publishing.add(p.id);
    try {
      const up: { media?: string; poster?: string; list?: string[] } = {};
      if (p.uri && !/^https?:/.test(p.uri)) up.media = (await uploadMedia(s, p.uri)) ?? undefined;
      if (p.poster && !/^https?:/.test(p.poster)) up.poster = (await uploadMedia(s, p.poster)) ?? undefined;
      if (p.uris?.length) up.list = (await Promise.all(p.uris.map((u) => (/^https?:/.test(u) ? u : uploadMedia(s, u))))).filter((u): u is string => !!u);
      if (p.media && p.uri && !up.media && !/^https?:/.test(p.uri)) continue; // il file non è partito: riprovo al prossimo giro
      const row = await insertPost(s, toInsertRow(p, s.userId, up));
      if (row) { useNet.getState().patch({ posts: useNet.getState().posts.map((x) => (x.id === p.id ? { ...x, remoteId: row.id } : x)) as never }); toast('Pubblicato online'); failed.delete(p.id); }
      else if (!failed.has(p.id)) { failed.add(p.id); toast(`Non sono riuscito a pubblicare online: ${lastPostError || 'riprovo più tardi'}. Il post resta sul telefono.`); }
    } finally { publishing.delete(p.id); }
  }
}

let prev: NetPost[] = [];
let prevLiked: string[] = [];
async function pushChanges(s: Social) {
  const net = useNet.getState();
  const cur = net.posts as NetPost[];
  // eliminati: erano sul server e non ci sono più
  for (const o of prev) if (o.remoteId && mine(o, s.name) && !cur.some((p) => p.id === o.id)) void deletePost(s, o.remoteId);
  // modificati
  for (const p of cur) {
    const o = prev.find((x) => x.id === p.id);
    if (p.remoteId && o && mine(p, s.name) && (o.text !== p.text || o.tag !== p.tag || o.editedAt !== p.editedAt)) void updatePost(s, p.remoteId, { body: p.text, tag: p.tag ?? null, comments_off: !!p.commentsOff, hide_likes: !!p.hideLikes });
  }
  // mi piace
  const added = net.likedPosts.filter((k) => !prevLiked.includes(k)), removed = prevLiked.filter((k) => !net.likedPosts.includes(k));
  const remoteOf = (k: string) => (k.startsWith('standalone:') ? cur.find((p) => p.id === Number(k.split(':')[1]))?.remoteId : undefined);
  for (const k of added) { const r = remoteOf(k); if (r) void setLike(s, r, true); }
  for (const k of removed) { const r = remoteOf(k) ?? (prev.find((p) => postKey(p.id) === k)?.remoteId); if (r) void setLike(s, r, false); }
  prev = cur; prevLiked = net.likedPosts;
}

/** Scarica i post dal server e li unisce a quelli locali. Al massimo ogni 30 secondi, salvo richiesta esplicita. */
export async function pullFeed(force = false): Promise<void> {
  if (!force && Date.now() - lastPull < 30_000) return;
  const s = await socialSession(); if (!s) return;
  lastPull = Date.now();
  if (!ready) ready = await ensurePublicProfile(s);
  if (!ready) return;
  const remote: RemotePost[] = await fetchFeed(s);
  if (!remote.length) return;
  const net = useNet.getState();
  const known = (net.posts as NetPost[]).filter((p) => p.remoteId).map((p) => p.remoteId as string);
  const now = new Set(remote.map((r) => r.id));
  // un post che avevo ma non è più nel server (eliminato dall'autore): lo tolgo, solo se rientrerebbe nella finestra scaricata
  const oldest = Math.min(...remote.map((r) => Date.parse(r.created_at)));
  const deletedIds = (net.posts as NetPost[]).filter((p) => p.remoteId && !now.has(p.remoteId) && (p.ts ?? 0) >= oldest).map((p) => p.remoteId as string);
  const merged = mergeRemote(net.posts as NetPost[], remote, { deletedIds });
  net.patch({ posts: merged as never });
  // cuori: gli stessi su ogni telefono
  const liked = await myLikes(s, remote.map((r) => r.id));
  const keys = (useNet.getState().posts as NetPost[]).filter((p) => p.remoteId && liked.includes(p.remoteId)).map((p) => postKey(p.id));
  const cur = useNet.getState().likedPosts;
  const toAdd = keys.filter((k) => !cur.includes(k));
  if (toAdd.length) { prevLiked = [...prevLiked, ...toAdd]; useNet.getState().patch({ likedPosts: [...cur, ...toAdd] } as never); }
  void known;
}

/** Da chiamare una volta all'avvio dell'app. */
export function startSocialSync() {
  if (started) return;
  started = true;
  prev = useNet.getState().posts as NetPost[]; prevLiked = useNet.getState().likedPosts;
  let lastPosts = useNet.getState().posts, lastLikes = useNet.getState().likedPosts;
  useNet.subscribe((st) => { if (st.posts === lastPosts && st.likedPosts === lastLikes) return; lastPosts = st.posts; lastLikes = st.likedPosts; void socialSession().then(async (s) => { if (!s) return; if (!ready) ready = await ensurePublicProfile(s); if (ready) { await publishNew(s); await pushChanges(s); } else { prev = useNet.getState().posts as NetPost[]; prevLiked = useNet.getState().likedPosts; } }); });
  setTimeout(() => { void pullFeed(true); void refreshShared(); }, 2500);
  AppState.addEventListener('change', (st) => { if (st === 'active') void pullFeed(); });
  void useApp;
}

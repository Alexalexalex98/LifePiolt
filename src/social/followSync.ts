import { followingList, followPerson, unfollowPerson } from '@/lib/peopleApi';
import type { Card } from '@/lib/people';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

import { socialSession } from './socialApi';

/**
 * Il «Segui» dell'app resta sul telefono (per il feed), ma quando la persona è un utente vero lo stesso gesto passa anche dal server:
 * è lì che si decide chi vede i contenuti «solo per chi mi segue». Persone di esempio o senza id sul server: resta solo locale.
 */
type Row = Record<string, unknown> & { author?: string; authorId?: string; host?: string; name?: string };
/** L'id sul server di una persona, se lo conosciamo (da un suo post, annuncio o dall'elenco di chi seguo). */
export function serverIdOf(name: string): string | undefined {
  const n = useNet.getState();
  const known = n.followIds?.[name]; if (known) return known;
  const fromPost = (n.posts as unknown as Row[]).find((p) => p.author === name && p.authorId)?.authorId;
  if (fromPost) return fromPost;
  const lists: Row[][] = [n.ideas as unknown as Row[], n.seminars as unknown as Row[], n.providers as unknown as Row[]];
  for (const l of lists) { const r = l.find((x) => (x.author === name || x.host === name || x.name === name) && x.authorId); if (r?.authorId) return r.authorId; }
  return undefined;
}

/** Segui o smetti di seguire: cambia subito sul telefono e poi sul server; se il server dice no, torna com'era. */
export function toggleFollowSynced(name: string): boolean {
  const net = useNet.getState(); const f = net.toggleFollow(name);
  const id = serverIdOf(name);
  if (!id || useApp.getState().demo) return f;
  void (async () => {
    if (!(await socialSession())) return;
    const r = f ? await followPerson(id) : await unfollowPerson(id);
    if (!r.ok) { useNet.getState().toggleFollow(name); toast(r.message); return; }
    useNet.getState().patch({ followIds: { ...useNet.getState().followIds, [name]: id } } as never);
    if (f && r.data === 'pending') toast('Richiesta inviata: deve accettarla prima che tu possa vedere i suoi contenuti riservati');
  })();
  return f;
}

/** Quando si segue o si smette dall'anteprima di un profilo (già passato dal server): allinea l'elenco locale. */
export function applyServerFollow(card: Pick<Card, 'user_id' | 'display_name'>, following: boolean): void {
  const net = useNet.getState(); const has = net.following.includes(card.display_name);
  if (following !== has) net.toggleFollow(card.display_name);
  net.patch({ followIds: { ...useNet.getState().followIds, [card.display_name]: card.user_id } } as never);
}

/** All'avvio: l'elenco di chi seguo sul server diventa quello dell'app (accettati sì, richieste in attesa no); chi ho smesso di seguire altrove esce. */
export async function pullFollowing(): Promise<void> {
  if (useApp.getState().demo) return;
  if (!(await socialSession())) return;
  const r = await followingList(); if (!r.ok) return;
  const net = useNet.getState();
  const accepted = r.data.filter((c) => c.follow === 'accepted'); const all = new Set(r.data.map((c) => c.display_name));
  const ids = { ...net.followIds }; for (const c of r.data) ids[c.display_name] = c.user_id;
  const gone = net.following.filter((n) => net.followIds?.[n] && !all.has(n));
  const add = accepted.map((c) => c.display_name).filter((n) => !net.following.includes(n));
  const next = [...net.following.filter((n) => !gone.includes(n)), ...add];
  if (next.length !== net.following.length || gone.length || add.length || JSON.stringify(ids) !== JSON.stringify(net.followIds)) net.patch({ following: next, followIds: ids } as never);
}

import { useMemo } from 'react';

import type { SwipeCandidate } from '@/components/feed/SwipeDeck';
import { useVisible } from '@/lib/moderation';
import { byReach } from '@/lib/reach';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';

/** I post di altri che si possono scorrere nello Swipe (stessa fonte per la pagina e per il pannello nella Home). */
export function useDeckCards(): SwipeCandidate[] {
  const me = useApp((s) => s.account.name);
  const visible = useVisible();
  const posts = useNet((s) => s.posts);
  const communities = useNet((s) => s.communities);
  const reach = useNet((s) => s.reach);
  const ideas = useNet((s) => s.ideas);
  const providers = useNet((s) => s.providers);
  return useMemo<SwipeCandidate[]>(() => {
    const stand = posts.filter((p) => !p.hideFromFeed && !(p.media && !p.uri && !p.uris?.length) && p.author !== me && visible('post', 'standalone:' + p.id, p.author))
      .map((p) => ({ key: 'standalone:' + p.id, text: p.text, author: p.author, tag: p.tag, uri: p.uri ?? p.uris?.[0], poster: p.poster, uris: p.uris && p.uris.length > 1 ? p.uris : undefined, media: p.media, sponsor: p.sponsor, menuItem: p.menuItem }));
    const comm = communities.filter((c) => c.members.includes(me) && visible('community', c.id, c.owner === 'system' ? undefined : c.owner))
      .flatMap((c) => c.posts.filter((p) => !(p.media && !p.uri)).map((p, pi) => ({ key: `community:${c.id}:${pi}`, text: p.text, author: p.author, tag: c.name, uri: p.uri, media: p.media ?? null })).filter((x) => x.author !== me));
    /* idee (tutte le foto del progetto come carosello) e servizi che potrebbero interessarti; lavoro e marketplace restano solo nella Home */
    const idea = ideas.filter((i) => i.author !== me && i.uri && visible('idea', i.id, i.author))
      .map((i) => { const all = [i.uri as string, ...(i.uris ?? [])]; return { key: `idea:${i.id}`, text: `${i.title}. ${i.desc}`, author: i.author, tag: 'Idea', uri: all[0], uris: all.length > 1 ? all : undefined, media: (i.media === 'video' ? 'video' : 'photo') as 'photo' | 'video', link: { page: 'ideaProfile', params: { id: String(i.id) } } }; });
    const svc = providers.filter((p) => p.cover && p.name !== me)
      .map((p) => ({ key: `service:${p.name}`, text: `${p.role}. ${p.name}`, author: p.name, tag: 'Servizio', uri: p.cover as string, media: 'photo' as const, link: { page: 'servicePage', params: { name: p.name } } }));
    return [...byReach(idea, (x) => x.key, reach), ...byReach(svc, (x) => x.key, reach), ...byReach(stand, (x) => x.key, reach), ...byReach(comm, (x) => x.key, reach)];
  }, [posts, communities, ideas, providers, reach, me, visible]);
}

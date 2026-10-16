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
  return useMemo<SwipeCandidate[]>(() => {
    const stand = posts.filter((p) => !p.hideFromFeed && !(p.media && !p.uri && !p.uris?.length) && p.author !== me && visible('post', 'standalone:' + p.id, p.author))
      .map((p) => ({ key: 'standalone:' + p.id, text: p.text, author: p.author, tag: p.tag, uri: p.uri ?? p.uris?.[0], uris: p.uris && p.uris.length > 1 ? p.uris : undefined, media: p.media }));
    const comm = communities.filter((c) => c.members.includes(me) && visible('community', c.id, c.owner === 'system' ? undefined : c.owner))
      .flatMap((c) => c.posts.filter((p) => !(p.media && !p.uri)).map((p, pi) => ({ key: `community:${c.id}:${pi}`, text: p.text, author: p.author, tag: c.name, uri: p.uri, media: p.media ?? null })).filter((x) => x.author !== me));
    return [...byReach(stand, (x) => x.key, reach), ...byReach(comm, (x) => x.key, reach)];
  }, [posts, communities, reach, me, visible]);
}

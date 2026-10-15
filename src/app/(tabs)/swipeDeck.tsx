import { useMemo } from 'react';

import { SwipeDeck, type SwipeCandidate } from '@/components/feed/SwipeDeck';
import { goBack } from '@/lib/nav';
import { useVisible } from '@/lib/moderation';
import { byReach } from '@/lib/reach';
import { useSeedMedia } from '@/lib/seedMedia';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';

/** Swipe dei post a schermo intero: si vede solo il post. */
export default function SwipePage() {
  useSeedMedia();
  const me = useApp((s) => s.account.name);
  const visible = useVisible();
  const posts = useNet((s) => s.posts);
  const communities = useNet((s) => s.communities);
  const reach = useNet((s) => s.reach);
  const cards = useMemo<SwipeCandidate[]>(() => {
    const stand = posts.filter((p) => !p.hideFromFeed && p.author !== me && visible('post', 'standalone:' + p.id, p.author))
      .map((p) => ({ key: 'standalone:' + p.id, text: p.text, author: p.author, tag: p.tag, uri: p.uri ?? p.uris?.[0], media: p.media }));
    const comm = communities.filter((c) => c.members.includes(me) && visible('community', c.id, c.owner === 'system' ? undefined : c.owner))
      .flatMap((c) => c.posts.map((p, pi) => ({ key: `community:${c.id}:${pi}`, text: p.text, author: p.author, tag: c.name, uri: p.uri, media: p.media ?? null })).filter((x) => x.author !== me));
    return [...byReach(stand, (x) => x.key, reach), ...byReach(comm, (x) => x.key, reach)];
  }, [posts, communities, reach, me, visible]);
  return <SwipeDeck cards={cards} onClose={goBack} />;
}

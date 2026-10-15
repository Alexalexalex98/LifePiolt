import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';

import { StoryPlayer } from '@/components/stories/StoryPlayer';
import { goBack } from '@/lib/nav';
import { activeStories, startIndex, storyGroups } from '@/lib/stories';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';

/** Entri subito nella storia di una persona, a schermo intero, dalla prima non ancora vista. */
export default function StoryView() {
  const { author } = useLocalSearchParams<{ author?: string }>();
  const me = useApp((s) => s.account.name);
  const net = useNet();
  const first = author || me;
  /* finita la storia di una persona si passa alla prossima, come nella barra del recap; l'ordine è fissato all'apertura */
  const [who, setWho] = useState(first);
  const queue = useRef<string[]>([]);
  /* la pagina resta montata tra un'apertura e l'altra: a ogni apertura si riparte da capo, con le storie di chi hai toccato */
  const [opened, setOpened] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => {
    const st = useNet.getState();
    const order = storyGroups(st.stories, me, (a) => st.following.includes(a), st.storySeen ?? [], Date.now()).filter((g) => !g.mine).map((g) => g.author);
    const i = order.indexOf(first);
    queue.current = i >= 0 ? order.slice(i + 1) : first === me ? order : [];
    setWho(first);
    setOpened((n) => n + 1);
  }, [first, me]));
  const advance = () => {
    const nxt = queue.current.shift();
    if (nxt) { setWho(nxt); setOpened((n) => n + 1); } else goBack();
  };
  const { stories, start } = useMemo(() => {
    const all = activeStories(net.stories, Date.now()).filter((s) => s.author === who && s.keep !== 'moment').sort((a, b) => a.ts - b.ts);
    const g = storyGroups(net.stories, me, () => true, net.storySeen ?? [], Date.now()).find((x) => x.author === who);
    return { stories: all, start: g ? Math.min(startIndex(g, net.storySeen ?? []), Math.max(0, all.length - 1)) : 0 };
  }, [who, opened]); // eslint-disable-line react-hooks/exhaustive-deps
  return <StoryPlayer key={`${who}:${opened}`} stories={stories} start={start} onClose={goBack} onEnd={advance} />;
}

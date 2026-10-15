import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

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
  const who = author || me;
  /* la pagina resta montata tra un'apertura e l'altra: a ogni apertura si riparte da capo, con le storie di chi hai toccato */
  const [opened, setOpened] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { setOpened((n) => n + 1); }, [who]));
  const { stories, start } = useMemo(() => {
    const all = activeStories(net.stories, Date.now()).filter((s) => s.author === who && s.keep !== 'moment').sort((a, b) => a.ts - b.ts);
    const g = storyGroups(net.stories, me, () => true, net.storySeen ?? [], Date.now()).find((x) => x.author === who);
    return { stories: all, start: g ? Math.min(startIndex(g, net.storySeen ?? []), Math.max(0, all.length - 1)) : 0 };
  }, [who, opened]); // eslint-disable-line react-hooks/exhaustive-deps
  return <StoryPlayer key={`${who}:${opened}`} stories={stories} start={start} onClose={goBack} />;
}

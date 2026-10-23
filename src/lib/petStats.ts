import { earnedForDay } from '@/hooks/use-pet-earned';
import { dayKey } from '@/lib/format';
import { progressOf } from '@/lib/challenges';
import { useChallenges } from '@/store/challenges';

/** Sfide cooperative arrivate al traguardo insieme. */
export const challengesReachedCount = () => useChallenges.getState().list.filter((c) => progressOf(c, dayKey(), (d) => earnedForDay(d)[c.kind]).state === 'reached').length;

import { useEffect } from 'react';

import { useApp } from '@/store/app';
import { useClub } from '@/store/club';

/** In modalita' demo carica i LifeClub di esempio (una sola volta) e fa avanzare gli addebiti dimostrativi. */
export function useClubSeed() {
  const demo = useApp((s) => s.demo);
  const me = useApp((s) => s.account.name);
  const seeded = useClub((s) => s.seeded);
  useEffect(() => { if (demo && !seeded) useClub.getState().seedDemo(); }, [demo, seeded]);
  useEffect(() => { if (me) useClub.getState().advanceBilling(me); }, [me]);
}

import { useMemo } from 'react';

import { matchesFilter } from '@/lib/workPlan';
import { useLife, type CalEvent } from '@/store/life';
import { useWork } from '@/store/work';

/** Gli impegni del Plan secondo il filtro scelto (Tutto / Personale / Lavoro). Con «Tutto» sono quelli veri, senza copie. */
export function useVisibleEvents(): Record<string, CalEvent[]> {
  const events = useLife((s) => s.events);
  const filter = useWork((s) => s.filter);
  return useMemo(() => {
    if (filter === 'all') return events;
    const out: Record<string, CalEvent[]> = {};
    for (const [d, l] of Object.entries(events)) { const f = l.filter((e) => matchesFilter(e, filter)); if (f.length) out[d] = f; }
    return out;
  }, [events, filter]);
}

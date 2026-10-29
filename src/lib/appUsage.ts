import { AppState } from 'react-native';

import { dayKey } from '@/lib/format';
import { useApp } from '@/store/app';

/** Quanto usi QUESTA app ogni giorno (minuti), salvato sul telefono: serve solo al benessere, non misura nient'altro del telefono. */
export function startUsageTracking(): () => void {
  let since: number | null = AppState.currentState === 'active' ? Date.now() : null;
  const flush = () => {
    if (since == null) return;
    const now = Date.now();
    const min = (now - since) / 60000;
    since = now;
    if (min <= 0 || min > 600) return;
    const day = dayKey();
    const cur = useApp.getState().usageMin ?? {};
    const keep = Object.keys(cur).sort().slice(-59);
    const next: Record<string, number> = {};
    for (const k of keep) next[k] = cur[k]!;
    next[day] = Math.round(((next[day] ?? 0) + min) * 10) / 10;
    useApp.getState().set({ usageMin: next });
  };
  const sub = AppState.addEventListener('change', (st) => { if (st === 'active') { since = Date.now(); } else { flush(); since = null; } });
  const timer = setInterval(flush, 120000);
  return () => { flush(); sub.remove(); clearInterval(timer); };
}

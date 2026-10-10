import { useMemo } from 'react';

import { isUnlocked, type Signals } from '@/lib/tour';
import { useApp } from '@/store/app';
import { useFin } from '@/store/finance';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import { useTour } from '@/store/tour';
import { useTravel } from '@/store/travel';

/** Conteggi d'uso letti ora (fuori dai componenti). */
export function readSignals(): Signals {
  const h = useHealth.getState(), l = useLife.getState();
  return {
    mood: h.moods.length,
    events: Object.values(l.events).reduce((n, a) => n + a.length, 0),
    tasks: l.tasks.length,
    notes: l.notes.length,
    health: Object.keys(h.lastLog).length + h.workouts.length + h.mindSessions.length,
    finance: useFin.getState().months.reduce((n, m) => n + m.movements.length, 0),
    trips: l.vacations.length + useTravel.getState().saved.length,
    drive: l.drive.length,
    network: useApp.getState().pageVisits.lifenetwork ?? 0,
  };
}

/** Conteggi d'uso, aggiornati quando cambiano i dati. */
export function useSignals(): Signals {
  const mood = useHealth((s) => s.moods.length);
  const events = useLife((s) => Object.values(s.events).reduce((n, a) => n + a.length, 0));
  const tasks = useLife((s) => s.tasks.length);
  const notes = useLife((s) => s.notes.length);
  const health = useHealth((s) => Object.keys(s.lastLog).length + s.workouts.length + s.mindSessions.length);
  const finance = useFin((s) => s.months.reduce((n, m) => n + m.movements.length, 0));
  const trips = useLife((s) => s.vacations.length) + useTravel((s) => s.saved.length);
  const drive = useLife((s) => s.drive.length);
  const network = useApp((s) => s.pageVisits.lifenetwork ?? 0);
  return useMemo(() => ({ mood, events, tasks, notes, health, finance, trips, drive, network }), [mood, events, tasks, notes, health, finance, trips, drive, network]);
}

/** True se la pagina è ancora bloccata dal percorso graduale. */
export function useLocked(page: string | null | undefined): boolean {
  return useTour((s) => !isUnlocked(s, page));
}

/** Chiede lo sblocco di una pagina (apre la scheda "Si sblocca presto"). */
export const requestUnlock = (page: string) => useTour.getState().promptLock(page);

/** Livello massimo sbloccato (99 = tutto aperto). */
export function useUnlockedLevel(): number {
  return useTour((s) => (s.mode == null || s.mode === 'open' || s.allUnlocked ? 99 : s.level));
}

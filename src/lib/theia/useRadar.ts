import { useMemo } from 'react';

import { useFin } from '@/store/finance';
import { useFitness } from '@/store/fitness';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import { useRadar as useDismissed } from '@/store/radar';
import { useShifts } from '@/store/shifts';
import { collectSnap } from './collect';
import { radar, type Proposal } from './radar';

/** Gli avvisi di Theia adesso: si aggiornano da soli quando cambiano i dati da cui dipendono. */
export function useProposals(): Proposal[] {
  const dismissed = useDismissed((s) => s.dismissed);
  const ev = useLife((s) => s.events), tk = useLife((s) => s.tasks);
  const sh = useShifts((s) => s.shifts);
  const fin = useFin((s) => s.months), bills = useFin((s) => s.bills), budget = useFin((s) => s.budget);
  const sleep = useHealth((s) => s.series.sleep);
  const meals = useFitness((s) => s.meals);
  const day = new Date().toDateString();
  return useMemo(() => { try { return radar(collectSnap(), dismissed); } catch { return []; } }, [dismissed, ev, tk, sh, fin, bills, budget, sleep, meals, day]); // eslint-disable-line react-hooks/exhaustive-deps
}

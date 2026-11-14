import { useCallback, useEffect, useRef, useState } from 'react';

import type { GShift } from '@/lib/group';
import { addDays } from '@/lib/group';
import { listAbsences } from '@/lib/teamWork';
import { loadContracts, loadCover, loadCoverReqs, loadMonths, loadShifts, loadSwaps, myUserId, groupMembers, watchGroup, type Cover, type CoverReq, type GContract, type GMonth, type Swap } from '@/lib/groupApi';
import type { Member } from '@/lib/teams';
import type { Absence } from '@/store/work';

export type GroupData = {
  loading: boolean; me: string | null; members: Member[]; shifts: GShift[]; cover: Cover[]; covReqs: CoverReq[]; swaps: Swap[]; contracts: GContract[]; months: GMonth[]; absences: Absence[];
  reload: () => Promise<void>; nameOf: (id: string) => string;
};
const empty = { me: null as string | null, members: [] as Member[], shifts: [] as GShift[], cover: [] as Cover[], covReqs: [] as CoverReq[], swaps: [] as Swap[], contracts: [] as GContract[], months: [] as GMonth[], absences: [] as Absence[] };

/** Tutti i dati di un gruppo di lavoro, riletti dal server quando qualcosa cambia (turni, richieste, scambi). */
export function useGroup(team: string | undefined, today: string): GroupData {
  const [d, setD] = useState(empty); const [loading, setLoading] = useState(!!team);
  const alive = useRef(true);
  const reload = useCallback(async () => {
    if (!team) return;
    const from = addDays(today, -40);
    const [me, mem, sh, cv, cr, sw, ct, mo, ab] = await Promise.all([myUserId(), groupMembers(team), loadShifts(team, from), loadCover(team), loadCoverReqs(team), loadSwaps(team), loadContracts(team), loadMonths(team), listAbsences(team)]);
    if (!alive.current) return;
    setD({ me, members: mem.ok ? mem.data : [], shifts: sh.ok ? sh.data : [], cover: cv.ok ? cv.data : [], covReqs: cr.ok ? cr.data : [], swaps: sw.ok ? sw.data : [], contracts: ct.ok ? ct.data : [], months: mo.ok ? mo.data : [], absences: ab.ok ? ab.data : [] });
    setLoading(false);
  }, [team, today]);
  useEffect(() => {
    alive.current = true; void reload();
    let stop: () => void = () => {};
    if (team) void watchGroup(team, () => { void reload(); }).then((s) => { if (alive.current) stop = s; else s(); });
    return () => { alive.current = false; stop(); };
  }, [team, reload]);
  const nameOf = useCallback((id: string) => d.members.find((m) => m.user_id === id)?.name || 'Collega', [d.members]);
  return { loading, ...d, reload, nameOf };
}

import { useEffect } from 'react';

import { supa } from '@/lib/accountApi';
import { myUserId } from '@/lib/teams';
import { run } from '@/lib/teamWork';
import { capsOf, type Cap } from '@/lib/workRoles';
import { usePeople, type Person } from '@/store/people';
import { useTeams } from '@/store/teams';

/** Persone, posizioni e permessi di un workspace. Ogni permesso lo decide il server: qui servono solo a mostrare o nascondere i pulsanti giusti. */
export const loadPeople = (team: string) => run(async () => {
  const me = await myUserId(); usePeople.getState().setMe(me);
  const list = (await (await supa()).rpc<Person[]>('team_people', { p_team: team })) ?? [];
  usePeople.getState().set(team, list); return list;
});
export const setPosition = (team: string, user: string, position: string | null, reportsTo: string | null) => run(async () => { await (await supa()).rpc('team_set_position', { p_team: team, p_user: user, p_position: position, p_reports_to: reportsTo }); await loadPeople(team); });
export const setRole = (team: string, user: string, role: 'admin' | 'member') => run(async () => { await (await supa()).rpc('team_set_role', { p_team: team, p_user: user, p_role: role }); await loadPeople(team); });

/** I miei permessi nel workspace (ruolo + posizione). Si aggiornano quando arrivano le persone dal server. */
export function useCaps(team: string | undefined): { caps: Set<Cap>; role: 'owner' | 'admin' | 'member' | undefined; position: string | null } {
  const people = usePeople((s) => (team ? s.people[team] : undefined));
  const me = usePeople((s) => s.me);
  const role = useTeams((s) => s.teams.find((x) => x.id === team)?.role);
  useEffect(() => { if (team && !people) void loadPeople(team); }, [team, people]);
  const mine = people?.find((p) => p.user_id === me);
  return { caps: capsOf(mine?.role ?? role, mine?.position), role: mine?.role ?? role, position: mine?.position ?? null };
}

import { supa } from '@/lib/accountApi';
import { db, q, run } from '@/lib/teamWork';
import { useTeamNotifs, type TeamNotif } from '@/store/notifications';
import { useTeams } from '@/store/teams';

/** Notifiche di lavoro dal server: richieste di spostamento, esiti, annullamenti. */
export async function pullNotifs(): Promise<void> {
  try {
    const rows = await q<TeamNotif[]>((await db()).from('team_notifications').select('*').order('created_at', { ascending: false }).limit(60));
    useTeamNotifs.getState().set(rows);
  } catch { /* senza server */ }
}
let ch: unknown = null;
export async function watchNotifs(): Promise<void> {
  try {
    const c = await db();
    if (ch) c.removeChannel(ch);
    ch = c.channel('team-notifs').on('postgres_changes', { event: '*', schema: 'public', table: 'team_notifications' }, () => { void pullNotifs(); }).subscribe();
    await pullNotifs();
  } catch { /* senza server */ }
}
export const markNotif = (id: string, patch: { read?: boolean; done?: boolean }) => run(async () => {
  await q((await db()).from('team_notifications').update(patch).eq('id', id));
  useTeamNotifs.getState().set(useTeamNotifs.getState().items.map((n) => (n.id === id ? { ...n, ...patch } : n)));
});
/** Sposta una riunione o un impegno condiviso e avvisa chi era invitato (che accetta o no). Restituisce l'id della richiesta, o null se non c'era nessuno da avvisare. */
export const proposeReschedule = (kind: 'meeting' | 'event', target: string, day: string, time: string) => run(async () => (await (await supa()).rpc<string | null>('team_reschedule_propose', { p_kind: kind, p_target: target, p_new_day: day, p_new_time: time })) ?? null);
export const answerReschedule = (id: string, accept: boolean) => run(async () => {
  const r = await (await supa()).rpc<string>('team_reschedule_answer', { p_id: id, p_accept: accept });
  await pullNotifs();
  return r;
});
export const teamName = (id: string) => useTeams.getState().teams.find((x) => x.id === id)?.name ?? '';

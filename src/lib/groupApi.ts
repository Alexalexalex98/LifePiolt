import { supa } from '@/lib/accountApi';
import { groupError, type GShift } from '@/lib/group';
import { inviteCode, joinTeam, listMembers, myUserId, refreshTeams, type Res } from '@/lib/teams';
import { db, q } from '@/lib/teamWork';

/** Gruppo di lavoro sul server. Ogni permesso lo decide il server (RLS e funzioni): qui si chiamano e si traducono gli errori in italiano. */
const run = async <T,>(f: () => Promise<T>): Promise<Res<T>> => { try { return { ok: true, data: await f() }; } catch (e) { return { ok: false, message: groupError(e) }; } };
const rpc = async <T,>(name: string, args: Record<string, unknown> = {}): Promise<T> => (await (await supa()).rpc<T>(name, args)) as T;
const table = async <T,>(name: string, f: (t: ReturnType<Awaited<ReturnType<typeof db>>['from']>) => ReturnType<Awaited<ReturnType<typeof db>>['from']>): Promise<T> => q<T>(f((await db()).from(name)));

export type Cover = { team_id: string; user_id: string; available: boolean; note: string };
export type CoverReq = { id: string; team_id: string; day: string; start_t: string; end_t: string; label: string; status: 'open' | 'filled' | 'closed'; taken_by: string | null; created_by: string };
export type Swap = { id: string; team_id: string; shift_id: string; from_user: string; day: string; start_t: string; end_t: string; label: string; note: string; status: 'open' | 'taken' | 'cancelled' };
export type GContract = { team_id: string; user_id: string; weekly_hours: number; vacation_days: number; overtime_mode: 'paid' | 'plain' | 'bank' | 'mixed'; paid_up_to: number | null; bank_ratio: number; bank_expiry_months: number | null; ends_on: string | null };
export type GMonth = { team_id: string; user_id: string; month: string; hours: number; status: 'pending' | 'confirmed'; digest: string | null; confirmed_at: string | null };

export const createGroup = (name: string) => run(async () => { const id = await rpc<string>('group_create', { p_name: name.trim() }); await refreshTeams(); return id; });
export const joinGroup = joinTeam;
export const groupInvite = inviteCode;
export const groupMembers = listMembers;
export { myUserId };

/* ---------- lettura ---------- */
export const loadShifts = (team: string, from: string) => run(() => table<GShift[]>('group_shifts', (t) => t.select('*').eq('team_id', team).gte('day', from).order('day', { ascending: true })));
export const loadCover = (team: string) => run(() => table<Cover[]>('group_cover', (t) => t.select('*').eq('team_id', team)));
export const loadCoverReqs = (team: string) => run(() => table<CoverReq[]>('group_cover_requests', (t) => t.select('*').eq('team_id', team).eq('status', 'open').order('day', { ascending: true })));
export const loadSwaps = (team: string) => run(() => table<Swap[]>('group_swaps', (t) => t.select('*').eq('team_id', team).eq('status', 'open').order('day', { ascending: true })));
export const loadContracts = (team: string) => run(() => table<GContract[]>('group_contracts', (t) => t.select('*').eq('team_id', team)));
export const loadMonths = (team: string) => run(() => table<GMonth[]>('group_months', (t) => t.select('*').eq('team_id', team)));
export const overview = (team: string, from: string, to: string) => run(() => rpc<import('@/lib/group').Person[]>('group_overview', { p_team: team, p_from: from, p_to: to }));

/* ---------- datore ---------- */
export const setShift = (team: string, user: string, day: string, start: string, end: string, label: string, id?: string) => run(() => rpc<string>('group_shift_set', { p_team: team, p_user: user, p_day: day, p_start: start, p_end: end, p_label: label, p_id: id ?? null }));
export const removeShift = (id: string) => run(() => rpc<void>('group_shift_remove', { p_id: id }));
export const askCover = (team: string, day: string, start: string, end: string, label: string, all: boolean) => run(() => rpc<{ id: string; notified: number }>('group_cover_ask', { p_team: team, p_day: day, p_start: start, p_end: end, p_label: label, p_all: all }));
export const setContract = (team: string, user: string, c: { weekly: number; vac: number; mode: GContract['overtime_mode']; paidUpTo: number | null; ratio: number; expiry: number | null; ends: string | null }) => run(() => rpc<void>('group_contract_set', { p_team: team, p_user: user, p_weekly: c.weekly, p_vac: c.vac, p_mode: c.mode, p_paid_up_to: c.paidUpTo, p_ratio: c.ratio, p_expiry: c.expiry, p_ends: c.ends }));

/* ---------- dipendente ---------- */
export const answerShift = (id: string, accept: boolean) => run(() => rpc<string>('group_shift_answer', { p_id: id, p_accept: accept }));
export const setCover = (team: string, available: boolean, note = '') => run(() => rpc<void>('group_cover_set', { p_team: team, p_available: available, p_note: note }));
export const takeCover = (id: string) => run(() => rpc<string>('group_cover_take', { p_id: id }));
export const openSwap = (shift: string, note = '') => run(() => rpc<string>('group_swap_open', { p_shift: shift, p_note: note }));
export const takeSwap = (id: string, give?: string) => run(() => rpc<string>('group_swap_take', { p_id: id, p_give: give ?? null }));
export const cancelSwap = (id: string) => run(() => rpc<void>('group_swap_cancel', { p_id: id }));
export const monthOpen = (team: string, month: string) => run(() => rpc<GMonth>('group_month_open', { p_team: team, p_month: month }));
export const monthConfirm = (team: string, month: string, digest: string) => run(() => rpc<void>('group_month_confirm', { p_team: team, p_month: month, p_digest: digest }));

/** Resta in ascolto dei cambiamenti del gruppo (turni, richieste, scambi): chiama `onChange` e restituisce la funzione per smettere. */
export async function watchGroup(team: string, onChange: () => void): Promise<() => void> {
  try {
    const c = await db(); const chans: unknown[] = [];
    for (const tb of ['group_shifts', 'group_swaps', 'group_cover_requests', 'team_notifications']) {
      chans.push(c.channel(`grp-${tb}-${team}`).on('postgres_changes', { event: '*', schema: 'public', table: tb, ...(tb === 'team_notifications' ? {} : { filter: `team_id=eq.${team}` }) }, () => onChange()).subscribe());
    }
    return () => { for (const ch of chans) c.removeChannel(ch); };
  } catch { return () => {}; }
}

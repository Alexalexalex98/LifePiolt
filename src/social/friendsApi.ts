import { ERR_TEXT, type DmRow, type RemoteFriend } from '@/lib/friendsCore';

import { ensurePublicProfile, type Social } from './socialApi';

const fail = (e: string) => ({ ok: false as const, error: ERR_TEXT[e] ?? e });
type Res = { ok: true; status?: string } | { ok: false; error: string };

async function rpc(s: Social, fn: string, args: Record<string, unknown> = {}): Promise<{ data: any; error: string }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const r = await s.sb.rpc(fn, args);
  return { data: r.data, error: r.error ? (r.error.message || r.error.code || 'errore') : '' };
}

export async function myFriendCode(s: Social): Promise<{ code: string; error: string }> {
  await ensurePublicProfile(s);
  const r = await rpc(s, 'my_friend_code');
  return { code: typeof r.data === 'string' ? r.data : '', error: r.error };
}
export async function requestFriend(s: Social, code: string): Promise<Res> {
  const r = await rpc(s, 'friend_request', { p_code: code });
  if (r.error) return fail(r.error);
  return r.data?.ok ? { ok: true, status: r.data.status } : fail(r.data?.error ?? 'errore');
}
export async function respondFriend(s: Social, id: string, accept: boolean): Promise<Res> {
  const r = await rpc(s, 'friend_respond', { p_other: id, p_accept: accept });
  return r.error ? fail(r.error) : r.data?.ok ? { ok: true } : fail('richiesta non più valida');
}
export async function removeFriend(s: Social, id: string): Promise<Res> { const r = await rpc(s, 'friend_remove', { p_other: id }); return r.error ? fail(r.error) : { ok: true }; }
export async function blockUser(s: Social, id: string): Promise<Res> { const r = await rpc(s, 'friend_block', { p_other: id }); return r.error ? fail(r.error) : { ok: true }; }
export async function listFriends(s: Social): Promise<RemoteFriend[] | null> {
  const r = await rpc(s, 'friends_list');
  return r.error || !Array.isArray(r.data) ? null : (r.data as RemoteFriend[]);
}

export async function sendDm(s: Social, to: string, body: string, clientId: string): Promise<{ row: DmRow | null; error: string }> {
  const r = await s.sb.from('dm_messages').insert({ sender: s.userId, recipient: to, body: body.slice(0, 4000), client_id: clientId }).select('*').single();
  if (r.error) {
    // già mandato (stesso client_id): non è un errore, il messaggio c'è
    if (r.error.code === '23505') return { row: null, error: '' };
    return { row: null, error: r.error.message || r.error.code || 'errore' };
  }
  return { row: r.data as DmRow, error: '' };
}
export async function fetchDms(s: Social, since: string): Promise<DmRow[] | null> {
  let q = s.sb.from('dm_messages').select('*');
  if (since) q = q.gt('created_at', since);
  const r = await q.order('created_at', { ascending: true }).limit(500);
  return r.error || !Array.isArray(r.data) ? null : (r.data as DmRow[]);
}
export const markRead = (s: Social, other: string) => rpc(s, 'dm_mark_read', { p_other: other });

/** Messaggi in arrivo in tempo reale. Restituisce la funzione per smettere. */
export function listenDms(s: Social, onRow: (r: DmRow) => void): () => void {
  try {
    const sb = s.sb as unknown as { channel(n: string): any; removeChannel(c: unknown): unknown }; // eslint-disable-line @typescript-eslint/no-explicit-any
    const ch = sb.channel(`dm-${s.userId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `recipient=eq.${s.userId}` }, (p: { new: DmRow }) => onRow(p.new)).subscribe();
    return () => { try { sb.removeChannel(ch); } catch { /* ignore */ } };
  } catch { return () => {}; }
}

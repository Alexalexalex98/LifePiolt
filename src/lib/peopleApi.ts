import { supa } from '@/lib/accountApi';
import { peopleError, type Audience, type Card, type Me } from '@/lib/people';
import type { Res } from '@/lib/teams';
import { db, q } from '@/lib/teamWork';
import { useApp } from '@/store/app';

/** Persone sul server: il mio codice, il nome utente, la privacy, la ricerca e le anteprime dei profili, il follow e i contenuti con il loro pubblico.
 *  Le regole le applica il server; qui si chiamano e si traducono gli errori. */
const run = async <T,>(f: () => Promise<T>): Promise<Res<T>> => { try { return { ok: true, data: await f() }; } catch (e) { return { ok: false, message: peopleError(e) }; } };
const rpc = async <T,>(name: string, args: Record<string, unknown> = {}): Promise<T> => (await (await supa()).rpc<T>(name, args)) as T;

export const myProfile = () => run(() => rpc<Me>('people_me', { p_name: useApp.getState().account.name || null }));
export const setUsername = (u: string) => run(() => rpc<string | null>('people_set_username', { p_username: u }));
export const setPrivacy = (discoverable: boolean, followApproval: boolean) => run(() => rpc<void>('people_set_privacy', { p_discoverable: discoverable, p_follow_approval: followApproval }));
export const searchPeople = (text: string) => run(() => rpc<Card[]>('people_search', { p_q: text }));
export const previewPerson = (id: string) => run(() => rpc<Card>('people_preview', { p_user: id }));
export const personByCode = (code: string) => run(() => rpc<Card>('people_by_code', { p_code: code }));
export const followPerson = (id: string) => run(() => rpc<'accepted' | 'pending'>('people_follow', { p_user: id }));
export const unfollowPerson = (id: string) => run(() => rpc<void>('people_unfollow', { p_user: id }));
export const answerFollow = (id: string, accept: boolean) => run(() => rpc<void>('people_follow_answer', { p_user: id, p_accept: accept }));
export const followRequests = () => run(() => rpc<Card[]>('people_follow_requests'));

/** Annunci, servizi, seminari e idee condivisi online, ognuno con il suo pubblico. */
export type ListingKind = 'service' | 'seminar' | 'idea' | 'offer';
export type Listing = { id: string; author_id: string; author_name: string; kind: ListingKind; title: string; body: string; payload: Record<string, unknown>; audience: Audience; created_at: string };
export const publishListing = (l: { kind: ListingKind; title: string; body?: string; payload?: Record<string, unknown>; audience: Audience }) => run(async () => {
  const me = (await rpc<Me>('people_me', { p_name: useApp.getState().account.name || null })).user_id;
  const rows = await q<Listing[]>((await db()).from('social_listings').insert({ author_id: me, kind: l.kind, title: l.title.trim().slice(0, 120), body: (l.body ?? '').slice(0, 4000), payload: l.payload ?? {}, audience: l.audience }).select('*'));
  return rows[0] as Listing;
});
export const setListingAudience = (id: string, audience: Audience) => run(async () => { await q((await db()).from('social_listings').update({ audience }).eq('id', id)); });
export const removeListing = (id: string) => run(async () => { await q((await db()).from('social_listings').update({ deleted_at: new Date().toISOString() }).eq('id', id)); });
/** I contenuti che il server ti lascia vedere (il pubblico lo decide lui): tutti, o di un autore. */
export const loadListings = (author?: string) => run(async () => {
  let qy = (await db()).from('social_listings').select('*').order('created_at', { ascending: false }).limit(100);
  if (author) qy = qy.eq('author_id', author);
  return (await q<(Listing & { deleted_at: string | null })[]>(qy)).filter((l) => !l.deleted_at);
});

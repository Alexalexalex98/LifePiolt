import { getSupabase } from '@/sync/supabaseClient';
import { loadServerConfig } from '@/sync/secure';
import { useApp } from '@/store/app';
import type { RemotePost, SharedCmd } from './socialCore';
import { readUriBytes } from '@/lib/readUri';

/** Parte di client Supabase che serve qui (PostgREST + storage + auth). */
type Q = PromiseLike<{ data: any; error: { message?: string; code?: string } | null }> & Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type Sb = {
  from(t: string): { select(c?: string): Q; insert(v: unknown): Q; upsert(v: unknown, o?: unknown): Q; update(v: unknown): Q; delete(): Q };
  rpc(fn: string, a?: Record<string, unknown>): Q;
  storage: { from(b: string): { upload(path: string, body: Blob, o?: unknown): PromiseLike<{ error: { message?: string } | null }>; getPublicUrl(path: string): { data: { publicUrl: string } } } };
  auth: { getSession(): Promise<{ data: { session: { user: { id: string } } | null } }> };
};

export type Social = { sb: Sb; userId: string; name: string };
let cached: { url: string; key: string } | null = null;

/** Il server sociale e la sessione dell'utente (stessa email dell'account). null = non collegato: l'app resta come prima, tutto sul telefono. */
export async function socialSession(): Promise<Social | null> {
  try {
    if (!cached) { const c = await loadServerConfig(); const url = c.url || process.env.EXPO_PUBLIC_SUPABASE_URL || '', key = c.anonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''; if (!url || !key) return null; cached = { url, key }; }
    const sb = getSupabase(cached.url, cached.key) as unknown as Sb;
    const { data } = await sb.auth.getSession();
    const name = useApp.getState().account.name?.trim();
    if (!data.session || !name) return null;
    return { sb, userId: data.session.user.id, name };
  } catch { return null; }
}
export const resetSocialConfig = () => { cached = null; };

/** Il nome pubblico serve al server per firmare i post: nessuno pubblica a nome di un altro. */
export async function ensurePublicProfile(s: Social): Promise<boolean> {
  const r = await s.sb.from('social_profiles').upsert({ user_id: s.userId, display_name: s.name.slice(0, 60), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  return !r.error;
}

/** Carica una foto o un video del telefono (file://) nell'archivio pubblico e restituisce il suo indirizzo. */
export async function uploadMedia(s: Social, uri: string): Promise<string | null> {
  try {
    const bytes = await readUriBytes(uri);
    const ext = (/\.(\w{2,4})(?:\?|$)/.exec(uri)?.[1] ?? 'jpg').toLowerCase();
    const type = ext === 'mp4' || ext === 'mov' ? 'video/mp4' : ext === 'png' ? 'image/png' : 'image/jpeg';
    const path = `${s.userId}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const up = await s.sb.storage.from('social-media').upload(path, bytes as unknown as Blob, { contentType: type, upsert: false });
    return up.error ? null : s.sb.storage.from('social-media').getPublicUrl(path).data.publicUrl;
  } catch { return null; }
}

/** L'ultimo errore del server nel pubblicare (per dirlo all'utente invece di tacere). */
export let lastPostError = '';
export async function insertPost(s: Social, row: Record<string, unknown>): Promise<RemotePost | null> {
  const r = await s.sb.from('social_posts').insert(row).select('*').single();
  lastPostError = r.error ? (r.error.message || r.error.code || 'errore sconosciuto') : '';
  return r.error ? null : (r.data as RemotePost);
}

export type DiagStep = { label: string; ok: boolean; detail?: string };
/** Prova una per una le cose che servono a pubblicare (accesso, profilo pubblico, lettura e scrittura dei post, archivio dei file) e dice dove si ferma. */
export async function diagnoseSocial(): Promise<DiagStep[]> {
  const steps: DiagStep[] = [];
  const s = await socialSession();
  if (!s) {
    const c = await loadServerConfig();
    const hasCfg = !!((c.url || process.env.EXPO_PUBLIC_SUPABASE_URL) && (c.anonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY));
    steps.push({ label: 'Server collegato', ok: hasCfg, detail: hasCfg ? undefined : 'Mancano indirizzo e chiave del server (.env.local).' });
    steps.push({ label: 'Accesso con il tuo account', ok: false, detail: hasCfg ? 'Non risulti collegato: esci e accedi di nuovo con il codice.' : undefined });
    return steps;
  }
  steps.push({ label: 'Server collegato e accesso fatto', ok: true });
  const prof = await s.sb.from('social_profiles').upsert({ user_id: s.userId, display_name: s.name.slice(0, 60), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  steps.push({ label: 'Profilo pubblico', ok: !prof.error, detail: prof.error ? (prof.error.message || prof.error.code) : undefined });
  const read = await s.sb.from('social_posts').select('id').limit(1);
  steps.push({ label: 'Lettura dei post', ok: !read.error, detail: read.error ? (read.error.message || read.error.code) : undefined });
  const write = await s.sb.from('social_posts').insert({ author_id: s.userId, body: 'prova', deleted_at: new Date().toISOString() }).select('id').single();
  if (!write.error && write.data?.id) await s.sb.from('social_posts').delete().eq('id', write.data.id);
  steps.push({ label: 'Scrittura di un post', ok: !write.error, detail: write.error ? (write.error.message || write.error.code) : undefined });
  try {
    const up = await s.sb.storage.from('social-media').upload(`${s.userId}/prova-${Date.now()}.txt`, new Blob(['ok']), { contentType: 'text/plain' });
    steps.push({ label: 'Archivio foto e video', ok: !up.error, detail: up.error ? up.error.message : undefined });
  } catch (e) { steps.push({ label: 'Archivio foto e video', ok: false, detail: e instanceof Error ? e.message : 'errore' }); }
  return steps;
}
export async function fetchFeed(s: Social, limit = 60): Promise<RemotePost[]> {
  const r = await s.sb.from('social_posts').select('*').order('created_at', { ascending: false }).limit(limit);
  return r.error || !Array.isArray(r.data) ? [] : (r.data as RemotePost[]);
}
export async function updatePost(s: Social, id: string, patch: Record<string, unknown>): Promise<boolean> {
  return !(await s.sb.from('social_posts').update({ ...patch, edited_at: new Date().toISOString() }).eq('id', id)).error;
}
export async function deletePost(s: Social, id: string): Promise<boolean> {
  return !(await s.sb.from('social_posts').update({ deleted_at: new Date().toISOString() }).eq('id', id)).error;
}
export async function setLike(s: Social, postId: string, on: boolean): Promise<boolean> {
  const r = on ? await s.sb.from('social_likes').upsert({ post_id: postId, user_id: s.userId }, { onConflict: 'post_id,user_id', ignoreDuplicates: true }) : await s.sb.from('social_likes').delete().eq('post_id', postId).eq('user_id', s.userId);
  return !r.error;
}
/** Quali dei miei mi piace sono sul server (per riavere i cuori accesi su un altro telefono). */
export async function myLikes(s: Social, postIds: string[]): Promise<string[]> {
  if (!postIds.length) return [];
  const r = await s.sb.from('social_likes').select('post_id').eq('user_id', s.userId).in('post_id', postIds);
  return r.error || !Array.isArray(r.data) ? [] : (r.data as { post_id: string }[]).map((x) => x.post_id);
}

/* ---------- comandi condivisi di Theia ---------- */
export async function shareCommand(s: Social, c: { pattern: string; kind: 'page' | 'cmd'; target: string }): Promise<boolean> {
  const r = await s.sb.from('shared_commands').insert({ pattern: c.pattern, kind: c.kind, target: c.target, created_by: s.userId });
  return !r.error || r.error.code === '23505'; // già condiviso da altri: va bene lo stesso
}
export async function fetchShared(s: Social): Promise<SharedCmd[]> {
  const r = await s.sb.from('shared_commands').select('id,pattern,kind,target,score').gte('score', 2).order('score', { ascending: false }).limit(500);
  return r.error || !Array.isArray(r.data) ? [] : (r.data as SharedCmd[]);
}
export async function voteShared(s: Social, id: string, vote: 1 | -1): Promise<boolean> {
  return !(await s.sb.from('shared_command_votes').upsert({ command_id: id, user_id: s.userId, vote }, { onConflict: 'command_id,user_id' })).error;
}

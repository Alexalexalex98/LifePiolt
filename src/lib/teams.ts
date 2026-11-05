import { t } from '@/i18n/core';
import { applyTransport } from '@/sync/bindings';
import { supa } from '@/lib/accountApi';
import { readUriBytes } from '@/lib/readUri';
import { useApp } from '@/store/app';
import { useTeams, type TeamInfo } from '@/store/teams';
import { useWorkspace } from '@/store/workspace';

/** Team di lavoro: elenco, inviti, membri e file condivisi (cartella privata sul server). Ogni permesso lo controlla il server: se esci o ti tolgono, non vedi più niente. */
export type Member = { user_id: string; role: 'owner' | 'admin' | 'member'; name: string };
export type TeamFile = { id: string; team_id: string; name: string; size: number; mime: string | null; path: string; uploaded_by: string | null; created_at: string };
type Q = { select(c: string): Q; eq(c: string, v: unknown): Q; order(c: string, o?: { ascending: boolean }): Q; insert(v: unknown): Q; delete(): Q; then: PromiseLike<{ data: unknown; error: { message?: string } | null }>['then'] };
type Raw = { from(t: string): Q; storage: { from(b: string): { upload(p: string, b: ArrayBuffer | Uint8Array, o?: Record<string, unknown>): Promise<{ error: { message?: string } | null }>; download(p: string): Promise<{ data: Blob | null; error: { message?: string } | null }>; remove(p: string[]): Promise<{ error: { message?: string } | null }> } }; channel(n: string): { on(...a: unknown[]): { subscribe(cb?: (s: string) => void): unknown }; }; removeChannel(c: unknown): unknown };

export async function raw(): Promise<Raw> { return (await supa()).raw() as Raw; }
const msg = (e: unknown) => { const m = e instanceof Error ? e.message : (e as { message?: string })?.message ?? ''; return /Server non collegato/.test(m) ? t('Non c\'è il collegamento con il server: per condividere con altre persone serve un account verificato e la rete.') : /invito_non_valido/.test(m) ? t('Il codice non è valido o è scaduto.') : /troppi_team/.test(m) ? t('Hai già 10 team: eliminane uno prima.') : /non_autorizzato/.test(m) ? t('Non hai il permesso per farlo.') : m || t('Operazione non riuscita: riprova.'); };
export type Res<T = undefined> = { ok: true; data: T } | { ok: false; message: string };
const run = async <T>(f: () => Promise<T>): Promise<Res<T>> => { try { return { ok: true, data: await f() }; } catch (e) { return { ok: false, message: msg(e) }; } };

/** Rilegge i team dal server e, se sei stato tolto da un team, cancella da questo telefono le sue pagine e i suoi file. */
export async function refreshTeams(): Promise<Res<TeamInfo[]>> {
  return run(async () => {
    if (isDemo()) return useTeams.getState().teams;
    const list = (await (await supa()).rpc<TeamInfo[]>('team_list')) ?? [];
    useTeams.getState().set({ teams: list, syncedAt: Date.now() });
    const ids = new Set(list.map((x) => x.id));
    const ws = useWorkspace.getState();
    const gone = ws.pages.filter((p) => p.teamId && !ids.has(p.teamId));
    if (gone.length) ws.restore([]), useWorkspace.setState({ pages: ws.pages.filter((p) => !p.teamId || ids.has(p.teamId)) });
    await purgeTeamFiles(ids);
    return list;
  });
}
/** In modalità demo non c'è un account sul server: il workspace nasce sul telefono (pagine, file e piano funzionano qui; la condivisione con altre persone arriva con l'account verificato). */
const isDemo = () => useApp.getState().demo;
const localTeam = (name: string, role: TeamInfo['role']): string => { const id = `demo-${Math.random().toString(36).slice(2, 10)}`; useTeams.getState().set({ teams: [...useTeams.getState().teams, { id, name, role, members: 1 }], syncedAt: Date.now() }); return id; };
export const createTeam = (name: string) => run(async () => {
  if (isDemo()) return localTeam(name.trim().slice(0, 80), 'owner');
  const id = await (await supa()).rpc<string>('team_create', { p_name: name }); await refreshTeams(); return id;
});
export const inviteCode = (team: string, role: 'member' | 'admin' = 'member') => run(() => supa().then((s) => s.rpc<string>('team_invite', { p_team: team, p_role: role })));
export const joinTeam = (code: string) => run(async () => {
  if (isDemo()) return localTeam('Studio di prova', 'member');
  const id = await (await supa()).rpc<string>('team_join', { p_code: code }); await refreshTeams(); return id;
});
export const listMembers = (team: string) => run(() => supa().then((s) => s.rpc<Member[]>('team_members_list', { p_team: team })));
export const removeMember = (team: string, user: string) => run(async () => { await (await supa()).rpc('team_remove_member', { p_team: team, p_user: user }); });
export const deleteTeam = (team: string) => run(async () => { await (await supa()).rpc('team_delete', { p_team: team }); await refreshTeams(); });
export const myUserId = async (): Promise<string | null> => { try { const r = (await raw()) as unknown as { auth?: { getUser?: () => Promise<{ data?: { user?: { id?: string } } }> } }; return (await r.auth?.getUser?.())?.data?.user?.id ?? null; } catch { return null; } };
export async function leaveTeam(team: string): Promise<Res> {
  const me = await myUserId(); if (!me) return { ok: false, message: t('Accedi per continuare.') };
  const r = await removeMember(team, me); if (r.ok) await refreshTeams();
  return r.ok ? { ok: true, data: undefined } : r;
}

/* ---------- file del team ---------- */
export const listTeamFiles = (team: string) => run(async () => {
  const r = await ((await raw()).from('team_files').select('*').eq('team_id', team).order('created_at', { ascending: false }) as unknown as Promise<{ data: TeamFile[] | null; error: { message?: string } | null }>);
  if (r.error) throw new Error(r.error.message);
  return r.data ?? [];
});
export const uploadTeamFile = (team: string, f: { uri: string; name: string; mime?: string; size?: number }) => run(async () => {
  const c = await raw(); const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  const bytes = await readUriBytes(f.uri);
  if (bytes.length > 50 * 1024 * 1024) throw new Error(t('Il file supera i 50 MB.'));
  const path = `${team}/${Date.now().toString(36)}-${f.name.replace(/[^\w.\-]+/g, '_')}`;
  const up = await c.storage.from('team-drive').upload(path, bytes, { contentType: f.mime ?? 'application/octet-stream', upsert: false });
  if (up.error) throw new Error(up.error.message);
  const ins = await (c.from('team_files').insert({ team_id: team, name: f.name, size: bytes.length, mime: f.mime ?? null, path, uploaded_by: me }) as unknown as Promise<{ error: { message?: string } | null }>);
  if (ins.error) { await c.storage.from('team-drive').remove([path]); throw new Error(ins.error.message); }
});
export const deleteTeamFile = (file: TeamFile) => run(async () => {
  const c = await raw();
  const d = await (c.from('team_files').delete().eq('id', file.id) as unknown as Promise<{ error: { message?: string } | null }>);
  if (d.error) throw new Error(d.error.message);
  await c.storage.from('team-drive').remove([file.path]);
  forgetCached(file.path);
});

/* ---------- copie temporanee sul telefono (si cancellano quando esci dal team) ---------- */
const cached = new Map<string, string>();
const forgetCached = (path: string) => { cached.delete(path); };
async function purgeTeamFiles(keep: Set<string>) { for (const p of [...cached.keys()]) if (!keep.has(p.split('/')[0]!)) cached.delete(p); }

/** Scarica un file del team (solo se sei ancora dentro: lo decide il server) e lo restituisce come byte. */
export const downloadTeamFile = (file: TeamFile) => run(async () => {
  const r = await (await raw()).storage.from('team-drive').download(file.path);
  if (r.error || !r.data) throw new Error(r.error?.message || t('Non riesco a scaricare il file.'));
  const buf = new Uint8Array(await r.data.arrayBuffer());
  return buf;
});
export { applyTransport };

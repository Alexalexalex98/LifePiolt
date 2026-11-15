import { AppState } from 'react-native';

import { mediaPathFor, docKey, fromRemote, membershipFromRemote, pendingUploads, toDoc } from '@/lib/club/serverDoc';
import { peopleError } from '@/lib/people';
import { readUriBytes } from '@/lib/readUri';
import type { Res } from '@/lib/teams';
import { useApp } from '@/store/app';
import { mkey, useClub } from '@/store/club';

import { ensurePublicProfile, socialSession, type Social } from './socialApi';

/**
 * LifeClub sul server. Il creatore pubblica il suo club (testi, corsi, lezioni e i file, che finiscono in un archivio privato);
 * gli altri lo ricevono solo se il server li lascia entrare: i file si aprono con un indirizzo che scade e le lezioni Premium arrivano come titoli bloccati.
 * In demo, senza account o senza server non succede niente: il club resta sul telefono.
 */
const BUCKET = 'club-private';
type Any = any;
const call = async <T,>(s: Social, fn: string, args: Record<string, unknown> = {}): Promise<T> => {
  const r = await s.sb.rpc(fn, args);
  if (r.error) throw new Error(r.error.message || r.error.code || fn);
  return r.data as T;
};
const run = async <T,>(f: () => Promise<T>): Promise<Res<T>> => { try { return { ok: true, data: await f() }; } catch (e) { return { ok: false, message: peopleError(e) }; } };
const live = async (): Promise<Social | null> => (useApp.getState().demo ? null : socialSession());

const saved = new Map<string, string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Carica i file delle lezioni ancora sul telefono e ricorda il loro percorso nel club. */
async function upload(s: Social, clubId: string): Promise<void> {
  const club = useClub.getState().clubs[clubId]; if (!club) return;
  for (const { courseId, lesson } of pendingUploads(club)) {
    try {
      const path = mediaPathFor(clubId, lesson);
      const bytes = await readUriBytes(lesson.uri as string);
      const up = await s.sb.storage.from(BUCKET).upload(path, bytes as unknown as Blob, { contentType: lesson.mime || 'application/octet-stream', upsert: true });
      if (!up.error) useClub.getState().patchLesson(clubId, courseId, lesson.id, { mediaPath: path });
    } catch { /* il file resta sul telefono: si riprova al prossimo salvataggio */ }
  }
}

/** Invia il club al server (solo il mio). Ritorna l'errore da mostrare, se c'è. */
export async function pushClub(clubId: string): Promise<Res<true>> {
  const s = await live(); if (!s) return { ok: true, data: true };
  const club = useClub.getState().clubs[clubId];
  if (!club || club.owner !== s.name || club.baseline && !club.remote) return { ok: true, data: true };
  return run(async () => {
    if (!(await ensurePublicProfile(s))) throw new Error('profilo_pubblico_mancante');
    await upload(s, clubId);
    const cur = useClub.getState().clubs[clubId]; if (!cur) return true as const;
    await call(s, 'club_save', { p_doc: toDoc(cur) });
    useClub.getState().patchClub(clubId, { remote: true });
    saved.set(clubId, docKey(useClub.getState().clubs[clubId]));
    return true as const;
  });
}

const signed = async (s: Social, paths: string[]): Promise<Record<string, string>> => {
  const out: Record<string, string> = {}; if (!paths.length) return out;
  try {
    const r = await (s.sb.storage.from(BUCKET) as Any).createSignedUrls(paths, 3600);
    for (const x of (r.data ?? []) as { path: string; signedUrl: string | null }[]) if (x.signedUrl) out[x.path] = x.signedUrl;
  } catch { /* senza indirizzi i file non si aprono, il resto sì */ }
  return out;
};

/** Scarica un club (con i suoi corsi se posso vederli) e lo mette nell'app. */
export async function refreshClub(clubId: string): Promise<Res<true>> {
  const s = await live(); if (!s) return { ok: true, data: true };
  return run(async () => {
    const r = await call<Any>(s, 'club_get', { p_club: clubId });
    const paths = ((r.courses ?? []) as Any[]).flatMap((c) => ((c.lessons ?? []) as Any[]).map((l) => l.mediaPath as string | undefined).filter(Boolean)) as string[];
    const club = fromRemote(r, await signed(s, paths));
    if (club.owner === s.name) club.baseline = undefined;
    const st = useClub.getState();
    const local = st.clubs[clubId];
    if (!(local && local.owner === s.name)) useClub.setState({ clubs: { ...st.clubs, [clubId]: club } });
    if (r.membership) { const m = membershipFromRemote(r.membership, clubId, s.name); useClub.setState((x) => ({ memberships: { ...x.memberships, [mkey(clubId, s.name)]: m } })); }
    // commenti delle lezioni aperte a me
    const lessons = club.courses.flatMap((c) => c.lessons.filter((l) => !l.locked).map((l) => ({ c, l })));
    const got: Any[] = [];
    for (const { c, l } of lessons.slice(0, 40)) {
      const list = await call<Any[]>(s, 'club_comments_list', { p_club: clubId, p_lesson: l.id }).catch(() => []);
      for (const x of list) got.push({ ...x, courseId: c.id, lessonId: l.id, likes: [], saved: [], text: String(x.text ?? ''), ts: Number(x.ts) || Date.now(), isQuestion: !!x.isQuestion });
    }
    const ids = new Set(got.map((g) => g.id)); const pulled = new Set(lessons.map((q) => q.l.id));
    useClub.setState((x) => ({ comments: [...x.comments.filter((c) => c.clubId !== clubId || !pulled.has(c.lessonId) || (c.author === s.name && !ids.has(c.id))), ...got] }));
    if (local?.owner === s.name) saved.set(clubId, docKey(useClub.getState().clubs[clubId] ?? local));
    return true as const;
  });
}

/** Scarica i miei club e quelli a cui sono iscritto, più quelli da scoprire. */
export async function pullClubs(): Promise<void> {
  const s = await live(); if (!s) return;
  try {
    const mine = await call<{ owned: string[]; member: { club: string }[] }>(s, 'club_mine');
    const ids = new Set<string>([...mine.owned, ...mine.member.map((m) => m.club)]);
    for (const id of ids) { const local = useClub.getState().clubs[id]; if (local && local.owner === s.name && mine.owned.includes(id)) { saved.set(id, docKey(local)); continue; } await refreshClub(id); }
    const found = await call<Any[]>(s, 'club_discover', { p_limit: 50 });
    const seen = new Set<string>(ids);
    for (const card of found) { seen.add(card.id); const st = useClub.getState(); if (!st.clubs[card.id] || st.clubs[card.id].remote) useClub.setState({ clubs: { ...st.clubs, [card.id]: { ...(st.clubs[card.id] ?? {}), ...fromRemote(card), courses: st.clubs[card.id]?.courses ?? [], posts: st.clubs[card.id]?.posts ?? [] } } }); }
    // un club online che non vedo più (chiuso o tolto): sparisce dal telefono
    const st = useClub.getState(); const keep = Object.fromEntries(Object.entries(st.clubs).filter(([id, c]) => !c.remote || c.owner === s.name || seen.has(id)));
    if (Object.keys(keep).length !== Object.keys(st.clubs).length) useClub.setState({ clubs: keep });
  } catch { /* offline: restano quelli che ho */ }
}

/** Cosa fa il creatore dal telefono: manda i cambi del club dopo un attimo. */
const schedulePush = (clubId: string) => {
  clearTimeout(timers.get(clubId));
  timers.set(clubId, setTimeout(() => { void pushClub(clubId); }, 1800));
};

export const removeClubOnline = async (clubId: string): Promise<void> => { const s = await live(); if (s) await call(s, 'club_delete', { p_club: clubId }).catch(() => undefined); };
export const grantPremium = async (clubId: string, userId: string, days?: number): Promise<Res<true>> => { const s = await live(); if (!s) return { ok: false, message: 'Serve l\'account online.' }; return run(async () => { await call(s, 'club_grant', { p_club: clubId, p_user: userId, p_days: days ?? null }); return true as const; }); };
export const clubMembersOnline = async (clubId: string): Promise<Res<{ userId: string; name: string; tier: string; status: string; muted: boolean; granted: boolean }[]>> => { const s = await live(); if (!s) return { ok: true, data: [] }; return run(() => call(s, 'club_members_list', { p_club: clubId })); };
export const setMemberOnline = async (clubId: string, userId: string, o: { muted?: boolean; remove?: boolean }): Promise<Res<true>> => { const s = await live(); if (!s) return { ok: false, message: 'Serve l\'account online.' }; return run(async () => { await call(s, 'club_member_set', { p_club: clubId, p_user: userId, p_muted: o.muted ?? null, p_remove: !!o.remove }); return true as const; }); };

let started = false;
/** Da chiamare una volta all'avvio: segue i cambi del club e li manda al server. */
export function startClubSync() {
  if (started) return; started = true;
  let prev = useClub.getState();
  useClub.subscribe((st) => {
    const before = prev; prev = st;
    const me = useApp.getState().account.name; if (!me || useApp.getState().demo) return;
    // club miei: nuovi o cambiati → su; eliminati → via
    for (const c of Object.values(st.clubs)) {
      if (c.owner !== me || (c.baseline && !c.remote)) continue;
      if (c.remote && saved.get(c.id) === docKey(c)) continue;
      if (!c.published && !c.remote) continue; // una bozza non pubblicata resta sul telefono
      schedulePush(c.id);
    }
    for (const c of Object.values(before.clubs)) if (c.owner === me && c.remote && !st.clubs[c.id]) { saved.delete(c.id); void removeClubOnline(c.id); }
    // iscrizioni ai club online
    for (const [k, m] of Object.entries(st.memberships)) {
      const old = before.memberships[k]; const club = st.clubs[m.clubId];
      if (m.user !== me || !club?.remote || club.owner === me || old === m) continue;
      if (m.tier === 'premium') continue;
      if ((m.tier === 'follower' || m.tier === 'free') && m.status === 'attiva' && (old?.tier !== m.tier || old?.status !== 'attiva')) void live().then((s) => s && call(s, 'club_join', { p_club: m.clubId, p_tier: m.tier }).catch(() => undefined));
      if (m.status === 'annullata' && old?.status !== 'annullata') void live().then((s) => s && call(s, 'club_leave', { p_club: m.clubId }).catch(() => undefined));
    }
    for (const k of Object.keys(before.memberships)) {
      const old = before.memberships[k]; const club = st.clubs[old.clubId];
      if (!st.memberships[k] && old.user === me && club?.remote && club.owner !== me) void live().then((s) => s && call(s, 'club_leave', { p_club: old.clubId }).catch(() => undefined));
    }
    // commenti e voti
    for (const c of st.comments) {
      const club = st.clubs[c.clubId];
      if (c.author !== me || !club?.remote || before.comments.some((x) => x.id === c.id)) continue;
      void live().then((s) => s && call(s, 'club_comment_add', { p_club: c.clubId, p_lesson: c.lessonId, p_id: c.id, p_data: { text: c.text, isQuestion: c.isQuestion, parentId: c.parentId ?? null, anchor: c.anchor ?? null } }).catch(() => undefined));
    }
    for (const c of before.comments) if (c.author === me && st.clubs[c.clubId]?.remote && !st.comments.some((x) => x.id === c.id)) void live().then((s) => s && call(s, 'club_comment_delete', { p_id: c.id }).catch(() => undefined));
    for (const [clubId, byUser] of Object.entries(st.ratings)) {
      const r = byUser[me]; const o = before.ratings[clubId]?.[me];
      if (r && r !== o && st.clubs[clubId]?.remote) void live().then((s) => s && call(s, 'club_rate', { p_club: clubId, p_stars: r.stars, p_note: r.text ?? '' }).catch(() => undefined));
    }
  });
  setTimeout(() => { void pullClubs(); }, 3500);
  AppState.addEventListener('change', (x) => { if (x === 'active') void pullClubs(); });
}

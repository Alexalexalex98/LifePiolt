// Prova la migrazione 0041 (LifeClub sul server: privato, per livello, con età e moderazione) su un Postgres in memoria.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const M = new URL('../supabase/migrations/', import.meta.url).pathname;
const db = new PGlite();
const ok = (m) => console.log('  ok  ', m);
const bad = (m, e) => { console.log('  FAIL', m, '-', String(e?.message ?? e).slice(0, 300)); process.exitCode = 1; };
await db.exec(`
create role anon; create role authenticated;
create schema auth; create schema storage;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, created_at timestamptz not null default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
create table storage.objects (bucket_id text, name text, owner uuid);
create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n, '/') $$;
create publication supabase_realtime;
create table public.profiles (user_id uuid primary key, nome text, cognome text, data_nascita date);
create function public._push_send(p_user uuid, p_title text, p_body text, p_data jsonb) returns void language sql as $$ select 1 $$;
grant usage on schema public, auth, storage to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
`);
await db.exec(`create or replace function public.gen_random_bytes(n int) returns bytea language sql as $$ select decode(md5(random()::text), 'hex') $$;`);
for (const f of ['0004_social.sql', '0006_identity.sql', '0007_friends_messages.sql', '0035_people_privacy.sql', '0036_people_details.sql', '0037_people_following.sql', '0039_content_reports.sql', '0040_age_and_moderation.sql', '0041_lifeclub_server.sql']) {
  try { await db.exec(readFileSync(M + f, 'utf8')); ok(f); } catch (e) { bad(f, e); }
}
await db.exec(`alter table storage.objects enable row level security; grant all on storage.objects to authenticated;`);
const U = { boss: '00000000-0000-0000-0000-0000000000d4', own: '00000000-0000-0000-0000-0000000000a1', fan: '00000000-0000-0000-0000-0000000000b2', pro: '00000000-0000-0000-0000-0000000000c3', teen: '00000000-0000-0000-0000-0000000000e5', kid: '00000000-0000-0000-0000-0000000000f6', out: '00000000-0000-0000-0000-0000000000a7' };
const yearsAgo = (y) => `(current_date - make_interval(years => ${y}) - make_interval(days => 3))::date`;
const born = { boss: yearsAgo(40), own: yearsAgo(30), fan: yearsAgo(25), pro: yearsAgo(33), teen: yearsAgo(17), kid: yearsAgo(15), out: yearsAgo(28) };
for (const [k, id] of Object.entries(U)) await db.exec(`insert into auth.users (id, email) values ('${id}', '${k}@x.it'); insert into public.profiles (user_id, nome, cognome, data_nascita) values ('${id}', '${k}', 'T', ${born[k]});`);
await db.exec(`insert into public.app_admins (user_id) values ('${U.boss}')`);
const as = async (u, sql, params) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${U[u]}', false);`); try { return await db.query(sql, params); } finally { await db.exec('reset role;'); } };
const rows = (r) => r.rows; const t = async (name, f) => { try { await f(); ok(name); } catch (e) { bad(name, e); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m ?? ''} atteso ${JSON.stringify(b)} ottenuto ${JSON.stringify(a)}`); };
const rejects = async (p, re) => { try { await p; } catch (e) { if (re.test(String(e.message))) return; throw new Error('errore diverso: ' + e.message); } throw new Error('doveva fallire'); };
for (const k of ['own', 'fan', 'pro', 'teen', 'out']) await as(k, `select public.people_me($1)`, [k + ' T']);

const lesson = (id, tier, extra = {}) => ({ id, title: 'Lezione ' + id, kind: 'video', sectionId: 's1', order: 1, tier, preview: false, uri: 'file:///x.mp4', ...extra });
const doc = (o = {}) => ({ club: { id: 'club-1', name: 'Club Uno', tagline: 'T', description: 'D', cover: { c1: '#111', c2: '#222' }, categories: ['Mente'], published: true, adult: false, pricing: { monthly: 9 }, chat: {}, rulesAccepted: { version: 1, at: 1700000000000 }, ...o.club },
  courses: [{ id: 'c1', title: 'Corso', description: '', level: 'base', sections: [{ id: 's1', title: 'A', order: 1 }], published: true, createdAt: 1, lessons: [lesson('l-free', 'free', { mediaPath: 'club-1/free/a.mp4' }), lesson('l-prem', 'premium', { mediaPath: 'club-1/premium/b.mp4' }), lesson('l-prev', 'premium', { preview: true })] },
    { id: 'c2', title: 'Bozza', description: '', level: 'base', sections: [], published: false, createdAt: 2, lessons: [lesson('l-draft', 'free')] }],
  posts: [{ id: 'p-free', text: 'post free', ts: 1, tier: 'free' }, { id: 'p-prem', text: 'post premium', ts: 2, tier: 'premium' }], ...o.rest });

await t('il creatore salva il club; per pubblicarlo servono le regole accettate; i file locali non vanno sul server', async () => {
  await rejects(as('own', `select public.club_save($1::jsonb)`, [JSON.stringify(doc({ club: { rulesAccepted: undefined } }))]), /regole_non_accettate/);
  eq(rows(await as('own', `select public.club_save($1::jsonb) as r`, [JSON.stringify(doc())]))[0].r, 'club-1');
  eq(rows(await db.query(`select data ? 'uri' as u, media_path from public.club_lessons where id = 'l-free'`))[0], { u: false, media_path: 'club-1/free/a.mp4' });
  await rejects(as('own', `select public.club_save($1::jsonb)`, [JSON.stringify(doc({ rest: { courses: [{ id: 'cx', title: 'x', published: true, lessons: [lesson('lx', 'free', { mediaPath: 'altro-club/free/a.mp4' })] }] } }))]), /file_non_valido/);
  await rejects(as('fan', `select public.club_save($1::jsonb)`, [JSON.stringify(doc())]), /non_autorizzato/);
});
await t('chi non è iscritto vede solo la pagina: niente lezioni, niente post, nemmeno le anteprime', async () => {
  const g = rows(await as('fan', `select public.club_get('club-1') as r`))[0].r;
  eq([g.name, g.access, g.courses, g.posts, g.counts.free], ['Club Uno', 'none', [], [], 0]);
  eq(rows(await as('fan', `select public.club_join('club-1', 'follower') as r`))[0].r, 'follower');
  const f = rows(await as('fan', `select public.club_get('club-1') as r`))[0].r; eq([f.access, f.courses.length, f.posts.length], ['follower', 0, 0], 'chi segue soltanto non entra');
});
await t('iscritto free: lezioni free complete, premium solo come titoli bloccati; post free; bozze escluse', async () => {
  eq(rows(await as('fan', `select public.club_join('club-1', 'free') as r`))[0].r, 'free');
  const g = rows(await as('fan', `select public.club_get('club-1') as r`))[0].r;
  eq(g.courses.map((c) => c.id), ['c1'], 'la bozza non si vede');
  const ls = g.courses[0].lessons; eq(ls.map((l) => [l.id, !!l.locked]), [['l-free', false], ['l-prem', true], ['l-prev', true]]);
  eq(ls[0].mediaPath, 'club-1/free/a.mp4'); eq('mediaPath' in ls[1], false, 'nessun file per le premium'); eq(Object.keys(ls[1]).includes('text') || Object.keys(ls[1]).includes('description'), false);
  eq(g.posts.map((p) => p.id), ['p-free']); eq(g.counts.free, 1);
});
await t('Premium assegnato dal creatore: vede tutto del club; il Premium non si compra', async () => {
  await rejects(as('fan', `select public.club_grant('club-1', $1, 30)`, [U.fan]), /non_autorizzato/);
  await as('own', `select public.club_grant('club-1', $1, 30)`, [U.pro]);
  const g = rows(await as('pro', `select public.club_get('club-1') as r`))[0].r;
  eq([g.access, g.courses[0].lessons.every((l) => !l.locked), g.posts.length], ['premium', true, 2]);
  await rejects(as('fan', `select public.club_join('club-1', 'premium')`), /livello_non_valido/);
  await db.exec(`update public.club_members set ends_at = now() - interval '1 day' where user_id = '${U.pro}'`);
  eq(rows(await as('pro', `select public.club_get('club-1') as r`))[0].r.access, 'free', 'Premium scaduto = free');
  await as('own', `select public.club_grant('club-1', $1, null)`, [U.pro]);
});
await t('club 18+: solo maggiorenni; fuori dalla scoperta; sedicenni e quindicenni non entrano', async () => {
  await as('own', `select public.club_save($1::jsonb)`, [JSON.stringify(doc({ club: { id: 'club-18', name: 'Adulti', adult: true } , rest: { courses: [], posts: [] } }))]);
  await rejects(as('teen', `select public.club_get('club-18')`), /non_trovato/); await rejects(as('teen', `select public.club_join('club-18', 'free')`), /non_trovato/);
  await rejects(as('kid', `select public.club_get('club-1')`), /social_eta_minima/);
  eq(rows(await as('out', `select public.club_get('club-18') as r`))[0].r.adult, true);
  const d = rows(await as('out', `select public.club_discover() as r`))[0].r; eq(d.map((c) => c.id), ['club-1'], 'il 18+ non compare nei consigli');
  await rejects(as('teen', `select public.club_save($1::jsonb)`, [JSON.stringify(doc({ club: { id: 'club-t', adult: true } }))]), /club_adulti_solo_maggiorenni/);
});
await t('file privati: per percorso e livello (free agli iscritti, premium agli abbonati, il resto a nessuno)', async () => {
  await db.exec(`insert into storage.objects (bucket_id, name) values ('club-private', 'club-1/free/a.mp4'), ('club-private', 'club-1/premium/b.mp4'), ('club-private', 'club-1/cover/c.jpg'), ('club-private', 'club-18/cover/c.jpg')`);
  const see = async (u) => rows(await as(u, `select name from storage.objects order by name`)).map((r) => r.name);
  eq(await see('own'), ['club-1/cover/c.jpg', 'club-1/free/a.mp4', 'club-1/premium/b.mp4', 'club-18/cover/c.jpg']);
  eq(await see('pro'), ['club-1/cover/c.jpg', 'club-1/free/a.mp4', 'club-1/premium/b.mp4', 'club-18/cover/c.jpg'], 'maggiorenne: anche la copertina del 18+');
  eq(await see('fan'), ['club-1/cover/c.jpg', 'club-1/free/a.mp4', 'club-18/cover/c.jpg'], 'iscritto free');
  eq(await see('teen'), ['club-1/cover/c.jpg'], '17 anni: social sì, 18+ no, e non essendo iscritto nemmeno i file');
  eq(await see('out'), ['club-1/cover/c.jpg', 'club-18/cover/c.jpg'], 'chi non è iscritto vede solo la copertina (e la 18+ da maggiorenne)');
  eq(await see('kid'), [], 'under 16: niente');
  await rejects(as('fan', `insert into storage.objects (bucket_id, name) values ('club-private', 'club-1/free/hack.mp4')`), /row-level security/);
  await as('own', `insert into storage.objects (bucket_id, name) values ('club-private', 'club-1/free/nuovo.mp4')`);
});
await t('domande e commenti: solo iscritti, premium solo agli abbonati; li toglie l\'autore o il creatore', async () => {
  await as('fan', `select public.club_comment_add('club-1', 'l-free', 'cm1', '{"text":"come si fa?","isQuestion":true}'::jsonb)`);
  await rejects(as('fan', `select public.club_comment_add('club-1', 'l-prem', 'cm2', '{"text":"x"}'::jsonb)`), /non_autorizzato/);
  await rejects(as('out', `select public.club_comment_add('club-1', 'l-free', 'cm3', '{"text":"x"}'::jsonb)`), /non_autorizzato/);
  eq(rows(await as('pro', `select public.club_comments_list('club-1', 'l-free') as r`))[0].r.map((c) => [c.id, c.author, c.text]), [['cm1', 'fan T', 'come si fa?']]);
  eq(rows(await as('out', `select public.club_comments_list('club-1', 'l-free') as r`))[0].r, []);
  await as('own', `select public.club_member_set('club-1', $1, true)`, [U.fan]);
  await rejects(as('fan', `select public.club_comment_add('club-1', 'l-free', 'cm4', '{"text":"x"}'::jsonb)`), /silenziato/);
  await as('own', `select public.club_comment_delete('cm1')`);
  eq(rows(await as('pro', `select public.club_comments_list('club-1', 'l-free') as r`))[0].r, []);
});
await t('moderazione: chi gestisce l\'app sospende il club o un contenuto; il creatore lo vede ancora', async () => {
  await as('fan', `select public.report_content('clubitem', 'club-1:l-free', 'Lezione', 'own T', 'esplicito', '')`);
  const rep = rows(await as('boss', `select public.admin_reports() as r`))[0].r[0];
  await as('boss', `select public.admin_report_decide($1, 'remove')`, [rep.id]);
  const g = rows(await as('fan', `select public.club_get('club-1') as r`))[0].r; eq(g.courses[0].lessons.map((l) => l.id), ['l-prem', 'l-prev'], 'la lezione segnalata sparisce per gli iscritti');
  eq(rows(await as('own', `select public.club_get('club-1') as r`))[0].r.courses[0].lessons.length, 3, 'il creatore la vede');
  await as('out', `select public.report_content('club', 'club-1', 'Club Uno', 'own T', 'minori', '')`);
  const r2 = rows(await as('boss', `select public.admin_reports() as r`))[0].r.find((x) => x.reason === 'minori');
  eq(rows(await as('boss', `select public.admin_report_decide($1, 'suspend', 'club sospeso', 30) as r`, [r2.id]))[0].r.target, U.own);
  await rejects(as('fan', `select public.club_get('club-1')`), /non_trovato/); eq(rows(await as('fan', `select public.club_mine() as r`))[0].r.member, [], 'il club sospeso non compare');
  eq(rows(await as('boss', `select public.admin_report_decide($1, 'dismiss') as r`, [rep.id].slice(0, 0).length ? [rep.id] : [r2.id]))[0].r.ok, true);
});
await t('iscrizione e uscita; il creatore non entra nel proprio club; voto solo da chi è stato iscritto', async () => {
  await as('boss', `select public.admin_lift_sanction($1)`, [U.own]);
  await rejects(as('own', `select public.club_join('club-1', 'free')`), /sei_il_creatore|non_trovato/);
  await as('own', `select public.club_save($1::jsonb)`, [JSON.stringify(doc({ club: { id: 'club-2', name: 'Due' }, rest: { courses: [], posts: [] } }))]);
  await as('out', `select public.club_join('club-2', 'free')`); await as('out', `select public.club_rate('club-2', 5, 'bello')`);
  await as('out', `select public.club_leave('club-2')`);
  eq(rows(await as('out', `select public.club_get('club-2') as r`))[0].r.access, 'none'); eq(rows(await as('out', `select public.club_get('club-2') as r`))[0].r.rating, { n: 1, avg: 5.0 });
  await rejects(as('fan', `select public.club_rate('club-2', 4)`), /non_autorizzato/);
  eq(rows(await as('own', `select jsonb_array_length(public.club_members_list('club-1')) as n`))[0].n >= 2, true); await rejects(as('fan', `select public.club_members_list('club-1')`), /non_autorizzato/);
});
await t('nessuna lettura diretta delle tabelle', async () => { await rejects(as('fan', `select * from public.club_lessons`), /permission denied/); await rejects(as('own', `insert into public.club_clubs (id, owner_id, name) values ('x', '${U.own}', 'x')`), /permission denied/); });
console.log(process.exitCode ? 'CON ERRORI' : 'TUTTO OK');
await db.close();

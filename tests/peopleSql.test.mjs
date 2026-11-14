// Prova la migrazione 0035 (codice, nome utente, profilo privato, follow, pubblico di post e annunci) su un Postgres in memoria. NON serve il server.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const M = new URL('../supabase/migrations/', import.meta.url).pathname;
const db = new PGlite();
const ok = (m) => console.log('  ok  ', m);
const bad = (m, e) => { console.log('  FAIL', m, '-', String(e?.message ?? e).slice(0, 300)); process.exitCode = 1; };
await db.exec(`
create role anon; create role authenticated;
create schema auth; create schema storage;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
create table storage.objects (bucket_id text, name text, owner uuid);
create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n, '/') $$;
create publication supabase_realtime;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
`);
await db.exec(`create or replace function public.gen_random_bytes(n int) returns bytea language sql as $$ select decode(md5(random()::text), 'hex') $$;`);
for (const f of ['0004_social.sql', '0007_friends_messages.sql', '0035_people_privacy.sql']) {
  try { await db.exec(readFileSync(M + f, 'utf8')); ok(f); } catch (e) { bad(f, e); }
}
const U = { a: '00000000-0000-0000-0000-0000000000a1', b: '00000000-0000-0000-0000-0000000000b2', c: '00000000-0000-0000-0000-0000000000c3', d: '00000000-0000-0000-0000-0000000000d4' };
for (const [k, id] of Object.entries(U)) await db.exec(`insert into auth.users (id, email) values ('${id}', '${k}@x.it')`);
const as = async (u, sql, params) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${U[u]}', false);`); try { return await db.query(sql, params); } finally { await db.exec('reset role;'); } };
const rows = (r) => r.rows;
const t = async (name, f) => { try { await f(); ok(name); } catch (e) { bad(name, e); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m ?? ''} atteso ${JSON.stringify(b)} ottenuto ${JSON.stringify(a)}`); };
const rejects = async (p, re) => { try { await p; } catch (e) { if (re.test(String(e.message))) return; throw new Error('errore diverso: ' + e.message); } throw new Error('doveva fallire'); };
const me = async (u, name) => rows(await as(u, `select public.people_me($1) as r`, [name]))[0].r;
const names = { a: 'Anna Verdi', b: 'Bruno Neri', c: 'Chiara Blu', d: 'Dario Rossi' };
const codes = {};

await t('ognuno ha un codice univoco di 8 caratteri e un profilo con nome e cognome', async () => {
  for (const k of Object.keys(U)) { const r = await me(k, names[k]); codes[k] = r.code; eq(/^[A-Z2-9]{8}$/.test(r.code), true, 'formato'); eq(r.display_name, names[k]); eq(r.discoverable, true); }
  eq(new Set(Object.values(codes)).size, 4, 'codici diversi');
  eq((await me('a', 'altro nome')).display_name, 'Anna Verdi', 'il nome non si cambia da qui');
});
await t('nome utente facoltativo: validazioni, occupato, riservati, cambio ogni 30 giorni', async () => {
  eq(rows(await as('a', `select public.people_set_username('Anna.V') as r`))[0].r, 'anna.v');
  await rejects(as('b', `select public.people_set_username('anna.v')`), /nome_utente_occupato/);
  await rejects(as('b', `select public.people_set_username('a')`), /nome_utente_non_valido/);
  await rejects(as('b', `select public.people_set_username('ad..min')`), /nome_utente_non_valido/);
  await rejects(as('b', `select public.people_set_username('admin')`), /nome_utente_non_valido/);
  await as('b', `select public.people_set_username('bruno.n')`);
  await rejects(as('b', `select public.people_set_username('bruno.neri')`), /nome_utente_troppo_presto/);
  await db.exec(`update public.social_profiles set username_changed_at = now() - interval '31 days' where user_id = '${U.b}'`);
  eq(rows(await as('b', `select public.people_set_username('bruno.neri') as r`))[0].r, 'bruno.neri');
  eq(rows(await as('c', `select public.people_set_username('') as r`))[0].r, null, 'senza nome utente va bene');
});
await t('privacy: un profilo privato non compare cercando per nome o @nome, ma si trova col codice', async () => {
  await as('b', `select public.people_set_privacy(false, false)`);
  eq(rows(await as('c', `select public.people_search('Bruno') as r`))[0].r, [], 'per nome: non compare');
  eq(rows(await as('c', `select public.people_search('@bruno') as r`))[0].r, [], 'per @nome: non compare');
  const byCode = rows(await as('c', `select public.people_search($1) as r`, [codes.b.slice(0, 4) + '-' + codes.b.slice(4)]))[0].r;
  eq(byCode.map((x) => x.display_name), ['Bruno Neri'], 'col codice sì');
  eq(rows(await as('c', `select public.people_by_code($1) as r`, [codes.b.toLowerCase()]))[0].r.display_name, 'Bruno Neri', 'dal QR sì');
  eq(rows(await as('c', `select count(*)::int as n from public.social_profiles where user_id = '${U.b}'`))[0].n, 0, 'nemmeno leggendo la tabella');
});
await t('ricerca per nome: trova i profili pubblici, minimo 3 caratteri, nessun dato personale', async () => {
  eq(rows(await as('c', `select public.people_search('anna') as r`))[0].r.map((x) => x.display_name), ['Anna Verdi']);
  eq(rows(await as('c', `select public.people_search('@anna') as r`))[0].r.map((x) => x.username), ['anna.v']);
  eq(rows(await as('c', `select public.people_search('an') as r`))[0].r, [], 'meno di 3');
  const card = rows(await as('c', `select public.people_search('anna') as r`))[0].r[0];
  eq(Object.keys(card).sort(), ['avatar_url', 'bio', 'display_name', 'follow', 'follow_approval', 'followers', 'following', 'me', 'user_id', 'username']);
  eq(Object.keys(card).some((k) => /mail|via|nascita|telefono|phone|address|code|codice/i.test(k)), false);
});
await t('freno alle ricerche: massimo 20 al minuto', async () => {
  for (let i = 0; i < 25; i++) { try { await as('d', `select public.people_search('anna')`); } catch (e) { if (/troppe_ricerche/.test(e.message)) return; throw e; } }
  throw new Error('nessun freno');
});
await t('anteprima: profilo privato non visibile finché non pubblica qualcosa di pubblico; poi sì', async () => {
  await rejects(as('c', `select public.people_preview($1)`, [U.b]), /non_visibile/);
  await as('b', `insert into public.social_listings (author_id, kind, title, audience) values ($1, 'service', 'Ripetizioni di inglese', 'public')`, [U.b]);
  const p = rows(await as('c', `select public.people_preview($1) as r`, [U.b]))[0].r;
  eq([p.display_name, p.username], ['Bruno Neri', 'bruno.neri']);
  eq(Object.keys(p).some((k) => /post|listing|idea|annunc|content/i.test(k)), false, 'solo informazioni principali');
});
await t('post: «solo chi mi segue» lo vede solo chi segue; i pubblici li vedono tutti; commenti e mi piace seguono il post', async () => {
  await as('a', `insert into public.social_posts (author_id, body, audience) values ($1, 'pubblico', 'public'), ($1, 'riservato', 'followers')`, [U.a]);
  const seen = async (u) => rows(await as(u, `select body from public.social_posts where author_id = '${U.a}' order by body`)).map((r) => r.body);
  eq(await seen('c'), ['pubblico']); eq(await seen('a'), ['pubblico', 'riservato']);
  eq(rows(await as('c', `select public.people_follow($1) as r`, [U.a]))[0].r, 'accepted');
  eq(await seen('c'), ['pubblico', 'riservato']);
  const pid = rows(await db.query(`select id from public.social_posts where body = 'riservato'`))[0].id;
  await as('c', `insert into public.social_comments (post_id, author_id, body) values ($1, $2, 'bello')`, [pid, U.c]);
  eq(rows(await as('c', `select count(*)::int as n from public.social_comments where post_id = '${pid}'`))[0].n, 1);
  eq(rows(await as('d', `select count(*)::int as n from public.social_comments where post_id = '${pid}'`))[0].n, 0, 'chi non segue non legge i commenti');
  await rejects(as('d', `insert into public.social_likes (post_id, user_id) values ($1, $2)`, [pid, U.d]), /row-level|violates/);
});
await t('annunci e idee: tutti / solo chi mi segue / tutti tranne chi mi segue', async () => {
  await as('a', `insert into public.social_listings (author_id, kind, title, audience) values ($1, 'seminar', 'Per tutti', 'public'), ($1, 'idea', 'Solo seguaci', 'followers'), ($1, 'offer', 'Solo nuovi', 'not_followers')`, [U.a]);
  const seen = async (u) => rows(await as(u, `select title from public.social_listings where author_id = '${U.a}' order by title`)).map((r) => r.title);
  eq(await seen('c'), ['Per tutti', 'Solo seguaci'], 'c segue a: vede i pubblici e quelli per i seguaci, non «tutti tranne chi mi segue»');
  eq(await seen('d'), ['Per tutti', 'Solo nuovi'], 'd non segue a');
  eq(await seen('a'), ['Per tutti', 'Solo nuovi', 'Solo seguaci'], 'l\'autore vede tutto');
  eq(rows(await as('d', `select count(*)::int as n from public.social_listings where title = 'Solo seguaci'`))[0].n, 0);
});
await t('seguire con approvazione: la richiesta resta in attesa e non dà accesso finché non è accettata', async () => {
  await as('d', `select public.people_set_privacy(true, true)`);
  eq(rows(await as('c', `select public.people_follow($1) as r`, [U.d]))[0].r, 'pending');
  await as('d', `insert into public.social_posts (author_id, body, audience) values ($1, 'per i seguaci', 'followers')`, [U.d]);
  eq(rows(await as('c', `select count(*)::int as n from public.social_posts where author_id = '${U.d}'`))[0].n, 0);
  eq(rows(await as('d', `select public.people_follow_requests() as r`))[0].r.map((x) => x.display_name), ['Chiara Blu']);
  await as('d', `select public.people_follow_answer($1, true)`, [U.c]);
  eq(rows(await as('c', `select count(*)::int as n from public.social_posts where author_id = '${U.d}'`))[0].n, 1);
  await as('c', `select public.people_unfollow($1)`, [U.d]);
  eq(rows(await as('c', `select count(*)::int as n from public.social_posts where author_id = '${U.d}'`))[0].n, 0);
});
await t('non si può modificare il follow di altri né inserirlo a mano', async () => {
  await rejects(as('d', `insert into public.social_follows (follower_id, followed_id) values ($1, $2)`, [U.d, U.a]), /permission denied|row-level/);
  await rejects(as('d', `update public.social_follows set status = 'accepted'`), /permission denied|row-level/);
});
console.log(process.exitCode ? 'CON ERRORI' : 'TUTTO OK');
await db.close();

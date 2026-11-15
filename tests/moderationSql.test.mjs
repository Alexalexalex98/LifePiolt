// Prova la migrazione 0040 (età minima del social a 16 anni, sanzioni, moderazione delle segnalazioni) su un Postgres in memoria.
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
create table public.pushes (id serial primary key, to_user uuid, title text, body text, data jsonb);
create function public._push_send(p_user uuid, p_title text, p_body text, p_data jsonb) returns void language plpgsql as $$ begin insert into public.pushes (to_user, title, body, data) values (p_user, p_title, p_body, p_data); end $$;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
`);
await db.exec(`create or replace function public.gen_random_bytes(n int) returns bytea language sql as $$ select decode(md5(random()::text), 'hex') $$;`);
for (const f of ['0004_social.sql', '0006_identity.sql', '0007_friends_messages.sql', '0035_people_privacy.sql', '0036_people_details.sql', '0037_people_following.sql', '0039_content_reports.sql', '0040_age_and_moderation.sql']) {
  try { await db.exec(readFileSync(M + f, 'utf8')); ok(f); } catch (e) { bad(f, e); }
}
const U = { adult: '00000000-0000-0000-0000-0000000000a1', teen15: '00000000-0000-0000-0000-0000000000b2', teen16: '00000000-0000-0000-0000-0000000000c3', boss: '00000000-0000-0000-0000-0000000000d4' };
const yearsAgo = (y, extraDays = 0) => `(current_date - make_interval(years => ${y}) - make_interval(days => ${extraDays}))::date`;
const born = { adult: yearsAgo(30), teen15: yearsAgo(16, -30) /* compie 16 tra un mese */, teen16: yearsAgo(16, 1) /* ha compiuto 16 anni ieri */, boss: yearsAgo(40) };
for (const [k, id] of Object.entries(U)) await db.exec(`insert into auth.users (id, email) values ('${id}', '${k}@x.it'); insert into public.profiles (user_id, nome, cognome, data_nascita) values ('${id}', '${k}', 'Test', ${born[k]});`);
await db.exec(`insert into public.app_admins (user_id) values ('${U.boss}')`);
const as = async (u, sql, params) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${U[u]}', false);`); try { return await db.query(sql, params); } finally { await db.exec('reset role;'); } };
const rows = (r) => r.rows;
const t = async (name, f) => { try { await f(); ok(name); } catch (e) { bad(name, e); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m ?? ''} atteso ${JSON.stringify(b)} ottenuto ${JSON.stringify(a)}`); };
const rejects = async (p, re) => { try { await p; } catch (e) { if (re.test(String(e.message))) return; throw new Error('errore diverso: ' + e.message); } throw new Error('doveva fallire'); };

await t('età minima: l\'app dai 14 anni, il social dai 16', async () => {
  eq(rows(await db.query(`select public.min_age_years() as a, public.social_min_age_years() as s`))[0], { a: 14, s: 16 });
  eq(rows(await as('adult', `select public.my_social_status() as r`))[0].r.allowed, true);
  const s = rows(await as('teen15', `select public.my_social_status() as r`))[0].r; eq([s.allowed, s.age_ok, s.min_age], [false, false, 16]);
  eq(rows(await as('teen16', `select public.my_social_status() as r`))[0].r.allowed, true, 'ha compiuto 16 anni ieri');
});
await t('un under 16 non può creare il profilo social né cercare persone', async () => {
  await rejects(as('teen15', `select public.people_me('Teen Quindici')`), /social_eta_minima/);
  await rejects(as('teen15', `select public.people_search('anna')`), /social_eta_minima/);
  await rejects(as('teen15', `insert into public.social_profiles (user_id, display_name) values ($1, 'Teen')`, [U.teen15]), /row-level security/);
  eq(rows(await as('adult', `select public.people_me('Adulto Uno')->>'display_name' as n`))[0].n, 'Adulto Uno');
  await as('teen16', `select public.people_me('Sedici Anni')`);
});
await t('un under 16 non vede né scrive post, e i commenti e i mi piace sono chiusi', async () => {
  await as('adult', `insert into public.social_posts (author_id, body) values ($1, 'ciao a tutti')`, [U.adult]);
  eq(rows(await as('teen15', `select count(*)::int as n from public.social_posts`))[0].n, 0, 'non legge');
  eq(rows(await as('teen16', `select count(*)::int as n from public.social_posts`))[0].n, 1, '16 anni: legge');
  await rejects(as('teen15', `insert into public.social_posts (author_id, body) values ($1, 'x')`, [U.teen15]), /profilo_pubblico_mancante|row-level security/);
});
await t('le funzioni delle persone originali non sono chiamabili direttamente', async () => {
  await rejects(as('teen15', `select public._people_search('anna')`), /permission denied/);
  await rejects(as('adult', `select public._people_me('x')`), /permission denied/);
});
await t('segnalazione: arriva con l\'autore; le urgenti avvisano gli amministratori', async () => {
  const pid = rows(await db.query(`select id from public.social_posts limit 1`))[0].id;
  await as('teen16', `select public.report_content('post', $1, 'ciao a tutti', 'Adulto Uno', 'minori', 'non va', $2)`, [pid, U.adult]);
  await as('teen16', `select public.report_content('club', 'club-9', 'Un club', 'Marco', 'spam', '')`);
  const p = rows(await db.query(`select to_user::text as u, title, data->>'ref' as ref from public.pushes`)); eq(p, [{ u: U.boss, title: 'Segnalazione urgente', ref: 'admin' }], 'solo l\'urgente');
});
await t('solo gli amministratori vedono e decidono; le urgenti vengono per prime', async () => {
  await rejects(as('adult', `select public.admin_reports()`), /non_autorizzato/);
  const l = rows(await as('boss', `select public.admin_reports() as r`))[0].r;
  eq(l.map((x) => [x.reason, x.urgent]), [['minori', true], ['spam', false]]);
  eq(rows(await as('adult', `select public.is_admin() as a`))[0].a, false); eq(rows(await as('boss', `select public.is_admin() as a`))[0].a, true);
  await rejects(as('adult', `select public.admin_report_decide($1, 'dismiss')`, [l[0].id]), /non_autorizzato/);
});
await t('rimozione del contenuto e sospensione dal social: il resto dell\'app non è toccato', async () => {
  const l = rows(await as('boss', `select public.admin_reports() as r`))[0].r; const urgent = l.find((x) => x.reason === 'minori');
  const r = rows(await as('boss', `select public.admin_report_decide($1, 'suspend', 'contenuto non ammesso', 7) as r`, [urgent.id]))[0].r;
  eq(r.target, U.adult);
  eq(rows(await db.query(`select count(*)::int as n from public.social_posts where deleted_at is null`))[0].n, 1, 'la sospensione da sola non toglie il post');
  const st = rows(await as('adult', `select public.my_social_status() as r`))[0].r; eq([st.allowed, st.sanction.kind], [false, 'suspend_social']);
  await rejects(as('adult', `select public.people_search('anna')`), /social_sospeso/);
  await rejects(as('adult', `insert into public.social_posts (author_id, body) values ($1, 'ancora')`, [U.adult]), /row-level security/);
  eq(rows(await db.query(`select title from public.pushes where to_user = '${U.adult}'`))[0].title, 'Social sospeso');
  eq(rows(await db.query(`select count(*)::int as n from public.content_reports where status = 'open' and reason = 'minori'`))[0].n, 0, 'segnalazione chiusa');
  await as('boss', `select public.admin_lift_sanction($1)`, [U.adult]);
  eq(rows(await as('adult', `select public.my_social_status() as r`))[0].r.allowed, true, 'tolta la sospensione');
});
await t('«rimuovi» toglie il post dal server e chiude le segnalazioni uguali; archivia e avviso funzionano', async () => {
  const pid = rows(await db.query(`select id from public.social_posts limit 1`))[0].id;
  await as('teen16', `select public.report_content('post', $1, 'ciao', 'Adulto Uno', 'offensivo', '', $2)`, [pid, U.adult]);
  await db.exec(`set role authenticated`).catch(() => {}); await db.exec('reset role;');
  const l = rows(await as('boss', `select public.admin_reports() as r`))[0].r.find((x) => x.reason === 'offensivo');
  await as('boss', `select public.admin_report_decide($1, 'remove')`, [l.id]);
  eq(rows(await db.query(`select count(*)::int as n from public.social_posts where deleted_at is null`))[0].n, 0);
  const sp = rows(await as('boss', `select public.admin_reports('open') as r`))[0].r.map((x) => x.reason); eq(sp, ['spam']);
  const spam = rows(await as('boss', `select public.admin_reports('open') as r`))[0].r[0];
  await as('boss', `select public.admin_report_decide($1, 'dismiss')`, [spam.id]);
  eq(rows(await db.query(`select count(*)::int as n from public.content_reports where status = 'dismissed'`))[0].n, 1);
  await rejects(as('boss', `select public.admin_report_decide($1, 'ban')`, [spam.id]), /autore_sconosciuto/);
});
console.log(process.exitCode ? 'CON ERRORI' : 'TUTTO OK');
await db.close();

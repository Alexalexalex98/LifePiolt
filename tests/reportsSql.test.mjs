// Prova la migrazione 0039 (segnalazioni dei contenuti) su un Postgres in memoria.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const M = new URL('../supabase/migrations/', import.meta.url).pathname;
const db = new PGlite();
const ok = (m) => console.log('  ok  ', m);
const bad = (m, e) => { console.log('  FAIL', m, '-', String(e?.message ?? e).slice(0, 300)); process.exitCode = 1; };
await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users (id uuid primary key default gen_random_uuid());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated; alter default privileges in schema public grant all on tables to anon, authenticated; alter default privileges in schema public grant all on functions to anon, authenticated;`);
try { await db.exec(readFileSync(M + '0039_content_reports.sql', 'utf8')); ok('0039_content_reports.sql'); } catch (e) { bad('0039', e); }
const U = { a: '00000000-0000-0000-0000-0000000000a1', b: '00000000-0000-0000-0000-0000000000b2' };
for (const id of Object.values(U)) await db.exec(`insert into auth.users (id) values ('${id}')`);
const as = async (u, sql, params) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${U[u]}', false);`); try { return await db.query(sql, params); } finally { await db.exec('reset role;'); } };
const t = async (name, f) => { try { await f(); ok(name); } catch (e) { bad(name, e); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m ?? ''} atteso ${JSON.stringify(b)} ottenuto ${JSON.stringify(a)}`); };
const rejects = async (p, re) => { try { await p; } catch (e) { if (re.test(String(e.message))) return; throw new Error('errore diverso: ' + e.message); } throw new Error('doveva fallire'); };
await t('si segnala un LifeClub; le segnalazioni urgenti sono marcate', async () => {
  await as('a', `select public.report_content('club', 'club-1', 'Club X', 'Marco', 'esplicito', 'foto esplicite')`);
  await as('a', `select public.report_content('clubitem', 'club-1:lez-3', 'Lezione', 'Marco', 'minori', '')`);
  const r = (await db.query(`select reason, urgent from public.content_reports order by reason`)).rows;
  eq(r, [{ reason: 'esplicito', urgent: false }, { reason: 'minori', urgent: true }]);
});
await t('la stessa segnalazione non si duplica (si aggiorna la nota)', async () => {
  await as('a', `select public.report_content('club', 'club-1', 'Club X', 'Marco', 'esplicito', 'nota nuova')`);
  eq((await db.query(`select count(*)::int as n, max(note) as note from public.content_reports where reason = 'esplicito'`)).rows[0], { n: 1, note: 'nota nuova' });
});
await t('privacy: ognuno vede solo le sue; nessuna scrittura diretta; motivo e tipo validi', async () => {
  eq((await as('b', `select count(*)::int as n from public.content_reports`)).rows[0].n, 0);
  eq((await as('a', `select count(*)::int as n from public.content_reports`)).rows[0].n, 2);
  await rejects(as('b', `insert into public.content_reports (reporter_id, kind, ref, reason) values ($1, 'club', 'x', 'spam')`, [U.b]), /permission denied|row-level/);
  await rejects(as('b', `select public.report_content('club', 'x', '', '', 'inventato')`), /violates check/);
  await rejects(as('b', `select public.report_content('boh', 'x', '', '', 'spam')`), /violates check/);
});
await t('freno: massimo 30 segnalazioni al giorno', async () => {
  for (let i = 0; i < 30; i++) await as('b', `select public.report_content('post', $1, '', '', 'spam')`, ['p' + i]);
  await rejects(as('b', `select public.report_content('post', 'p99', '', '', 'spam')`), /troppe_segnalazioni/);
});
console.log(process.exitCode ? 'CON ERRORI' : 'TUTTO OK');
await db.close();

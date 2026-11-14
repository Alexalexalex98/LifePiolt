// Prova la migrazione 0032 (Gruppo di lavoro) su un Postgres in memoria, con permessi e scenari reali. NON serve il server.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const M = new URL('../supabase/migrations/', import.meta.url).pathname;
const db = new PGlite();
const ok = (m) => console.log('  ok  ', m);
const bad = (m, e) => { console.log('  FAIL', m, '-', String(e?.message ?? e).slice(0, 300)); process.exitCode = 1; };
// --- stub dell'ambiente Supabase
await db.exec(`
create role anon; create role authenticated;
create schema auth; create schema storage; create schema extensions;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
create table storage.objects (bucket_id text, name text, owner uuid);
create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n, '/') $$;
create publication supabase_realtime;
create table public.profiles (user_id uuid primary key, nome text, cognome text);
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
`);
async function load(file, only) {
  let sql = readFileSync(M + file, 'utf8');
  if (only) sql = only(sql);
  try { await db.exec(sql); ok(file); } catch (e) { bad(file, e); }
}
await db.exec('create extension if not exists pgcrypto;').catch(() => {});
await db.exec(`create or replace function public.gen_random_bytes(n int) returns bytea language sql as $$ select decode(md5(random()::text), 'hex') $$;`);
// 0014: solo la parte team (senza storage policy)
await load('0014_team_drive.sql', (s) => s.replace(/create policy team_drive[\s\S]*?;\n/g, '').replace(/insert into storage\.buckets[\s\S]*?;\n/, ''));
await load('0016_team_work_plan.sql');
await load('0019_team_messages.sql');
await load('0027_team_reschedule.sql');
await load('0032_work_group.sql');

// --- scenario
const U = { boss: '00000000-0000-0000-0000-0000000000b1', ann: '00000000-0000-0000-0000-0000000000a1', bob: '00000000-0000-0000-0000-0000000000b2', cat: '00000000-0000-0000-0000-0000000000c3' };
for (const [k, id] of Object.entries(U)) await db.exec(`insert into auth.users (id, email) values ('${id}', '${k}@x.it'); insert into public.profiles (user_id, nome, cognome) values ('${id}', '${k}', 'Test');`);
const as = async (u, sql, params) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${U[u]}', false);`); try { return await db.query(sql, params); } finally { await db.exec('reset role;'); } };
const rows = (r) => r.rows;
const t = async (name, f) => { try { await f(); ok(name); } catch (e) { bad(name, e); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m ?? ''} atteso ${JSON.stringify(b)} ottenuto ${JSON.stringify(a)}`); };
const rejects = async (p, re) => { try { await p; } catch (e) { if (re.test(String(e.message))) return; throw new Error('errore diverso: ' + e.message); } throw new Error('doveva fallire'); };

let team;
await t('crea gruppo e aggiunge membri', async () => {
  team = rows(await as('boss', `select public.group_create('Bar Sole') as id`))[0].id;
  await db.exec(`insert into public.team_members (team_id, user_id, role) values ('${team}', '${U.ann}', 'member'), ('${team}', '${U.bob}', 'member'), ('${team}', '${U.cat}', 'member')`);
  eq(rows(await db.query(`select kind from public.teams where id = '${team}'`))[0].kind, 'group');
  eq(rows(await db.query(`select count(*)::int as n from public.team_messages where team_id = '${team}' and channel = 'general'`))[0].n, 1, 'chat di gruppo');
});
let s1;
await t('il datore pubblica un turno: resta da confermare e il Plan non cambia', async () => {
  s1 = rows(await as('boss', `select public.group_shift_set($1, $2, '2026-12-07', '09:00', '17:00', 'Mattina') as id`, [team, U.ann]))[0].id;
  eq(rows(await db.query(`select status from public.group_shifts where id = '${s1}'`))[0].status, 'proposed');
  eq(rows(await db.query(`select count(*)::int as n from public.team_events where id = 'gs${s1}'`))[0].n, 0);
  eq(rows(await db.query(`select kind from public.team_notifications where user_id = '${U.ann}'`)).map((r) => r.kind), ['shift_ask']);
});
await t('un dipendente non può pubblicare turni', async () => { await rejects(as('bob', `select public.group_shift_set($1, $2, '2026-12-08', '09:00', '17:00', 'x')`, [team, U.bob]), /non_autorizzato/); });
await t('il dipendente conferma: il turno finisce nel suo Plan e il datore è avvisato', async () => {
  eq(rows(await as('ann', `select public.group_shift_answer($1, true) as r`, [s1]))[0].r, 'accepted');
  eq(rows(await db.query(`select status from public.group_shifts where id = '${s1}'`))[0].status, 'confirmed');
  const ev = rows(await db.query(`select title, time, attendees::text from public.team_events where id = 'gs${s1}'`))[0];
  eq([ev.title, ev.time], ['Mattina', '09:00']);
  eq(rows(await db.query(`select count(*)::int as n from public.team_notifications where user_id = '${U.boss}' and kind = 'shift_ok'`))[0].n, 1);
});
await t('un altro non può rispondere al posto suo', async () => { await rejects(as('bob', `select public.group_shift_answer($1, true)`, [s1]), /non_trovato/); });
await t('turni sovrapposti rifiutati (anche oltre la mezzanotte e nei giorni vicini)', async () => {
  await rejects(as('boss', `select public.group_shift_set($1, $2, '2026-12-07', '16:00', '20:00', 'x')`, [team, U.ann]), /sovrapposto/);
  const n = rows(await as('boss', `select public.group_shift_set($1, $2, '2026-12-07', '22:00', '03:00', 'Notte') as id`, [team, U.ann]))[0].id;
  await rejects(as('boss', `select public.group_shift_set($1, $2, '2026-12-08', '01:00', '05:00', 'x')`, [team, U.ann]), /sovrapposto/);
  await as('boss', `select public.group_shift_remove($1)`, [n]); // ancora da confermare: si toglie subito
  eq(rows(await db.query(`select count(*)::int as n from public.group_shifts where id = '${n}'`))[0].n, 0);
});
await t('cambio di un turno confermato: se il dipendente non accetta torna quello di prima', async () => {
  await as('boss', `select public.group_shift_set($1, $2, '2026-12-07', '10:00', '18:00', 'Mattina', $3)`, [team, U.ann, s1]);
  eq(rows(await db.query(`select status, start_t from public.group_shifts where id = '${s1}'`))[0], { status: 'proposed', start_t: '10:00' });
  eq(rows(await as('ann', `select public.group_shift_answer($1, false) as r`, [s1]))[0].r, 'declined');
  eq(rows(await db.query(`select status, start_t from public.group_shifts where id = '${s1}'`))[0], { status: 'confirmed', start_t: '09:00' });
  eq(rows(await db.query(`select time from public.team_events where id = 'gs${s1}'`))[0].time, '09:00');
});
await t('un turno nuovo rifiutato resta «declined»; cancellazione di un turno confermato chiede conferma', async () => {
  const n = rows(await as('boss', `select public.group_shift_set($1, $2, '2026-12-09', '09:00', '13:00', 'Nuovo') as id`, [team, U.ann]))[0].id;
  await as('ann', `select public.group_shift_answer($1, false)`, [n]);
  eq(rows(await db.query(`select status from public.group_shifts where id = '${n}'`))[0].status, 'declined');
  await as('boss', `select public.group_shift_remove($1)`, [s1]);
  eq(rows(await db.query(`select status, removal from public.group_shifts where id = '${s1}'`))[0], { status: 'proposed', removal: true });
  await as('ann', `select public.group_shift_answer($1, false)`, [s1]); // non rinuncia: resta
  eq(rows(await db.query(`select status, removal from public.group_shifts where id = '${s1}'`))[0], { status: 'confirmed', removal: false });
});
await t('privacy: un dipendente vede solo i propri turni, il datore tutti', async () => {
  eq(rows(await as('bob', `select count(*)::int as n from public.group_shifts`))[0].n, 0);
  eq(rows(await as('ann', `select count(*)::int as n from public.group_shifts`))[0].n >= 1, true);
  eq(rows(await as('boss', `select count(*)::int as n from public.group_shifts`))[0].n >= 2, true);
  await rejects(as('bob', `insert into public.group_shifts (id, team_id, user_id, day, start_t, end_t, status) values ('x', '${team}', '${U.bob}', '2026-12-10', '09:00', '10:00', 'confirmed')`), /permission denied|row-level/);
});
await t('disponibilità e turno scoperto: avvisa prima chi è disponibile e libero', async () => {
  await as('bob', `select public.group_cover_set($1, true, 'anche di sera')`, [team]);
  await as('ann', `select public.group_cover_set($1, true, '')`, [team]);
  const r = rows(await as('boss', `select public.group_cover_ask($1, '2026-12-07', '12:00', '16:00', 'Pranzo') as r`, [team]))[0].r;
  eq(r.notified, 1, 'ann è già al lavoro 9-17: solo bob'); // cat non è disponibile
  eq(rows(await db.query(`select user_id::text as u from public.team_notifications where kind = 'cover_ask'`)).map((x) => x.u), [U.bob]);
  const w = rows(await as('boss', `select public.group_cover_ask($1, '2026-12-07', '12:00', '16:00', 'Pranzo', true) as r`, [team]))[0].r;
  eq(w.notified, 1, 'allargando: avvisa anche cat, bob non due volte');
  eq(rows(await db.query(`select user_id::text as u from public.team_notifications where kind = 'cover_ask' order by user_id`)).map((x) => x.u), [U.bob, U.cat]);
  await as('bob', `select public.group_cover_take($1)`, [r.id]);
  await rejects(as('cat', `select public.group_cover_take($1)`, [r.id]), /gia_coperto/);
  eq(rows(await db.query(`select count(*)::int as n from public.group_shifts where user_id = '${U.bob}' and status = 'confirmed' and start_t = '12:00'`))[0].n, 1);
});
await t('scambio di turno con controllo delle sovrapposizioni', async () => {
  const bobShift = rows(await db.query(`select id from public.group_shifts where user_id = '${U.bob}' and start_t = '12:00'`))[0].id;
  const c1 = rows(await as('boss', `select public.group_shift_set($1, $2, '2026-12-11', '09:00', '17:00', 'Venerdì') as id`, [team, U.cat]))[0].id;
  await as('cat', `select public.group_shift_answer($1, true)`, [c1]);
  const w = rows(await as('cat', `select public.group_swap_open($1, 'ho una visita') as id`, [c1]))[0].id;
  eq(rows(await db.query(`select count(*)::int as n from public.team_messages where team_id = '${team}' and text like 'Ho bisogno%'`))[0].n, 1);
  // ann è libera l'11: può prenderlo; bob ha il turno del 7, non quello: libero anche lui
  await as('ann', `select public.group_cover_set($1, true, '')`, [team]);
  // scambio con contropartita sovrapposta: ann cede il suo turno del 7 a cat? cat non ha impegni il 7: ok. Ma se la contropartita cade sul turno che cat cede → ok; qui provo un clash vero:
  const clash = rows(await as('boss', `select public.group_shift_set($1, $2, '2026-12-11', '10:00', '12:00', 'Sovrappone') as id`, [team, U.ann]))[0].id;
  await as('ann', `select public.group_shift_answer($1, true)`, [clash]);
  await rejects(as('ann', `select public.group_swap_take($1)`, [w]), /sovrapposto/);
  eq(rows(await as('bob', `select public.group_swap_take($1) as r`, [w]))[0].r, c1);
  eq(rows(await db.query(`select user_id::text as u from public.group_shifts where id = '${c1}'`))[0].u, U.bob);
  eq(rows(await db.query(`select status from public.group_swaps where id = '${w}'`))[0].status, 'taken');
  void bobShift;
});
await t('conferma mensile e panoramica del datore (solo ore, ferie, conferme)', async () => {
  const m = rows(await as('ann', `select public.group_month_open($1, '2026-12') as r`, [team]))[0].r;
  eq(m.status, 'pending'); eq(m.hours > 0, true);
  await as('ann', `select public.group_month_confirm($1, '2026-12', 'abc123')`, [team]);
  eq(rows(await db.query(`select status, digest from public.group_months where user_id = '${U.ann}'`))[0], { status: 'confirmed', digest: 'abc123' });
  await as('boss', `select public.group_contract_set($1, $2, 38, 22, 'bank', null, 1.25, 6, null)`, [team, U.ann]);
  const ov = rows(await as('boss', `select public.group_overview($1, '2026-12-01', '2026-12-31') as r`, [team]))[0].r;
  const ann = ov.find((x) => x.user_id === U.ann);
  eq([ann.weekly_hours, ann.vacation_days, ann.overtime_mode, ann.month_confirmed], [38, 22, 'bank', true]);
  eq(ann.planned > 0 && ann.target > 0, true);
  eq(Object.keys(ann).some((k) => /pay|salary|wage|gross|net|euro|amount/i.test(k)), false, 'nessun importo');
  await rejects(as('bob', `select public.group_overview($1, '2026-12-01', '2026-12-31')`, [team]), /non_autorizzato/);
  eq(rows(await as('ann', `select weekly_hours::float as w from public.group_contracts`))[0].w, 38);
  eq(rows(await as('bob', `select count(*)::int as n from public.group_contracts`))[0].n, 0);
});
console.log(process.exitCode ? 'CON ERRORI' : 'TUTTO OK');
await db.close();

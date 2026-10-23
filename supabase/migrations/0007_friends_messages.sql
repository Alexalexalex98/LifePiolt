-- =====================================================================================================
-- LifePilot - migrazione 0007: AMICI (codice amico) e MESSAGGI DIRETTI tra due persone.
--  - ognuno ha un codice amico; chi lo conosce puo' mandare una richiesta; si diventa amici solo se l'altro accetta;
--  - i messaggi si possono scrivere SOLO tra amici (controllato dal server) e li leggono solo mittente e destinatario (RLS);
--  - nessuna ricerca per nome: se non dai il tuo codice, nessuno puo' trovarti.
-- ATTENZIONE: i messaggi stanno sul server in chiaro (non ancora cifrati end-to-end): chi amministra il progetto puo' leggerli.
-- Va scritto nell'informativa. Scrittura solo tramite funzioni. Idempotente.
-- =====================================================================================================
alter table public.social_profiles add column if not exists friend_code text;
create unique index if not exists social_profiles_friend_code on public.social_profiles (friend_code);

create or replace function public.my_friend_code() returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c text; i int;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select friend_code into c from public.social_profiles where user_id = uid;
  if not found then raise exception 'profilo_pubblico_mancante' using errcode = 'P0001'; end if;
  if c is not null then return c; end if;
  for i in 1..20 loop
    c := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 8));
    begin
      update public.social_profiles set friend_code = c where user_id = uid;
      return c;
    exception when unique_violation then null;
    end;
  end loop;
  raise exception 'codice_non_creato' using errcode = 'P0001';
end $$;

create table if not exists public.friendships (
  user_low     uuid not null references auth.users (id) on delete cascade,
  user_high    uuid not null references auth.users (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  status       text not null check (status in ('pending', 'accepted', 'blocked')),
  blocked_by   uuid references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low < user_high)
);
alter table public.friendships enable row level security;
revoke all on public.friendships from public, anon, authenticated;
grant select on public.friendships to authenticated;
drop policy if exists fr_read on public.friendships;
create policy fr_read on public.friendships for select to authenticated using (auth.uid() in (user_low, user_high));

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.friendships where user_low = least(a, b) and user_high = greatest(a, b) and status = 'accepted');
$$;

create or replace function public.friend_request(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); other uuid; lo uuid; hi uuid; f public.friendships; recent int;
begin
  if me is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select count(*) into recent from public.friendships where requested_by = me and created_at > now() - interval '1 hour';
  if recent >= 20 then return jsonb_build_object('ok', false, 'error', 'troppe_richieste'); end if;
  select user_id into other from public.social_profiles where friend_code = upper(btrim(coalesce(p_code, '')));
  if other is null or other = me then return jsonb_build_object('ok', false, 'error', 'codice_non_valido'); end if;
  lo := least(me, other); hi := greatest(me, other);
  select * into f from public.friendships where user_low = lo and user_high = hi;
  if found then
    if f.status = 'blocked' then return jsonb_build_object('ok', false, 'error', 'codice_non_valido'); end if;
    if f.status = 'accepted' then return jsonb_build_object('ok', true, 'status', 'accepted'); end if;
    if f.requested_by <> me then
      update public.friendships set status = 'accepted', updated_at = now() where user_low = lo and user_high = hi;
      return jsonb_build_object('ok', true, 'status', 'accepted');
    end if;
    return jsonb_build_object('ok', true, 'status', 'pending');
  end if;
  insert into public.friendships (user_low, user_high, requested_by, status) values (lo, hi, me, 'pending');
  return jsonb_build_object('ok', true, 'status', 'pending');
end $$;

create or replace function public.friend_respond(p_other uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); lo uuid := least(auth.uid(), p_other); hi uuid := greatest(auth.uid(), p_other); n int;
begin
  if me is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if p_accept then
    update public.friendships set status = 'accepted', updated_at = now() where user_low = lo and user_high = hi and status = 'pending' and requested_by <> me;
  else
    delete from public.friendships where user_low = lo and user_high = hi and status = 'pending' and requested_by <> me;
  end if;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n > 0);
end $$;

-- toglie un amico o ritira/annulla una richiesta; non toglie un blocco messo dall'altra persona
create or replace function public.friend_remove(p_other uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); n int;
begin
  if me is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  delete from public.friendships where user_low = least(me, p_other) and user_high = greatest(me, p_other) and (status <> 'blocked' or blocked_by = me);
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n > 0);
end $$;

create or replace function public.friend_block(p_other uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if p_other = me then return jsonb_build_object('ok', false); end if;
  insert into public.friendships (user_low, user_high, requested_by, status, blocked_by) values (least(me, p_other), greatest(me, p_other), me, 'blocked', me)
  on conflict (user_low, user_high) do update set status = 'blocked', blocked_by = me, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- la lista: amici, richieste ricevute e inviate, persone bloccate da me. Chi mi ha bloccato non compare.
create or replace function public.friends_list() returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', o.id, 'name', coalesce(p.display_name, 'Utente'), 'status', case when f.status = 'pending' then (case when f.requested_by = me then 'pending_out' else 'pending_in' end) when f.status = 'blocked' then 'blocked' else 'accepted' end, 'since', f.updated_at)
      order by f.updated_at desc)
    from public.friendships f
    cross join lateral (select case when f.user_low = me then f.user_high else f.user_low end as id) o
    left join public.social_profiles p on p.user_id = o.id
    where me in (f.user_low, f.user_high) and (f.status <> 'blocked' or f.blocked_by = me)), '[]'::jsonb);
end $$;

-- ---- messaggi diretti ----------------------------------------------------------------------------------
create table if not exists public.dm_messages (
  id         uuid primary key default gen_random_uuid(),
  sender     uuid not null references auth.users (id) on delete cascade,
  recipient  uuid not null references auth.users (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 4000),
  client_id  text check (client_id is null or char_length(client_id) <= 64),
  created_at timestamptz not null default now(),
  read_at    timestamptz,
  check (sender <> recipient)
);
create unique index if not exists dm_messages_client on public.dm_messages (sender, client_id) where client_id is not null;
create index if not exists dm_messages_recipient on public.dm_messages (recipient, created_at desc);
create index if not exists dm_messages_sender on public.dm_messages (sender, created_at desc);
alter table public.dm_messages enable row level security;
revoke all on public.dm_messages from public, anon, authenticated;
grant select, insert on public.dm_messages to authenticated;
drop policy if exists dm_read on public.dm_messages;
drop policy if exists dm_send on public.dm_messages;
create policy dm_read on public.dm_messages for select to authenticated using (auth.uid() in (sender, recipient));
create policy dm_send on public.dm_messages for insert to authenticated with check (sender = auth.uid() and public.are_friends(sender, recipient));

create or replace function public.dm_mark_read(p_other uuid) returns void
language sql security definer set search_path = '' as $$
  update public.dm_messages set read_at = now() where recipient = auth.uid() and sender = p_other and read_at is null;
$$;

revoke all on function public.my_friend_code() from public, anon, authenticated;
revoke all on function public.are_friends(uuid, uuid) from public, anon, authenticated;
revoke all on function public.friend_request(text) from public, anon, authenticated;
revoke all on function public.friend_respond(uuid, boolean) from public, anon, authenticated;
revoke all on function public.friend_remove(uuid) from public, anon, authenticated;
revoke all on function public.friend_block(uuid) from public, anon, authenticated;
revoke all on function public.friends_list() from public, anon, authenticated;
revoke all on function public.dm_mark_read(uuid) from public, anon, authenticated;
grant execute on function public.my_friend_code() to authenticated;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.friend_request(text) to authenticated;
grant execute on function public.friend_respond(uuid, boolean) to authenticated;
grant execute on function public.friend_remove(uuid) to authenticated;
grant execute on function public.friend_block(uuid) to authenticated;
grant execute on function public.friends_list() to authenticated;
grant execute on function public.dm_mark_read(uuid) to authenticated;

-- messaggi in tempo reale (Supabase Realtime rispetta le regole RLS)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'dm_messages') then
    alter publication supabase_realtime add table public.dm_messages;
  end if;
end $$;

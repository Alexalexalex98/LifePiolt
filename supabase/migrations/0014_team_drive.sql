-- Team di lavoro con Drive privato condiviso: oggetti nuovi, nessuna modifica a quelli esistenti.
-- NON ancora applicata sul progetto Lifepilot2 (l'applicazione è in attesa di conferma).
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  owner uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create table if not exists public.team_invites (
  code text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  used_by uuid
);
create table if not exists public.team_files (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  size bigint not null default 0,
  mime text,
  path text not null unique,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists team_members_user on public.team_members (user_id);
create index if not exists team_files_team on public.team_files (team_id, created_at desc);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;
alter table public.team_files enable row level security;

create or replace function public.is_team_member(t uuid, min_role text default 'member') returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = t and m.user_id = auth.uid()
      and (min_role = 'member' or (min_role = 'admin' and m.role in ('owner', 'admin')) or (min_role = 'owner' and m.role = 'owner'))
  )
$$;
revoke all on function public.is_team_member(uuid, text) from public, anon;
grant execute on function public.is_team_member(uuid, text) to authenticated;

create policy teams_select on public.teams for select to authenticated using (public.is_team_member(id));
create policy members_select on public.team_members for select to authenticated using (public.is_team_member(team_id));
create policy files_select on public.team_files for select to authenticated using (public.is_team_member(team_id));
create policy files_insert on public.team_files for insert to authenticated with check (public.is_team_member(team_id) and uploaded_by = auth.uid());
create policy files_delete on public.team_files for delete to authenticated using (uploaded_by = auth.uid() or public.is_team_member(team_id, 'admin'));
-- team_invites: nessuna policy, solo tramite le funzioni qui sotto

create or replace function public.team_create(p_name text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); tid uuid;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if (select count(*) from public.teams where owner = uid) >= 10 then raise exception 'troppi_team' using errcode = 'P0001'; end if;
  insert into public.teams (name, owner) values (left(btrim(p_name), 80), uid) returning id into tid;
  insert into public.team_members (team_id, user_id, role) values (tid, uid, 'owner');
  return tid;
end $$;

create or replace function public.team_invite(p_team uuid, p_role text default 'member') returns text
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); c text;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if not public.is_team_member(p_team, 'admin') then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  if p_role not in ('admin', 'member') then p_role := 'member'; end if;
  c := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));
  insert into public.team_invites (code, team_id, role, created_by, expires_at) values (c, p_team, p_role, uid, now() + interval '7 days');
  return c;
end $$;

create or replace function public.team_join(p_code text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); i public.team_invites;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into i from public.team_invites where code = upper(btrim(p_code)) for update;
  if not found or i.used_by is not null or i.expires_at < now() then raise exception 'invito_non_valido' using errcode = 'P0001'; end if;
  insert into public.team_members (team_id, user_id, role) values (i.team_id, uid, i.role) on conflict (team_id, user_id) do nothing;
  update public.team_invites set used_by = uid where code = i.code;
  return i.team_id;
end $$;

create or replace function public.team_list() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'role', m.role, 'members', (select count(*) from public.team_members x where x.team_id = t.id)) order by t.created_at), '[]'::jsonb)
  from public.team_members m join public.teams t on t.id = m.team_id where m.user_id = auth.uid()
$$;

create or replace function public.team_members_list(p_team uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_team_member(p_team) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'role', m.role, 'name', btrim(coalesce(p.nome, '') || ' ' || coalesce(p.cognome, ''))) order by m.joined_at), '[]'::jsonb)
          from public.team_members m left join public.profiles p on p.user_id = m.user_id where m.team_id = p_team);
end $$;

create or replace function public.team_remove_member(p_team uuid, p_user uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if p_user <> uid and not public.is_team_member(p_team, 'admin') then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  if exists (select 1 from public.team_members where team_id = p_team and user_id = p_user and role = 'owner') then raise exception 'il_proprietario_non_esce' using errcode = 'P0001'; end if;
  delete from public.team_members where team_id = p_team and user_id = p_user;
end $$;

create or replace function public.team_delete(p_team uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_team_member(p_team, 'owner') then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  delete from public.teams where id = p_team;
end $$;

revoke all on function public.team_create(text), public.team_invite(uuid, text), public.team_join(text), public.team_list(), public.team_members_list(uuid), public.team_remove_member(uuid, uuid), public.team_delete(uuid) from public, anon;
grant execute on function public.team_create(text), public.team_invite(uuid, text), public.team_join(text), public.team_list(), public.team_members_list(uuid), public.team_remove_member(uuid, uuid), public.team_delete(uuid) to authenticated;

-- Drive del team: cartella privata, ogni file sta sotto «<id del team>/...» e lo vedono solo i membri
insert into storage.buckets (id, name, public, file_size_limit) values ('team-drive', 'team-drive', false, 52428800) on conflict (id) do nothing;
create policy team_drive_select on storage.objects for select to authenticated using (bucket_id = 'team-drive' and public.is_team_member(((storage.foldername(name))[1])::uuid));
create policy team_drive_insert on storage.objects for insert to authenticated with check (bucket_id = 'team-drive' and public.is_team_member(((storage.foldername(name))[1])::uuid));
create policy team_drive_delete on storage.objects for delete to authenticated using (bucket_id = 'team-drive' and (owner = auth.uid() or public.is_team_member(((storage.foldername(name))[1])::uuid, 'admin')));

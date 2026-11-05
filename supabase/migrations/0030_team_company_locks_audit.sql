-- Workspace Lavoro, punto 15 (funzioni di base): impostazioni dell'azienda (paese, valuta, piano AI a carico dell'azienda),
-- progetti riservati con password controllata dal server, cronologia di ogni modifica. Non crea pagamenti e non compra nulla.

/* ---------- impostazioni dell'azienda ---------- */
create table if not exists public.team_settings (
  team_id uuid primary key references public.teams (id) on delete cascade,
  country text not null default 'IT' check (country in ('IT', 'CH')),
  currency text not null default 'EUR' check (currency in ('CHF', 'EUR')),
  ai_plan boolean not null default false,
  ai_all boolean not null default true,
  ai_members uuid[] not null default '{}',
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.team_settings enable row level security;
create policy settings_select on public.team_settings for select to authenticated using (public.is_team_member(team_id));
revoke insert, update, delete on public.team_settings from authenticated, anon;

create or replace function public.team_settings_save(p_team uuid, p_country text, p_currency text, p_ai_plan boolean, p_ai_all boolean, p_ai_members uuid[]) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if not public.is_team_member(p_team, 'admin') then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  if exists (select 1 from unnest(coalesce(p_ai_members, '{}')) a where not exists (select 1 from public.team_members m where m.team_id = p_team and m.user_id = a)) then raise exception 'persona_non_nel_team' using errcode = 'P0001'; end if;
  insert into public.team_settings (team_id, country, currency, ai_plan, ai_all, ai_members, updated_by, updated_at)
  values (p_team, p_country, p_currency, coalesce(p_ai_plan, false), coalesce(p_ai_all, true), coalesce(p_ai_members, '{}'), auth.uid(), now())
  on conflict (team_id) do update set country = excluded.country, currency = excluded.currency, ai_plan = excluded.ai_plan, ai_all = excluded.ai_all, ai_members = excluded.ai_members, updated_by = auth.uid(), updated_at = now();
  insert into public.team_audit (team_id, user_id, action, target, label) values (p_team, auth.uid(), 'modificato', 'settings', 'impostazioni: ' || p_country || ' ' || p_currency || ' · piano AI ' || case when coalesce(p_ai_plan, false) then 'attivo' else 'spento' end);
end $$;

create or replace function public.team_ai_status(p_team uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare s public.team_settings;
begin
  if not public.is_team_member(p_team) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  select * into s from public.team_settings where team_id = p_team;
  if not found or not s.ai_plan then return jsonb_build_object('plan', false, 'covered', false); end if;
  return jsonb_build_object('plan', true, 'covered', s.ai_all or auth.uid() = any (s.ai_members));
end $$;

/* ---------- progetti riservati con password ---------- */
create table if not exists public.team_page_locks (
  page_id text primary key references public.team_pages (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  hash text not null,
  ver bigint not null default 1,
  set_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create table if not exists public.team_page_unlocks (
  user_id uuid not null references auth.users (id) on delete cascade,
  page_id text not null references public.team_pages (id) on delete cascade,
  ver bigint not null,
  expires_at timestamptz not null,
  primary key (user_id, page_id)
);
create table if not exists public.team_page_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  page_id text not null references public.team_pages (id) on delete cascade,
  fails int not null default 0,
  first_at timestamptz not null default now(),
  primary key (user_id, page_id)
);
alter table public.team_page_locks enable row level security;
alter table public.team_page_unlocks enable row level security;
alter table public.team_page_attempts enable row level security;
revoke all on public.team_page_locks, public.team_page_unlocks, public.team_page_attempts from authenticated, anon;

create or replace function public.page_visible(p_id text) returns boolean
language sql stable security definer set search_path = ''
as $$
  with recursive chain as (
    select id, parent, 0 as d from public.team_pages where id = p_id
    union all
    select t.id, t.parent, c.d + 1 from public.team_pages t join chain c on t.id = c.parent where c.d < 25
  )
  select not exists (
    select 1 from chain c join public.team_page_locks l on l.page_id = c.id
    where not (public.is_team_member(l.team_id, 'admin')
      or exists (select 1 from public.team_page_unlocks u where u.user_id = auth.uid() and u.page_id = c.id and u.ver = l.ver and u.expires_at > now()))
  )
$$;
revoke all on function public.page_visible(text) from public, anon;
grant execute on function public.page_visible(text) to authenticated;

drop policy if exists team_pages_select on public.team_pages;
create policy team_pages_select on public.team_pages for select to authenticated using (public.is_team_member(team_id) and public.page_visible(id));

create or replace function public.team_page_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); tid uuid; cur public.team_pages; tu bigint := coalesce((p ->> 'title_u')::bigint, 0);
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  tid := (p ->> 'team_id')::uuid;
  if not public.is_team_member(tid) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  if octet_length(p::text) > 2000000 then raise exception 'pagina_troppo_grande' using errcode = 'P0001'; end if;
  select * into cur from public.team_pages where id = p ->> 'id' for update;
  if not found then
    if nullif(p ->> 'parent', '') is not null and not public.page_visible(p ->> 'parent') then raise exception 'pagina_riservata' using errcode = 'P0001'; end if;
    insert into public.team_pages (id, team_id, parent, title, kind, blocks, cols, rows, comments, files, title_u, deleted, updated_by)
    values (p ->> 'id', tid, nullif(p ->> 'parent', ''), left(coalesce(p ->> 'title', ''), 200), case when p ->> 'kind' = 'db' then 'db' else 'page' end,
            coalesce(p -> 'blocks', '[]'::jsonb), coalesce(p -> 'cols', '[]'::jsonb), coalesce(p -> 'rows', '[]'::jsonb), coalesce(p -> 'comments', '[]'::jsonb), coalesce(p -> 'files', '[]'::jsonb),
            tu, coalesce((p ->> 'deleted')::boolean, false), uid)
    returning * into cur;
  else
    if cur.team_id <> tid then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
    if not public.page_visible(cur.id) then raise exception 'pagina_riservata' using errcode = 'P0001'; end if;
    update public.team_pages set
      title = case when tu >= cur.title_u then left(coalesce(p ->> 'title', cur.title), 200) else cur.title end,
      title_u = greatest(cur.title_u, tu),
      blocks = public._merge_items(cur.blocks, p -> 'blocks'),
      cols = public._merge_items(cur.cols, p -> 'cols'),
      rows = public._merge_items(cur.rows, p -> 'rows'),
      comments = public._merge_items(cur.comments, p -> 'comments'),
      files = public._merge_items(cur.files, p -> 'files'),
      deleted = cur.deleted or coalesce((p ->> 'deleted')::boolean, false),
      updated_by = uid, updated_at = now()
    where id = cur.id returning * into cur;
  end if;
  return to_jsonb(cur);
end $$;

create or replace function public.team_page_lock(p_page text, p_password text) returns void
language plpgsql security definer set search_path = ''
as $$
declare pg public.team_pages; l public.team_page_locks; v bigint;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if char_length(coalesce(p_password, '')) < 6 then raise exception 'password_troppo_corta' using errcode = 'P0001'; end if;
  select * into pg from public.team_pages where id = p_page;
  if not found then raise exception 'non_trovata' using errcode = 'P0001'; end if;
  if not (public.is_team_member(pg.team_id, 'admin') or public.has_cap(pg.team_id, 'projects.create')) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  select * into l from public.team_page_locks where page_id = p_page;
  if found and not (public.is_team_member(pg.team_id, 'admin') or l.set_by = auth.uid()) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  v := coalesce(l.ver, 0) + 1;
  insert into public.team_page_locks (page_id, team_id, hash, ver, set_by, updated_at) values (p_page, pg.team_id, extensions.crypt(p_password, extensions.gen_salt('bf')), v, auth.uid(), now())
  on conflict (page_id) do update set hash = excluded.hash, ver = v, set_by = auth.uid(), updated_at = now();
  insert into public.team_page_unlocks (user_id, page_id, ver, expires_at) values (auth.uid(), p_page, v, now() + interval '8 hours')
  on conflict (user_id, page_id) do update set ver = v, expires_at = now() + interval '8 hours';
  insert into public.team_audit (team_id, user_id, action, target, label) values (pg.team_id, auth.uid(), 'modificato', p_page, 'pagina riservata: password impostata');
end $$;

create or replace function public.team_page_unlock(p_page text, p_password text) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare l public.team_page_locks; a public.team_page_attempts;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into l from public.team_page_locks where page_id = p_page;
  if not found or not public.is_team_member(l.team_id) then raise exception 'non_trovata' using errcode = 'P0001'; end if;
  select * into a from public.team_page_attempts where user_id = auth.uid() and page_id = p_page;
  if found and a.first_at < now() - interval '15 minutes' then delete from public.team_page_attempts where user_id = auth.uid() and page_id = p_page; a := null; end if;
  if a.fails is not null and a.fails >= 5 then raise exception 'troppi_tentativi' using errcode = 'P0001'; end if;
  if extensions.crypt(coalesce(p_password, ''), l.hash) = l.hash then
    insert into public.team_page_unlocks (user_id, page_id, ver, expires_at) values (auth.uid(), p_page, l.ver, now() + interval '8 hours')
    on conflict (user_id, page_id) do update set ver = l.ver, expires_at = now() + interval '8 hours';
    delete from public.team_page_attempts where user_id = auth.uid() and page_id = p_page;
    insert into public.team_audit (team_id, user_id, action, target, label) values (l.team_id, auth.uid(), 'visto', p_page, 'pagina riservata: sbloccata');
    return true;
  end if;
  insert into public.team_page_attempts (user_id, page_id, fails, first_at) values (auth.uid(), p_page, 1, now())
  on conflict (user_id, page_id) do update set fails = public.team_page_attempts.fails + 1;
  return false;
end $$;

create or replace function public.team_page_relock(p_page text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  delete from public.team_page_unlocks where user_id = auth.uid() and page_id = p_page;
end $$;

create or replace function public.team_page_unprotect(p_page text) returns void
language plpgsql security definer set search_path = ''
as $$
declare l public.team_page_locks;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into l from public.team_page_locks where page_id = p_page;
  if not found then return; end if;
  if not (public.is_team_member(l.team_id, 'admin') or (l.set_by = auth.uid() and public.page_visible(p_page))) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  delete from public.team_page_locks where page_id = p_page;
  insert into public.team_audit (team_id, user_id, action, target, label) values (l.team_id, auth.uid(), 'modificato', p_page, 'pagina riservata: password tolta');
end $$;

create or replace function public.team_locked_pages(p_team uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_team_member(p_team) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', l.page_id, 'title', pg.title, 'parent', pg.parent, 'unlocked', public.page_visible(l.page_id), 'mine', l.set_by = auth.uid()))
    from public.team_page_locks l join public.team_pages pg on pg.id = l.page_id where l.team_id = p_team and not pg.deleted), '[]'::jsonb);
end $$;

revoke all on function public.team_settings_save(uuid, text, text, boolean, boolean, uuid[]), public.team_ai_status(uuid), public.team_page_lock(text, text), public.team_page_unlock(text, text), public.team_page_relock(text), public.team_page_unprotect(text), public.team_locked_pages(uuid) from public, anon;
grant execute on function public.team_settings_save(uuid, text, text, boolean, boolean, uuid[]), public.team_ai_status(uuid), public.team_page_lock(text, text), public.team_page_unlock(text, text), public.team_page_relock(text), public.team_page_unprotect(text), public.team_locked_pages(uuid) to authenticated;

/* ---------- cronologia di ogni modifica ---------- */
create or replace function public._audit_row() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare j jsonb; o jsonb; tid uuid; act text; lbl text; tgt text; uid uuid := auth.uid();
begin
  if uid is null then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then j := to_jsonb(old); else j := to_jsonb(new); end if;
  tid := (j ->> 'team_id')::uuid;
  if not exists (select 1 from public.teams where id = tid) then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' then
    o := to_jsonb(old);
    if tg_table_name = 'team_pages' and not (o ->> 'deleted' is distinct from j ->> 'deleted' or o ->> 'title' is distinct from j ->> 'title') then return new; end if;
    if tg_table_name = 'team_members' and not (o ->> 'role' is distinct from j ->> 'role' or o ->> 'position' is distinct from j ->> 'position') then return new; end if;
    if (o - 'updated_at' - 'blocks' - 'rows' - 'comments') = (j - 'updated_at' - 'blocks' - 'rows' - 'comments') then return new; end if;
  end if;
  act := case tg_op when 'INSERT' then 'creato' when 'DELETE' then 'eliminato' else case when (j ->> 'deleted') = 'true' then 'eliminato' else 'modificato' end end;
  tgt := coalesce(j ->> 'id', j ->> 'user_id', '');
  lbl := tg_argv[0] || ': ' || left(coalesce(nullif(j ->> 'title', ''), nullif(j ->> 'description', ''), nullif(j ->> 'goal', ''), nullif(j ->> 'category', ''), nullif(j ->> 'role', ''), tgt), 120);
  insert into public.team_audit (team_id, user_id, action, target, label) values (tid, uid, act, tgt, lbl);
  return coalesce(new, old);
end $$;
revoke all on function public._audit_row() from public, anon, authenticated;
create trigger audit_team_tasks after insert or update or delete on public.team_tasks for each row execute function public._audit_row('task');
create trigger audit_team_projects after insert or update or delete on public.team_projects for each row execute function public._audit_row('progetto');
create trigger audit_team_docs after insert or update or delete on public.team_docs for each row execute function public._audit_row('documento');
create trigger audit_team_expenses after insert or update or delete on public.team_expenses for each row execute function public._audit_row('nota spese');
create trigger audit_team_members after insert or update or delete on public.team_members for each row execute function public._audit_row('persona');
create trigger audit_team_pages after insert or update on public.team_pages for each row execute function public._audit_row('pagina');
create trigger audit_team_trips after insert or update or delete on public.team_trips for each row execute function public._audit_row('trasferta');

alter publication supabase_realtime add table public.team_settings;
notify pgrst, 'reload schema';

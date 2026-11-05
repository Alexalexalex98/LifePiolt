-- Workspace Lavoro, punto 11 (legale e conformità): contratti letti, adempimenti, registro dei trattamenti, lettere, e lo storico di chi ha fatto/visto cosa.
-- Solo oggetti nuovi. Vede e modifica solo chi ha il permesso «legal.docs» (titolare e amministratori sempre).
create table if not exists public.team_legal (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  kind text not null check (kind in ('contract', 'processing', 'check', 'letter')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  data jsonb not null default '{}'::jsonb,
  due date,
  created_by uuid not null references auth.users (id) on delete cascade,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_legal_team on public.team_legal (team_id, kind);
create table if not exists public.team_audit (
  id bigint generated always as identity primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('creato', 'modificato', 'eliminato', 'visto')),
  target text not null,
  label text not null default '',
  at timestamptz not null default now()
);
create index if not exists team_audit_team on public.team_audit (team_id, at desc);
alter table public.team_legal enable row level security;
alter table public.team_audit enable row level security;
create policy legal_select on public.team_legal for select to authenticated using (public.has_cap(team_id, 'legal.docs'));
create policy legal_insert on public.team_legal for insert to authenticated with check (created_by = auth.uid() and public.has_cap(team_id, 'legal.docs'));
create policy legal_update on public.team_legal for update to authenticated using (public.has_cap(team_id, 'legal.docs')) with check (public.has_cap(team_id, 'legal.docs'));
create policy legal_delete on public.team_legal for delete to authenticated using (public.has_cap(team_id, 'legal.docs'));
create policy audit_select on public.team_audit for select to authenticated using (public.has_cap(team_id, 'legal.docs'));
-- lo storico lo scrivono solo i trigger e team_legal_viewed: nessuno lo modifica a mano
revoke insert, update, delete on public.team_audit from authenticated, anon;

create or replace function public._legal_audit() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.team_audit (team_id, user_id, action, target, label) values (new.team_id, coalesce(auth.uid(), new.created_by), 'creato', new.id, new.kind || ': ' || new.title);
  elsif tg_op = 'UPDATE' then
    new.updated_at := now();
    insert into public.team_audit (team_id, user_id, action, target, label) values (new.team_id, coalesce(auth.uid(), new.created_by), case when new.deleted and not old.deleted then 'eliminato' else 'modificato' end, new.id, new.kind || ': ' || new.title);
  end if;
  return new;
end $$;
revoke all on function public._legal_audit() from public, anon, authenticated;
create trigger team_legal_audit_i after insert on public.team_legal for each row execute function public._legal_audit();
create trigger team_legal_audit_u before update on public.team_legal for each row execute function public._legal_audit();

-- Registra che ho aperto un contratto o una scheda (solo se ho il permesso).
create or replace function public.team_legal_viewed(p_id text) returns void
language plpgsql security definer set search_path = ''
as $$
declare r public.team_legal;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into r from public.team_legal where id = p_id and not deleted;
  if not found or not public.has_cap(r.team_id, 'legal.docs') then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  insert into public.team_audit (team_id, user_id, action, target, label) values (r.team_id, auth.uid(), 'visto', r.id, r.kind || ': ' || r.title);
end $$;
revoke all on function public.team_legal_viewed(text) from public, anon;
grant execute on function public.team_legal_viewed(text) to authenticated;
alter publication supabase_realtime add table public.team_legal;
notify pgrst, 'reload schema';

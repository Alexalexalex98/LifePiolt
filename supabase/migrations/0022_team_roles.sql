-- Ruoli e posizioni di un lavoro d'ufficio (HR, amministrazione, commerciale...) con i loro permessi, applicati dal server.
-- Il ruolo del workspace (proprietario/amministratore/membro) resta com'è; la posizione si aggiunge e dà i permessi di quel lavoro.
alter table public.team_members add column if not exists position text;
alter table public.team_members add column if not exists reports_to uuid references auth.users (id) on delete set null;

create table if not exists public.team_positions (position text primary key, caps text[] not null default '{}');
alter table public.team_positions enable row level security;
create policy positions_select on public.team_positions for select to authenticated using (true);
insert into public.team_positions (position, caps) values
  ('titolare', array['members.manage', 'hr.docs', 'fin.docs', 'legal.docs', 'absence.approve', 'tasks.assign', 'projects.create', 'announce', 'time.view', 'reports.view']::text[]),
  ('ceo', array['members.manage', 'hr.docs', 'fin.docs', 'legal.docs', 'absence.approve', 'tasks.assign', 'projects.create', 'announce', 'time.view', 'reports.view']::text[]),
  ('dg', array['members.manage', 'hr.docs', 'fin.docs', 'legal.docs', 'absence.approve', 'tasks.assign', 'projects.create', 'announce', 'time.view', 'reports.view']::text[]),
  ('coo', array['members.manage', 'absence.approve', 'tasks.assign', 'projects.create', 'announce', 'time.view', 'reports.view']::text[]),
  ('manager', array['absence.approve', 'tasks.assign', 'projects.create', 'announce', 'time.view', 'reports.view']::text[]),
  ('team_lead', array['tasks.assign', 'projects.create', 'time.view']::text[]),
  ('pm', array['tasks.assign', 'projects.create', 'time.view', 'reports.view']::text[]),
  ('hr_manager', array['members.manage', 'hr.docs', 'absence.approve', 'tasks.assign', 'projects.create', 'announce', 'time.view', 'reports.view']::text[]),
  ('hr_specialist', array['hr.docs', 'absence.approve']::text[]),
  ('payroll', array['hr.docs']::text[]),
  ('cfo', array['members.manage', 'fin.docs', 'hr.docs', 'legal.docs', 'absence.approve', 'tasks.assign', 'projects.create', 'announce', 'time.view', 'reports.view']::text[]),
  ('controller', array['fin.docs', 'time.view', 'reports.view']::text[]),
  ('accountant', array['fin.docs']::text[]),
  ('accounts', array['fin.docs']::text[]),
  ('sales_manager', array['legal.docs', 'absence.approve', 'tasks.assign', 'projects.create', 'announce', 'time.view', 'reports.view']::text[]),
  ('account', array[]::text[]),
  ('sales', array[]::text[]),
  ('marketing_manager', array['tasks.assign', 'projects.create', 'announce', 'time.view', 'reports.view']::text[]),
  ('marketer', array['announce']::text[]),
  ('it_manager', array['members.manage', 'tasks.assign', 'projects.create', 'announce', 'time.view']::text[]),
  ('dev', array[]::text[]),
  ('legal', array['legal.docs', 'hr.docs', 'fin.docs', 'tasks.assign', 'projects.create', 'announce', 'reports.view']::text[]),
  ('compliance', array['legal.docs', 'reports.view']::text[]),
  ('ops_manager', array['fin.docs', 'absence.approve', 'tasks.assign', 'projects.create', 'announce', 'time.view', 'reports.view']::text[]),
  ('purchasing', array['fin.docs']::text[]),
  ('customer_care', array[]::text[]),
  ('assistant', array['announce']::text[]),
  ('employee', array[]::text[]),
  ('intern', array[]::text[]),
  ('consultant', array[]::text[]),
  ('guest', array[]::text[])
on conflict (position) do update set caps = excluded.caps;
alter table public.team_members add constraint team_members_position_fk foreign key (position) references public.team_positions (position) on update cascade on delete set null;

create or replace function public.has_cap(t uuid, c text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members m left join public.team_positions p on p.position = m.position
    where m.team_id = t and m.user_id = auth.uid() and (m.role in ('owner', 'admin') or c = any (coalesce(p.caps, '{}')))
  )
$$;

create or replace function public.team_people(p_team uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_team_member(p_team) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'role', m.role, 'position', m.position, 'reports_to', m.reports_to, 'name', btrim(coalesce(p.nome, '') || ' ' || coalesce(p.cognome, ''))) order by m.joined_at), '[]'::jsonb)
          from public.team_members m left join public.profiles p on p.user_id = m.user_id where m.team_id = p_team);
end $$;

-- Cambia posizione e responsabile di una persona (amministratori e chi ha il permesso «gestire le persone», come HR).
create or replace function public.team_set_position(p_team uuid, p_user uuid, p_position text, p_reports_to uuid default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare tr text;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if not public.has_cap(p_team, 'members.manage') then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  select role into tr from public.team_members where team_id = p_team and user_id = p_user;
  if tr is null then raise exception 'persona_non_nel_team' using errcode = 'P0001'; end if;
  if tr in ('owner', 'admin') and not public.is_team_member(p_team, 'admin') then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  if p_position is not null and not exists (select 1 from public.team_positions where position = p_position) then raise exception 'posizione_sconosciuta' using errcode = 'P0001'; end if;
  if p_reports_to is not null and (p_reports_to = p_user or not exists (select 1 from public.team_members where team_id = p_team and user_id = p_reports_to)) then raise exception 'responsabile_non_valido' using errcode = 'P0001'; end if;
  update public.team_members set position = p_position, reports_to = p_reports_to where team_id = p_team and user_id = p_user;
end $$;

-- Promuove o riporta a membro (solo il proprietario).
create or replace function public.team_set_role(p_team uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if not public.is_team_member(p_team, 'owner') then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  if p_role not in ('admin', 'member') then raise exception 'ruolo_non_valido' using errcode = 'P0001'; end if;
  update public.team_members set role = p_role where team_id = p_team and user_id = p_user and role <> 'owner';
end $$;

-- Documenti: oltre a «team», «admin» e «person» ci sono gli accessi per funzione (HR, amministrazione, legale).
alter table public.team_docs drop constraint if exists team_docs_access_check;
alter table public.team_docs add constraint team_docs_access_check check (access in ('team', 'admin', 'hr', 'fin', 'legal', 'person'));

create or replace function public.can_doc_access(t uuid, a text, p uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_team_member(t) and case a
    when 'team' then true when 'admin' then public.is_team_member(t, 'admin')
    when 'hr' then public.has_cap(t, 'hr.docs') when 'fin' then public.has_cap(t, 'fin.docs') when 'legal' then public.has_cap(t, 'legal.docs')
    when 'person' then p = auth.uid() or public.has_cap(t, 'hr.docs') else false end
$$;
create or replace function public.can_doc_write(t uuid, a text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_team_member(t) and case a
    when 'team' then true when 'admin' then public.is_team_member(t, 'admin')
    when 'hr' then public.has_cap(t, 'hr.docs') when 'fin' then public.has_cap(t, 'fin.docs') when 'legal' then public.has_cap(t, 'legal.docs')
    when 'person' then public.has_cap(t, 'hr.docs') else false end
$$;
create or replace function public.can_doc_folder(t uuid, f text, w boolean) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_team_member(t) and case
    when f = 'team' then true when f = 'admin' then public.is_team_member(t, 'admin')
    when f = 'hr' then public.has_cap(t, 'hr.docs') when f = 'fin' then public.has_cap(t, 'fin.docs') when f = 'legal' then public.has_cap(t, 'legal.docs')
    when f like 'p-%' then public.has_cap(t, 'hr.docs') or (not w and f = 'p-' || auth.uid()::text) else false end
$$;
revoke all on function public.has_cap(uuid, text), public.team_people(uuid), public.team_set_position(uuid, uuid, text, uuid), public.team_set_role(uuid, uuid, text), public.can_doc_access(uuid, text, uuid), public.can_doc_write(uuid, text), public.can_doc_folder(uuid, text, boolean) from public, anon;
grant execute on function public.has_cap(uuid, text), public.team_people(uuid), public.team_set_position(uuid, uuid, text, uuid), public.team_set_role(uuid, uuid, text), public.can_doc_access(uuid, text, uuid), public.can_doc_write(uuid, text), public.can_doc_folder(uuid, text, boolean) to authenticated;

drop policy if exists docs_select on public.team_docs; drop policy if exists docs_insert on public.team_docs; drop policy if exists docs_update on public.team_docs; drop policy if exists docs_delete on public.team_docs;
create policy docs_select on public.team_docs for select to authenticated using (public.can_doc_access(team_id, access, person));
create policy docs_insert on public.team_docs for insert to authenticated with check (created_by = auth.uid() and public.can_doc_write(team_id, access));
create policy docs_update on public.team_docs for update to authenticated using (public.can_doc_write(team_id, access) or (created_by = auth.uid() and access = 'team')) with check (public.is_team_member(team_id));
create policy docs_delete on public.team_docs for delete to authenticated using (public.can_doc_write(team_id, access) or (created_by = auth.uid() and access = 'team'));

drop policy if exists team_docs_obj_select on storage.objects; drop policy if exists team_docs_obj_insert on storage.objects; drop policy if exists team_docs_obj_delete on storage.objects;
create policy team_docs_obj_select on storage.objects for select to authenticated using (bucket_id = 'team-docs' and public.can_doc_folder(((storage.foldername(name))[1])::uuid, (storage.foldername(name))[2], false));
create policy team_docs_obj_insert on storage.objects for insert to authenticated with check (bucket_id = 'team-docs' and public.can_doc_folder(((storage.foldername(name))[1])::uuid, (storage.foldername(name))[2], true));
create policy team_docs_obj_delete on storage.objects for delete to authenticated using (bucket_id = 'team-docs' and (owner = auth.uid() or public.can_doc_folder(((storage.foldername(name))[1])::uuid, (storage.foldername(name))[2], true)));

-- Annunci: chi ha il permesso di scriverli (non solo gli amministratori). Ore di tutti: chi ha il permesso.
drop policy if exists msg_insert on public.team_messages;
create policy msg_insert on public.team_messages for insert to authenticated
  with check (author = auth.uid() and public.is_team_member(team_id) and (channel <> 'ann' or public.has_cap(team_id, 'announce')) and pinned = false and deleted = false);
drop policy if exists time_select on public.team_time;
create policy time_select on public.team_time for select to authenticated using (public.is_team_member(team_id) and (user_id = auth.uid() or public.has_cap(team_id, 'time.view')));

-- Ferie e permessi: li approva chi ha il permesso (responsabili, HR), mai la propria richiesta salvo il proprietario.
create or replace function public.team_absence_decide(p_id text, p_ok boolean) returns void
language plpgsql security definer set search_path = ''
as $$
declare a public.team_absences;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into a from public.team_absences where id = p_id;
  if not found then raise exception 'non_trovata' using errcode = 'P0001'; end if;
  if not public.has_cap(a.team_id, 'absence.approve') or (a.user_id = auth.uid() and not public.is_team_member(a.team_id, 'owner')) then
    raise exception 'non_autorizzato' using errcode = 'P0001';
  end if;
  update public.team_absences set status = case when p_ok then 'approved' else 'rejected' end, decided_by = auth.uid() where id = p_id;
end $$;

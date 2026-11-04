-- Workspace Lavoro, punto 2: riunioni dentro i progetti. Invitano le persone del progetto; la trascrizione la attiva anche una persona sola e tutti vedono chi la usa.
-- Solo oggetti nuovi. Ogni permesso lo controlla il server.
create table if not exists public.team_meetings (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  project text,                                    -- id della pagina/progetto del workspace
  title text not null check (char_length(btrim(title)) between 1 and 200),
  day date not null,
  time text not null check (time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  dur integer not null default 60 check (dur between 5 and 1440),
  agenda text not null default '' check (char_length(agenda) <= 4000),
  attendees uuid[] not null default '{}',
  created_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended')),
  rec_by uuid references auth.users (id) on delete set null,       -- chi ha acceso per primo la trascrizione
  rec_users uuid[] not null default '{}',                           -- chi sta trascrivendo la propria voce adesso
  recurrence text not null default 'none' check (recurrence in ('none', 'weekly', 'monthly')),
  notes jsonb,                                                       -- decisioni, cose da fare, domande
  minutes text check (char_length(minutes) <= 20000),                -- verbale
  event_id text,                                                     -- l'impegno collegato nel Plan
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists team_meetings_team_day on public.team_meetings (team_id, day);
create index if not exists team_meetings_project on public.team_meetings (team_id, project);

create table if not exists public.team_meeting_lines (
  id bigint generated always as identity primary key,
  meeting_id text not null references public.team_meetings (id) on delete cascade,
  speaker uuid not null references auth.users (id) on delete cascade,
  at integer not null check (at >= 0),                              -- millisecondi dall'inizio
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists team_meeting_lines_m on public.team_meeting_lines (meeting_id, at);

alter table public.team_meetings enable row level security;
alter table public.team_meeting_lines enable row level security;

create or replace function public.can_see_meeting(p_id text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_meetings m
    where m.id = p_id and public.is_team_member(m.team_id)
      and (m.created_by = auth.uid() or auth.uid() = any (m.attendees) or public.is_team_member(m.team_id, 'admin'))
  )
$$;
revoke all on function public.can_see_meeting(text) from public, anon;
grant execute on function public.can_see_meeting(text) to authenticated;

create policy meetings_select on public.team_meetings for select to authenticated using (public.can_see_meeting(id));
create policy meetings_insert on public.team_meetings for insert to authenticated with check (created_by = auth.uid() and public.is_team_member(team_id) and status = 'scheduled' and rec_users = '{}' and rec_by is null);
create policy meetings_update on public.team_meetings for update to authenticated
  using (created_by = auth.uid() or public.is_team_member(team_id, 'admin')) with check (public.is_team_member(team_id));
create policy meetings_delete on public.team_meetings for delete to authenticated using (created_by = auth.uid() or public.is_team_member(team_id, 'admin'));
create policy lines_select on public.team_meeting_lines for select to authenticated using (public.can_see_meeting(meeting_id));
-- le righe si scrivono solo da team_meeting_line
-- stato, trascrizione, appunti e verbale si cambiano solo dalle funzioni qui sotto
revoke update on public.team_meetings from authenticated;
grant update (title, project, day, time, dur, agenda, attendees, recurrence, deleted, event_id) on public.team_meetings to authenticated;

create or replace function public._meetings_check() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from unnest(new.attendees) a where not exists (select 1 from public.team_members m where m.team_id = new.team_id and m.user_id = a)) then
    raise exception 'invitato_non_nel_team' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger team_meetings_check before insert or update on public.team_meetings for each row execute function public._meetings_check();
revoke all on function public._meetings_check() from public, anon, authenticated;

-- Accende o spegne la trascrizione della PROPRIA voce. Può farlo qualunque persona invitata: gli altri non devono accettare, ma vedono chi la usa.
create or replace function public.team_meeting_rec(p_id text, p_on boolean) returns public.team_meetings
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); m public.team_meetings;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if not public.can_see_meeting(p_id) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  select * into m from public.team_meetings where id = p_id for update;
  if m.deleted or m.status = 'ended' then raise exception 'riunione_chiusa' using errcode = 'P0001'; end if;
  if p_on then
    update public.team_meetings set status = 'live',
      rec_users = (select array_agg(distinct x) from unnest(m.rec_users || uid) x),
      rec_by = coalesce(m.rec_by, uid)
    where id = p_id returning * into m;
  else
    update public.team_meetings set rec_users = array_remove(m.rec_users, uid),
      rec_by = case when cardinality(array_remove(m.rec_users, uid)) = 0 then null when m.rec_by = uid then (array_remove(m.rec_users, uid))[1] else m.rec_by end
    where id = p_id returning * into m;
  end if;
  return m;
end $$;

-- Aggiunge una riga di trascrizione (solo di chi ha la trascrizione accesa).
create or replace function public.team_meeting_line(p_id text, p_at integer, p_text text) returns void
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); m public.team_meetings;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into m from public.team_meetings where id = p_id;
  if not found or m.status <> 'live' or not (uid = any (m.rec_users)) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  if btrim(coalesce(p_text, '')) = '' then return; end if;
  if (select count(*) from public.team_meeting_lines where meeting_id = p_id) >= 5000 then raise exception 'troppe_righe' using errcode = 'P0001'; end if;
  insert into public.team_meeting_lines (meeting_id, speaker, at, text) values (p_id, uid, greatest(p_at, 0), left(btrim(p_text), 500));
end $$;

-- Chiude la riunione e salva appunti e verbale (chi l'ha creata o un amministratore).
create or replace function public.team_meeting_end(p_id text, p_notes jsonb, p_minutes text) returns void
language plpgsql security definer set search_path = ''
as $$
declare m public.team_meetings;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into m from public.team_meetings where id = p_id for update;
  if not found or not (m.created_by = auth.uid() or public.is_team_member(m.team_id, 'admin')) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  update public.team_meetings set status = 'ended', rec_users = '{}', rec_by = null, notes = p_notes, minutes = left(p_minutes, 20000) where id = p_id;
end $$;

revoke all on function public.team_meeting_rec(text, boolean), public.team_meeting_line(text, integer, text), public.team_meeting_end(text, jsonb, text) from public, anon;
grant execute on function public.team_meeting_rec(text, boolean), public.team_meeting_line(text, integer, text), public.team_meeting_end(text, jsonb, text) to authenticated;

alter publication supabase_realtime add table public.team_meetings;
alter publication supabase_realtime add table public.team_meeting_lines;

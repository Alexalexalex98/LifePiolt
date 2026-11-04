-- Workspace Lavoro, punto 1 (pianificazione): orario di lavoro per persona, impegni condivisi del team, assenze con approvazione.
-- Solo oggetti nuovi: nessuna modifica a quelli esistenti. Ogni permesso lo controlla il server (RLS + funzioni).

-- Orario di lavoro di ogni persona in ogni team (serve a trovare gli orari liberi in comune).
create table if not exists public.team_hours (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  schedule jsonb not null default '{}'::jsonb,   -- {"1":[["09:00","12:30"],["14:00","18:00"]], ... "0":[]}
  tz text not null default 'Europe/Rome',
  updated_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- Impegni di lavoro condivisi: li vedono solo i partecipanti (e gli amministratori del team).
create table if not exists public.team_events (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  day date not null,
  time text not null check (time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  dur integer not null default 60 check (dur between 5 and 1440),
  project text,                                   -- id della pagina/progetto del workspace
  kind text not null default 'event' check (kind in ('event', 'meeting', 'focus', 'booking')),
  place text,
  attendees uuid[] not null default '{}',
  created_by uuid not null references auth.users (id) on delete cascade,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists team_events_team_day on public.team_events (team_id, day);

-- Ferie, permessi, malattie: richiesta -> approvata o rifiutata da un amministratore.
create table if not exists public.team_absences (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('ferie', 'permesso', 'malattia', 'altro')),
  from_day date not null,
  to_day date not null check (to_day >= from_day),
  note text check (char_length(note) <= 300),
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected')),
  decided_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists team_absences_team on public.team_absences (team_id, from_day);

-- Sale e risorse prenotabili (sala riunioni, auto, postazione).
create table if not exists public.team_resources (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  kind text not null default 'room' check (kind in ('room', 'car', 'desk', 'other'))
);
create table if not exists public.team_bookings (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  resource_id text not null references public.team_resources (id) on delete cascade,
  day date not null,
  time text not null check (time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  dur integer not null check (dur between 5 and 1440),
  booked_by uuid not null references auth.users (id) on delete cascade,
  event_id text
);
create index if not exists team_bookings_res on public.team_bookings (resource_id, day);

alter table public.team_hours enable row level security;
alter table public.team_events enable row level security;
alter table public.team_absences enable row level security;
alter table public.team_resources enable row level security;
alter table public.team_bookings enable row level security;

-- Orari: li vedono i membri del team, ognuno modifica solo il proprio.
create policy hours_select on public.team_hours for select to authenticated using (public.is_team_member(team_id));
create policy hours_insert on public.team_hours for insert to authenticated with check (user_id = auth.uid() and public.is_team_member(team_id));
create policy hours_update on public.team_hours for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_team_member(team_id));

-- Impegni: li vede chi li ha creati, chi è invitato e gli amministratori. Li crea o modifica solo chi è nel team; gli invitati devono essere membri.
create policy events_select on public.team_events for select to authenticated
  using (public.is_team_member(team_id) and (created_by = auth.uid() or auth.uid() = any (attendees) or public.is_team_member(team_id, 'admin')));
create policy events_insert on public.team_events for insert to authenticated
  with check (created_by = auth.uid() and public.is_team_member(team_id));
create policy events_update on public.team_events for update to authenticated
  using (created_by = auth.uid() or public.is_team_member(team_id, 'admin'))
  with check (public.is_team_member(team_id));
create policy events_delete on public.team_events for delete to authenticated
  using (created_by = auth.uid() or public.is_team_member(team_id, 'admin'));

-- Assenze: le vedono tutti i membri (serve al calendario di squadra), le richiede ognuno per sé, le decide un amministratore.
create policy abs_select on public.team_absences for select to authenticated using (public.is_team_member(team_id));
create policy abs_insert on public.team_absences for insert to authenticated
  with check (user_id = auth.uid() and status = 'requested' and public.is_team_member(team_id));
create policy abs_delete on public.team_absences for delete to authenticated
  using ((user_id = auth.uid() and status = 'requested') or public.is_team_member(team_id, 'admin'));
-- l'aggiornamento (approva/rifiuta) passa solo da team_absence_decide

create policy res_select on public.team_resources for select to authenticated using (public.is_team_member(team_id));
create policy res_insert on public.team_resources for insert to authenticated with check (public.is_team_member(team_id, 'admin'));
create policy res_delete on public.team_resources for delete to authenticated using (public.is_team_member(team_id, 'admin'));
create policy book_select on public.team_bookings for select to authenticated using (public.is_team_member(team_id));
create policy book_delete on public.team_bookings for delete to authenticated using (booked_by = auth.uid() or public.is_team_member(team_id, 'admin'));
-- le prenotazioni si creano solo da team_book_resource (controlla le sovrapposizioni)

-- Controllo sugli invitati: devono far parte del team.
create or replace function public._events_check() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from unnest(new.attendees) a where not exists (select 1 from public.team_members m where m.team_id = new.team_id and m.user_id = a)) then
    raise exception 'invitato_non_nel_team' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger team_events_check before insert or update on public.team_events for each row execute function public._events_check();

-- Decide una richiesta di assenza (solo amministratori; non si decide la propria).
create or replace function public.team_absence_decide(p_id text, p_ok boolean) returns void
language plpgsql security definer set search_path = ''
as $$
declare a public.team_absences;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into a from public.team_absences where id = p_id;
  if not found then raise exception 'non_trovata' using errcode = 'P0001'; end if;
  if not public.is_team_member(a.team_id, 'admin') or (a.user_id = auth.uid() and not public.is_team_member(a.team_id, 'owner')) then
    raise exception 'non_autorizzato' using errcode = 'P0001';
  end if;
  update public.team_absences set status = case when p_ok then 'approved' else 'rejected' end, decided_by = auth.uid() where id = p_id;
end $$;

-- Prenota una risorsa: rifiuta se si sovrappone a un'altra prenotazione.
create or replace function public.team_book_resource(p_id text, p_resource text, p_day date, p_time text, p_dur integer, p_event text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare r public.team_resources; s integer; e integer;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into r from public.team_resources where id = p_resource;
  if not found or not public.is_team_member(r.team_id) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  s := split_part(p_time, ':', 1)::int * 60 + split_part(p_time, ':', 2)::int; e := s + p_dur;
  if exists (select 1 from public.team_bookings b where b.resource_id = p_resource and b.day = p_day
             and s < split_part(b.time, ':', 1)::int * 60 + split_part(b.time, ':', 2)::int + b.dur
             and e > split_part(b.time, ':', 1)::int * 60 + split_part(b.time, ':', 2)::int) then
    raise exception 'risorsa_occupata' using errcode = 'P0001';
  end if;
  insert into public.team_bookings (id, team_id, resource_id, day, time, dur, booked_by, event_id) values (p_id, r.team_id, p_resource, p_day, p_time, p_dur, auth.uid(), p_event);
end $$;

-- Occupato/libero dei membri: solo gli intervalli, mai il titolo né i dettagli. Comprende impegni di lavoro del team e assenze approvate.
create or replace function public.team_busy(p_team uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_team_member(p_team) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  if p_to - p_from > 62 then raise exception 'intervallo_troppo_lungo' using errcode = 'P0001'; end if;
  return coalesce((
    select jsonb_agg(x) from (
      select jsonb_build_object('user_id', u, 'day', e.day, 'time', e.time, 'dur', e.dur) as x
      from public.team_events e, unnest(e.attendees || e.created_by) u
      where e.team_id = p_team and not e.deleted and e.day between p_from and p_to
      union all
      select jsonb_build_object('user_id', a.user_id, 'day', d::date, 'time', '00:00', 'dur', 1440)
      from public.team_absences a, generate_series(a.from_day::timestamp, a.to_day::timestamp, interval '1 day') d
      where a.team_id = p_team and a.status = 'approved' and d::date between p_from and p_to
    ) q
  ), '[]'::jsonb);
end $$;

revoke all on function public.team_absence_decide(text, boolean), public.team_book_resource(text, text, date, text, integer, text), public.team_busy(uuid, date, date) from public, anon;
grant execute on function public.team_absence_decide(text, boolean), public.team_book_resource(text, text, date, text, integer, text), public.team_busy(uuid, date, date) to authenticated;
revoke all on function public._events_check() from public, anon, authenticated;

-- Tempo reale: chi è invitato vede subito l'impegno.
alter publication supabase_realtime add table public.team_events;
alter publication supabase_realtime add table public.team_absences;

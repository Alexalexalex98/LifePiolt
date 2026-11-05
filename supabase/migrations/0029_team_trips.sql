-- Workspace Lavoro, punto 14 (trasferte): viaggi di lavoro con tratte, fusi orari, documenti, costi e approvazione del responsabile.
-- Solo oggetti nuovi (più nuovi tipi ammessi nelle notifiche). Non prenota e non paga nulla: le prenotazioni le inserisce la persona.
create table if not exists public.team_trips (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,        -- chi viaggia
  title text not null check (char_length(btrim(title)) between 1 and 200),
  dest text not null default '' check (char_length(dest) <= 120),
  from_day date not null,
  to_day date not null check (to_day >= from_day),
  purpose text not null default '' check (char_length(purpose) <= 600),
  budget numeric(12, 2) check (budget is null or budget >= 0),
  currency text not null default 'CHF' check (currency in ('CHF', 'EUR')),
  international boolean not null default false,
  segments jsonb not null default '[]'::jsonb,        -- tratte: volo, treno, hotel, auto, riunione, altro (con fuso orario e costo)
  docs jsonb not null default '[]'::jsonb,            -- documenti da avere: [{t, done}]
  status text not null default 'draft' check (status in ('draft', 'requested', 'approved', 'rejected', 'done')),
  decided_by uuid references auth.users (id) on delete set null,
  decision_note text not null default '' check (char_length(decision_note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_trips_team on public.team_trips (team_id, from_day);
alter table public.team_trips enable row level security;

-- Le vede chi viaggia e chi può approvare (permesso «absence.approve»; titolare e amministratori sempre).
create policy trips_select on public.team_trips for select to authenticated
  using (user_id = auth.uid() or public.has_cap(team_id, 'absence.approve'));
create policy trips_insert on public.team_trips for insert to authenticated
  with check (user_id = auth.uid() and status = 'draft' and public.is_team_member(team_id));
create policy trips_update on public.team_trips for update to authenticated
  using (user_id = auth.uid() and status <> 'done') with check (user_id = auth.uid());
create policy trips_delete on public.team_trips for delete to authenticated
  using (user_id = auth.uid() and status in ('draft', 'rejected'));
-- lo stato lo cambiano solo le funzioni qui sotto
revoke update on public.team_trips from authenticated;
grant update (title, dest, from_day, to_day, purpose, budget, currency, international, segments, docs) on public.team_trips to authenticated;

-- Se dopo l'approvazione cambiano destinazione, date o budget, serve una nuova approvazione.
create or replace function public._trip_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  if old.status = 'approved' and (new.dest is distinct from old.dest or new.from_day is distinct from old.from_day or new.to_day is distinct from old.to_day or new.budget is distinct from old.budget or new.currency is distinct from old.currency) then
    new.status := 'requested'; new.decided_by := null; new.decision_note := '';
  end if;
  return new;
end $$;
create trigger team_trips_guard before update on public.team_trips for each row execute function public._trip_guard();
revoke all on function public._trip_guard() from public, anon, authenticated;

-- Nuovi tipi di notifica per le trasferte.
alter table public.team_notifications drop constraint if exists team_notifications_kind_check;
alter table public.team_notifications add constraint team_notifications_kind_check check (kind in ('reschedule_ask', 'reschedule_accepted', 'reschedule_declined', 'cancelled', 'trip_requested', 'trip_decided'));

-- Chiede l'approvazione: avvisa chi può approvare.
create or replace function public.team_trip_request(p_id text) returns void
language plpgsql security definer set search_path = ''
as $$
declare r public.team_trips; a uuid; who text;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into r from public.team_trips where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'non_trovata' using errcode = 'P0001'; end if;
  if r.status not in ('draft', 'rejected') then raise exception 'stato_non_valido' using errcode = 'P0001'; end if;
  update public.team_trips set status = 'requested', decided_by = null, decision_note = '' where id = p_id;
  who := public._person_name(auth.uid());
  for a in
    select m.user_id from public.team_members m left join public.team_positions p on p.position = m.position
    where m.team_id = r.team_id and m.user_id <> auth.uid() and (m.role in ('owner', 'admin') or 'absence.approve' = any (coalesce(p.caps, '{}')))
  loop
    perform public._notify(r.team_id, a, 'trip_requested', 'Trasferta da approvare: ' || r.title, who || ' chiede di partire per ' || coalesce(nullif(r.dest, ''), r.title) || ' dal ' || to_char(r.from_day, 'DD/MM') || ' al ' || to_char(r.to_day, 'DD/MM') || '.', jsonb_build_object('trip', r.id));
  end loop;
end $$;

-- Approva o rifiuta (chi ha il permesso; il titolare può approvare la propria).
create or replace function public.team_trip_decide(p_id text, p_ok boolean, p_note text default '') returns void
language plpgsql security definer set search_path = ''
as $$
declare r public.team_trips;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into r from public.team_trips where id = p_id for update;
  if not found then raise exception 'non_trovata' using errcode = 'P0001'; end if;
  if r.status <> 'requested' then raise exception 'stato_non_valido' using errcode = 'P0001'; end if;
  if not public.has_cap(r.team_id, 'absence.approve') or (r.user_id = auth.uid() and not public.is_team_member(r.team_id, 'owner')) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  update public.team_trips set status = case when p_ok then 'approved' else 'rejected' end, decided_by = auth.uid(), decision_note = left(coalesce(p_note, ''), 300) where id = p_id;
  perform public._notify(r.team_id, r.user_id, 'trip_decided', case when p_ok then 'Trasferta approvata: ' else 'Trasferta non approvata: ' end || r.title, case when p_ok then 'Puoi preparare il viaggio.' else coalesce(nullif(left(p_note, 300), ''), 'Puoi modificarla e chiedere di nuovo.') end, jsonb_build_object('trip', r.id));
end $$;

-- Chiude la trasferta quando sei tornato.
create or replace function public.team_trip_close(p_id text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  update public.team_trips set status = 'done' where id = p_id and user_id = auth.uid() and status = 'approved';
  if not found then raise exception 'stato_non_valido' using errcode = 'P0001'; end if;
end $$;

revoke all on function public.team_trip_request(text), public.team_trip_decide(text, boolean, text), public.team_trip_close(text) from public, anon;
grant execute on function public.team_trip_request(text), public.team_trip_decide(text, boolean, text), public.team_trip_close(text) to authenticated;
alter publication supabase_realtime add table public.team_trips;
notify pgrst, 'reload schema';

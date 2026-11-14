-- Gruppo di lavoro: datore di lavoro e dipendenti. Turni pubblicati dal datore che il dipendente deve confermare, disponibilità a coprire, turni scoperti,
-- scambi di turno senza sovrapposizioni, conferma mensile delle ore, panoramica per il datore (SOLO ore, ferie e piani: mai importi).
-- Si appoggia ai team esistenti (membri, ruoli, chat «general», assenze, impegni nel Plan). Solo oggetti nuovi: l'unica modifica a un oggetto esistente
-- è l'elenco dei tipi ammessi nelle notifiche (si aggiungono valori, non se ne tolgono).
alter table public.teams add column if not exists kind text not null default 'workspace';
alter table public.teams drop constraint if exists teams_kind_check;
alter table public.teams add constraint teams_kind_check check (kind in ('workspace', 'group'));

alter table public.team_notifications drop constraint if exists team_notifications_kind_check;
alter table public.team_notifications add constraint team_notifications_kind_check check (kind in (
  'reschedule_ask', 'reschedule_accepted', 'reschedule_declined', 'cancelled',
  'shift_ask', 'shift_ok', 'shift_no', 'cover_ask', 'cover_filled', 'swap_open', 'swap_done', 'month_ask', 'contract'));

-- Il contratto di ogni dipendente, caricato dal datore: ore, ferie e regola degli straordinari. Lo vede il datore e il dipendente stesso.
create table if not exists public.group_contracts (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  weekly_hours numeric(4, 1) not null default 40 check (weekly_hours between 1 and 60),
  vacation_days integer not null default 20 check (vacation_days between 0 and 60),
  overtime_mode text not null default 'paid' check (overtime_mode in ('paid', 'plain', 'bank', 'mixed')),
  paid_up_to numeric(5, 1) check (paid_up_to between 0 and 200),
  bank_ratio numeric(4, 2) not null default 1 check (bank_ratio between 0.5 and 3),
  bank_expiry_months integer check (bank_expiry_months between 1 and 36),
  ends_on date,                                    -- fine contratto / disdetta
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- Turni. `proposed` = il dipendente deve ancora confermare (nuovo turno, cambio o cancellazione); `prev` serve a tornare indietro se non accetta.
create table if not exists public.group_shifts (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  start_t text not null check (start_t ~ '^[0-2][0-9]:[0-5][0-9]$'),
  end_t text not null check (end_t ~ '^[0-2][0-9]:[0-5][0-9]$'),
  label text not null default '' check (char_length(label) <= 80),
  status text not null default 'proposed' check (status in ('confirmed', 'proposed', 'declined')),
  removal boolean not null default false,
  prev jsonb,
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists group_shifts_team_day on public.group_shifts (team_id, day);
create index if not exists group_shifts_user_day on public.group_shifts (user_id, day);

-- Chi è disponibile a lavorare di più per coprire gli altri.
create table if not exists public.group_cover (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  available boolean not null default false,
  note text not null default '' check (char_length(note) <= 200),
  updated_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- Turni scoperti: il datore avvisa prima chi è disponibile (e libero), poi gli altri. Il primo che dice sì lo prende.
create table if not exists public.group_cover_requests (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  day date not null,
  start_t text not null check (start_t ~ '^[0-2][0-9]:[0-5][0-9]$'),
  end_t text not null check (end_t ~ '^[0-2][0-9]:[0-5][0-9]$'),
  label text not null default '' check (char_length(label) <= 80),
  status text not null default 'open' check (status in ('open', 'filled', 'closed')),
  taken_by uuid references auth.users (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Scambi: «ho bisogno di questo giorno, ho questo turno». Chi risponde sì prende il turno (e può darne uno in cambio); i liberi si controllano per evitare sovrapposizioni.
create table if not exists public.group_swaps (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  shift_id text not null references public.group_shifts (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  day date not null, start_t text not null, end_t text not null, label text not null default '',
  note text not null default '' check (char_length(note) <= 200),
  status text not null default 'open' check (status in ('open', 'taken', 'cancelled')),
  taken_by uuid references auth.users (id) on delete set null,
  give_shift text,
  created_at timestamptz not null default now()
);

-- Conferma mensile delle ore: ogni mese il dipendente rivede e conferma (l'app ne genera il PDF). `digest` identifica ciò che ha confermato.
create table if not exists public.group_months (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  hours numeric(6, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  digest text check (char_length(digest) <= 80),
  confirmed_at timestamptz,
  primary key (team_id, user_id, month)
);

alter table public.group_contracts enable row level security;
alter table public.group_shifts enable row level security;
alter table public.group_cover enable row level security;
alter table public.group_cover_requests enable row level security;
alter table public.group_swaps enable row level security;
alter table public.group_months enable row level security;
create policy gc_select on public.group_contracts for select to authenticated using (user_id = auth.uid() or public.is_team_member(team_id, 'admin'));
create policy gs_select on public.group_shifts for select to authenticated using (user_id = auth.uid() or public.is_team_member(team_id, 'admin'));
create policy gv_select on public.group_cover for select to authenticated using (user_id = auth.uid() or public.is_team_member(team_id, 'admin'));
create policy gr_select on public.group_cover_requests for select to authenticated using (public.is_team_member(team_id));
create policy gw_select on public.group_swaps for select to authenticated using (public.is_team_member(team_id));
create policy gm_select on public.group_months for select to authenticated using (user_id = auth.uid() or public.is_team_member(team_id, 'admin'));
revoke insert, update, delete on public.group_contracts, public.group_shifts, public.group_cover, public.group_cover_requests, public.group_swaps, public.group_months from anon, authenticated;
revoke all on public.group_contracts, public.group_shifts, public.group_cover, public.group_cover_requests, public.group_swaps, public.group_months from anon;

-- ---------- funzioni di servizio (non chiamabili dall'app) ----------
create or replace function public._grp_minutes(t text) returns integer language sql immutable set search_path = ''
as $$ select (split_part(t, ':', 1))::int * 60 + (split_part(t, ':', 2))::int $$;
revoke all on function public._grp_minutes(text) from public, anon, authenticated;

-- C'è già un turno (o una ferie approvata) di questa persona che si sovrappone? I turni oltre la mezzanotte contano fino al giorno dopo.
create or replace function public._grp_clash(p_team uuid, p_user uuid, p_day date, p_start text, p_end text, p_except text default null) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare a1 integer; a2 integer; s record; b1 integer; b2 integer;
begin
  a1 := public._grp_minutes(p_start); a2 := public._grp_minutes(p_end); if a2 <= a1 then a2 := a2 + 1440; end if;
  if exists (select 1 from public.team_absences x where x.team_id = p_team and x.user_id = p_user and x.status = 'approved' and p_day between x.from_day and x.to_day) then return true; end if;
  for s in select day, start_t, end_t from public.group_shifts
           where team_id = p_team and user_id = p_user and status <> 'declined'
             and day between p_day - 1 and p_day + 1 and (p_except is null or id <> p_except) loop
    b1 := (s.day - p_day) * 1440 + public._grp_minutes(s.start_t); b2 := (s.day - p_day) * 1440 + public._grp_minutes(s.end_t); if public._grp_minutes(s.end_t) <= public._grp_minutes(s.start_t) then b2 := b2 + 1440; end if;
    if a1 < b2 and b1 < a2 then return true; end if;
  end loop;
  return false;
end $$;
revoke all on function public._grp_clash(uuid, uuid, date, text, text, text) from public, anon, authenticated;

create or replace function public._grp_check_time(p_start text, p_end text) returns void
language plpgsql immutable set search_path = ''
as $$ begin
  if p_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or p_end !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'ora_non_valida' using errcode = 'P0001'; end if;
  if p_start = p_end then raise exception 'ora_non_valida' using errcode = 'P0001'; end if;
end $$;
revoke all on function public._grp_check_time(text, text) from public, anon, authenticated;

-- Mette (o toglie) il turno confermato nel Plan della persona, usando gli impegni condivisi già esistenti.
create or replace function public._grp_plan(p_shift public.group_shifts, p_on boolean) returns void
language plpgsql security definer set search_path = ''
as $$
declare dur integer;
begin
  dur := public._grp_minutes(p_shift.end_t) - public._grp_minutes(p_shift.start_t); if dur <= 0 then dur := dur + 1440; end if;
  if p_on then
    insert into public.team_events (id, team_id, title, day, time, dur, kind, attendees, created_by, deleted, updated_at)
    values ('gs' || p_shift.id, p_shift.team_id, coalesce(nullif(p_shift.label, ''), 'Turno'), p_shift.day, p_shift.start_t, least(1440, greatest(5, dur)), 'event', array[p_shift.user_id], coalesce(p_shift.created_by, p_shift.user_id), false, now())
    on conflict (id) do update set title = excluded.title, day = excluded.day, time = excluded.time, dur = excluded.dur, attendees = excluded.attendees, deleted = false, updated_at = now();
  else
    update public.team_events set deleted = true, updated_at = now() where id = 'gs' || p_shift.id;
  end if;
end $$;
revoke all on function public._grp_plan(public.group_shifts, boolean) from public, anon, authenticated;

create or replace function public._grp_admins(p_team uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$ select user_id from public.team_members where team_id = p_team and role in ('owner', 'admin') $$;
revoke all on function public._grp_admins(uuid) from public, anon, authenticated;

-- ---------- funzioni dell'app ----------
create or replace function public.group_create(p_name text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); tid uuid;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if (select count(*) from public.teams where owner = uid) >= 10 then raise exception 'troppi_team' using errcode = 'P0001'; end if;
  insert into public.teams (name, owner, kind) values (left(btrim(p_name), 80), uid, 'group') returning id into tid;
  insert into public.team_members (team_id, user_id, role) values (tid, uid, 'owner');
  insert into public.team_messages (team_id, channel, author, text) values (tid, 'general', uid, 'Benvenuti nel gruppo di lavoro! Qui trovate gli orari, le richieste di ferie e gli scambi di turno.');
  return tid;
end $$;

create or replace function public.group_contract_set(p_team uuid, p_user uuid, p_weekly numeric, p_vac integer, p_mode text, p_paid_up_to numeric, p_ratio numeric, p_expiry integer, p_ends date) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if not public.is_team_member(p_team, 'admin') then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.team_members where team_id = p_team and user_id = p_user) then raise exception 'non_nel_team' using errcode = 'P0001'; end if;
  insert into public.group_contracts (team_id, user_id, weekly_hours, vacation_days, overtime_mode, paid_up_to, bank_ratio, bank_expiry_months, ends_on, updated_by, updated_at)
  values (p_team, p_user, p_weekly, p_vac, p_mode, p_paid_up_to, coalesce(p_ratio, 1), p_expiry, p_ends, auth.uid(), now())
  on conflict (team_id, user_id) do update set weekly_hours = excluded.weekly_hours, vacation_days = excluded.vacation_days, overtime_mode = excluded.overtime_mode, paid_up_to = excluded.paid_up_to,
    bank_ratio = excluded.bank_ratio, bank_expiry_months = excluded.bank_expiry_months, ends_on = excluded.ends_on, updated_by = auth.uid(), updated_at = now();
  if p_user <> auth.uid() then perform public._notify(p_team, p_user, 'contract', 'Il tuo contratto è stato aggiornato', 'Il datore di lavoro ha aggiornato ore, ferie o regola degli straordinari: li trovi nel gruppo di lavoro.', jsonb_build_object('team', p_team)); end if;
end $$;

-- Il datore pubblica o cambia un turno: il dipendente deve confermare (non cambia nulla nel suo Plan finché non accetta).
create or replace function public.group_shift_set(p_team uuid, p_user uuid, p_day date, p_start text, p_end text, p_label text, p_id text default null) returns text
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); sid text; old public.group_shifts;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if not public.is_team_member(p_team, 'admin') then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.team_members where team_id = p_team and user_id = p_user) then raise exception 'non_nel_team' using errcode = 'P0001'; end if;
  perform public._grp_check_time(p_start, p_end);
  if public._grp_clash(p_team, p_user, p_day, p_start, p_end, p_id) then raise exception 'sovrapposto' using errcode = 'P0001'; end if;
  if p_id is not null then
    select * into old from public.group_shifts where id = p_id and team_id = p_team for update;
    if not found then raise exception 'non_trovato' using errcode = 'P0001'; end if;
    if old.user_id = p_user and old.day = p_day and old.start_t = p_start and old.end_t = p_end and old.label = left(coalesce(p_label, ''), 80) and old.status = 'confirmed' then return p_id; end if;
    update public.group_shifts set user_id = p_user, day = p_day, start_t = p_start, end_t = p_end, label = left(coalesce(p_label, ''), 80), status = 'proposed', removal = false,
      prev = case when old.status = 'confirmed' then jsonb_build_object('user_id', old.user_id, 'day', old.day, 'start_t', old.start_t, 'end_t', old.end_t, 'label', old.label) else old.prev end,
      created_by = uid, updated_at = now() where id = p_id;
    sid := p_id;
  else
    sid := 's' || substr(md5(random()::text || clock_timestamp()::text), 1, 14);
    insert into public.group_shifts (id, team_id, user_id, day, start_t, end_t, label, status, created_by) values (sid, p_team, p_user, p_day, p_start, p_end, left(coalesce(p_label, ''), 80), 'proposed', uid);
  end if;
  if p_user <> uid then
    perform public._notify(p_team, p_user, 'shift_ask', 'Turno da confermare', 'Ti è stato assegnato un turno il ' || to_char(p_day, 'DD/MM') || ' dalle ' || p_start || ' alle ' || p_end || '. Confermi?', jsonb_build_object('shift', sid, 'team', p_team));
  else
    update public.group_shifts set status = 'confirmed' where id = sid; perform public._grp_plan((select s from public.group_shifts s where s.id = sid), true);
  end if;
  return sid;
end $$;

-- Il datore toglie un turno: anche questo lo conferma chi lo aveva.
create or replace function public.group_shift_remove(p_id text) returns void
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); s public.group_shifts;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into s from public.group_shifts where id = p_id for update;
  if not found then raise exception 'non_trovato' using errcode = 'P0001'; end if;
  if not public.is_team_member(s.team_id, 'admin') then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  if s.status <> 'confirmed' or s.user_id = uid then
    perform public._grp_plan(s, false); delete from public.group_shifts where id = p_id; return;
  end if;
  update public.group_shifts set removal = true, status = 'proposed', updated_at = now() where id = p_id;
  perform public._notify(s.team_id, s.user_id, 'shift_ask', 'Turno cancellato: confermi?', 'Il turno del ' || to_char(s.day, 'DD/MM') || ' dalle ' || s.start_t || ' alle ' || s.end_t || ' viene tolto. Confermi?', jsonb_build_object('shift', p_id, 'team', s.team_id));
end $$;

create or replace function public.group_shift_answer(p_id text, p_accept boolean) returns text
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); s public.group_shifts; a uuid; who text; what text;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into s from public.group_shifts where id = p_id for update;
  if not found or s.user_id <> uid or s.status <> 'proposed' then raise exception 'non_trovato' using errcode = 'P0001'; end if;
  who := public._person_name(uid);
  update public.team_notifications set done = true, read = true where user_id = uid and data ->> 'shift' = p_id and kind = 'shift_ask';
  if p_accept then
    if s.removal then
      perform public._grp_plan(s, false); delete from public.group_shifts where id = p_id; what := 'ha accettato la cancellazione del turno';
    else
      update public.group_shifts set status = 'confirmed', prev = null, updated_at = now() where id = p_id;
      perform public._grp_plan((select x from public.group_shifts x where x.id = p_id), true); what := 'ha confermato il turno del ' || to_char(s.day, 'DD/MM') || ' ' || s.start_t || '-' || s.end_t;
    end if;
    for a in select public._grp_admins(s.team_id) loop perform public._notify(s.team_id, a, 'shift_ok', who || ': confermato', who || ' ' || what || '.', jsonb_build_object('shift', p_id, 'team', s.team_id)); end loop;
    return 'accepted';
  end if;
  -- non accetta: si torna al turno di prima (o, se era nuovo, il turno resta rifiutato per il datore)
  if s.removal then update public.group_shifts set removal = false, status = 'confirmed', updated_at = now() where id = p_id; what := 'non può rinunciare al turno del ' || to_char(s.day, 'DD/MM');
  elsif s.prev is not null then
    update public.group_shifts set user_id = (s.prev ->> 'user_id')::uuid, day = (s.prev ->> 'day')::date, start_t = s.prev ->> 'start_t', end_t = s.prev ->> 'end_t', label = s.prev ->> 'label', status = 'confirmed', prev = null, updated_at = now() where id = p_id;
    perform public._grp_plan((select x from public.group_shifts x where x.id = p_id), true);
    what := 'non può il nuovo orario del turno del ' || to_char(s.day, 'DD/MM') || ': resta quello di prima';
  else update public.group_shifts set status = 'declined', updated_at = now() where id = p_id; what := 'non può il turno del ' || to_char(s.day, 'DD/MM') || ' ' || s.start_t || '-' || s.end_t; end if;
  for a in select public._grp_admins(s.team_id) loop perform public._notify(s.team_id, a, 'shift_no', who || ': non può', who || ' ' || what || '.', jsonb_build_object('shift', p_id, 'team', s.team_id)); end loop;
  return 'declined';
end $$;

create or replace function public.group_cover_set(p_team uuid, p_available boolean, p_note text default '') returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if not public.is_team_member(p_team) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  insert into public.group_cover (team_id, user_id, available, note, updated_at) values (p_team, auth.uid(), p_available, left(coalesce(p_note, ''), 200), now())
  on conflict (team_id, user_id) do update set available = excluded.available, note = excluded.note, updated_at = now();
end $$;

-- Turno scoperto: avvisa per prima chi si è segnato disponibile (e non ha già un turno in quell'orario). Con p_all = true avvisa anche gli altri liberi.
create or replace function public.group_cover_ask(p_team uuid, p_day date, p_start text, p_end text, p_label text, p_all boolean default false) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); rid text; m record; n integer := 0;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if not public.is_team_member(p_team, 'admin') then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  perform public._grp_check_time(p_start, p_end);
  select id into rid from public.group_cover_requests where team_id = p_team and day = p_day and start_t = p_start and end_t = p_end and status = 'open' limit 1;
  if rid is null then
    rid := 'c' || substr(md5(random()::text || clock_timestamp()::text), 1, 14);
    insert into public.group_cover_requests (id, team_id, day, start_t, end_t, label, created_by) values (rid, p_team, p_day, p_start, p_end, left(coalesce(p_label, ''), 80), uid);
  end if;
  for m in select tm.user_id, coalesce(gc.available, false) as av from public.team_members tm left join public.group_cover gc on gc.team_id = tm.team_id and gc.user_id = tm.user_id
           where tm.team_id = p_team and tm.user_id <> uid loop
    if (m.av or p_all) and not public._grp_clash(p_team, m.user_id, p_day, p_start, p_end) then
      -- chi era già stato avvisato non riceve di nuovo la stessa richiesta
      if not exists (select 1 from public.team_notifications x where x.user_id = m.user_id and x.kind = 'cover_ask' and x.data ->> 'cover' = rid) then
        perform public._notify(p_team, m.user_id, 'cover_ask', 'Turno da coprire', 'Serve qualcuno il ' || to_char(p_day, 'DD/MM') || ' dalle ' || p_start || ' alle ' || p_end || coalesce(' (' || nullif(p_label, '') || ')', '') || '. Ti va?', jsonb_build_object('cover', rid, 'team', p_team));
        n := n + 1;
      end if;
    end if;
  end loop;
  return jsonb_build_object('id', rid, 'notified', n);
end $$;

create or replace function public.group_cover_take(p_id text) returns text
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); r public.group_cover_requests; sid text; a uuid; who text;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into r from public.group_cover_requests where id = p_id for update;
  if not found or not public.is_team_member(r.team_id) then raise exception 'non_trovato' using errcode = 'P0001'; end if;
  if r.status <> 'open' then raise exception 'gia_coperto' using errcode = 'P0001'; end if;
  if public._grp_clash(r.team_id, uid, r.day, r.start_t, r.end_t) then raise exception 'sovrapposto' using errcode = 'P0001'; end if;
  sid := 's' || substr(md5(random()::text || clock_timestamp()::text), 1, 14);
  insert into public.group_shifts (id, team_id, user_id, day, start_t, end_t, label, status, created_by) values (sid, r.team_id, uid, r.day, r.start_t, r.end_t, r.label, 'confirmed', r.created_by);
  perform public._grp_plan((select x from public.group_shifts x where x.id = sid), true);
  update public.group_cover_requests set status = 'filled', taken_by = uid where id = p_id;
  update public.team_notifications set done = true where data ->> 'cover' = p_id and kind = 'cover_ask';
  who := public._person_name(uid);
  for a in select public._grp_admins(r.team_id) loop perform public._notify(r.team_id, a, 'cover_filled', 'Turno coperto', who || ' copre il turno del ' || to_char(r.day, 'DD/MM') || ' ' || r.start_t || '-' || r.end_t || '.', jsonb_build_object('cover', p_id, 'team', r.team_id)); end loop;
  return sid;
end $$;

-- Scambio: il dipendente offre un suo turno; compare nel gruppo come messaggio e come richiesta.
create or replace function public.group_swap_open(p_shift text, p_note text default '') returns text
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); s public.group_shifts; wid text; who text;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into s from public.group_shifts where id = p_shift;
  if not found or s.user_id <> uid or s.status <> 'confirmed' then raise exception 'non_trovato' using errcode = 'P0001'; end if;
  select id into wid from public.group_swaps where shift_id = p_shift and status = 'open';
  if wid is not null then return wid; end if;
  wid := 'w' || substr(md5(random()::text || clock_timestamp()::text), 1, 14);
  insert into public.group_swaps (id, team_id, shift_id, from_user, day, start_t, end_t, label, note) values (wid, s.team_id, p_shift, uid, s.day, s.start_t, s.end_t, s.label, left(coalesce(p_note, ''), 200));
  who := public._person_name(uid);
  insert into public.team_messages (team_id, channel, author, text) values (s.team_id, 'general', uid, left('Ho bisogno di liberare il ' || to_char(s.day, 'DD/MM') || ' (turno ' || s.start_t || '-' || s.end_t || '). Chi può prenderlo? ' || coalesce(nullif(p_note, ''), ''), 4000));
  return wid;
end $$;

create or replace function public.group_swap_take(p_id text, p_give text default null) returns text
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); w public.group_swaps; s public.group_shifts; g public.group_shifts; a uuid; who text;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into w from public.group_swaps where id = p_id for update;
  if not found or not public.is_team_member(w.team_id) then raise exception 'non_trovato' using errcode = 'P0001'; end if;
  if w.status <> 'open' or w.from_user = uid then raise exception 'gia_coperto' using errcode = 'P0001'; end if;
  select * into s from public.group_shifts where id = w.shift_id for update;
  if not found or s.user_id <> w.from_user or s.status <> 'confirmed' then raise exception 'non_trovato' using errcode = 'P0001'; end if;
  if p_give is not null then
    select * into g from public.group_shifts where id = p_give for update;
    if not found or g.user_id <> uid or g.status <> 'confirmed' then raise exception 'non_trovato' using errcode = 'P0001'; end if;
    -- il turno che do in cambio non deve sovrapporsi a ciò che ha già chi me lo scambia; e il turno che prendo non deve sovrapporsi ai miei (tranne quello che cedo)
    if public._grp_clash(w.team_id, w.from_user, g.day, g.start_t, g.end_t, w.shift_id) then raise exception 'sovrapposto' using errcode = 'P0001'; end if;
    if public._grp_clash(w.team_id, uid, s.day, s.start_t, s.end_t, p_give) then raise exception 'sovrapposto' using errcode = 'P0001'; end if;
    update public.group_shifts set user_id = w.from_user, updated_at = now() where id = p_give;
    perform public._grp_plan((select x from public.group_shifts x where x.id = p_give), true);
  else
    if public._grp_clash(w.team_id, uid, s.day, s.start_t, s.end_t) then raise exception 'sovrapposto' using errcode = 'P0001'; end if;
  end if;
  update public.group_shifts set user_id = uid, updated_at = now() where id = w.shift_id;
  perform public._grp_plan((select x from public.group_shifts x where x.id = w.shift_id), true);
  update public.group_swaps set status = 'taken', taken_by = uid, give_shift = p_give where id = p_id;
  who := public._person_name(uid);
  perform public._notify(w.team_id, w.from_user, 'swap_done', 'Scambio accettato', who || ' prende il tuo turno del ' || to_char(w.day, 'DD/MM') || '.', jsonb_build_object('swap', p_id, 'team', w.team_id));
  for a in select public._grp_admins(w.team_id) loop if a <> w.from_user then perform public._notify(w.team_id, a, 'swap_done', 'Scambio di turno', who || ' e ' || public._person_name(w.from_user) || ' si sono scambiati un turno (' || to_char(w.day, 'DD/MM') || ').', jsonb_build_object('swap', p_id, 'team', w.team_id)); end if; end loop;
  insert into public.team_messages (team_id, channel, author, text) values (w.team_id, 'general', uid, 'Ok, prendo io il turno del ' || to_char(w.day, 'DD/MM') || '.');
  return w.shift_id;
end $$;

create or replace function public.group_swap_cancel(p_id text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  update public.group_swaps set status = 'cancelled' where id = p_id and from_user = auth.uid() and status = 'open';
end $$;

-- Conferma mensile: crea (se manca) la riga del mese scorso per chi chiama e dice le ore dei turni confermati.
create or replace function public.group_month_open(p_team uuid, p_month text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); h numeric; r public.group_months; first date; last date;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if not public.is_team_member(p_team) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  if p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'mese_non_valido' using errcode = 'P0001'; end if;
  first := (p_month || '-01')::date; last := (first + interval '1 month' - interval '1 day')::date;
  select coalesce(sum(case when public._grp_minutes(end_t) <= public._grp_minutes(start_t) then public._grp_minutes(end_t) + 1440 - public._grp_minutes(start_t) else public._grp_minutes(end_t) - public._grp_minutes(start_t) end), 0) / 60.0
    into h from public.group_shifts where team_id = p_team and user_id = uid and status = 'confirmed' and day between first and last;
  insert into public.group_months (team_id, user_id, month, hours) values (p_team, uid, p_month, round(h, 2))
    on conflict (team_id, user_id, month) do update set hours = case when public.group_months.status = 'pending' then round(h, 2) else public.group_months.hours end;
  select * into r from public.group_months where team_id = p_team and user_id = uid and month = p_month;
  return to_jsonb(r);
end $$;

create or replace function public.group_month_confirm(p_team uuid, p_month text, p_digest text) returns void
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); a uuid; who text;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  perform public.group_month_open(p_team, p_month);
  update public.group_months set status = 'confirmed', digest = left(p_digest, 80), confirmed_at = now() where team_id = p_team and user_id = uid and month = p_month;
  who := public._person_name(uid);
  for a in select public._grp_admins(p_team) loop if a <> uid then perform public._notify(p_team, a, 'shift_ok', who || ': mese confermato', who || ' ha confermato le ore di ' || p_month || '.', jsonb_build_object('month', p_month, 'team', p_team)); end if; end loop;
end $$;

-- Panoramica per il datore: per ogni persona ore pianificate, ore da contratto, differenza, ferie, conferme. Niente importi.
create or replace function public.group_overview(p_team uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare weeks numeric; out jsonb;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if not public.is_team_member(p_team, 'admin') then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  weeks := greatest(0, (p_to - p_from + 1)) / 7.0;
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', m.user_id, 'name', public._person_name(m.user_id), 'role', m.role,
    'weekly_hours', coalesce(c.weekly_hours, 40), 'vacation_days', coalesce(c.vacation_days, 20), 'overtime_mode', coalesce(c.overtime_mode, 'paid'), 'ends_on', c.ends_on,
    'planned', coalesce(round(h.hrs, 2), 0), 'target', round(coalesce(c.weekly_hours, 40) * weeks, 2),
    'pending_shifts', (select count(*) from public.group_shifts s where s.team_id = p_team and s.user_id = m.user_id and s.status = 'proposed'),
    'vacation_taken', (select coalesce(sum(least(x.to_day, make_date(extract(year from p_from)::int, 12, 31)) - greatest(x.from_day, make_date(extract(year from p_from)::int, 1, 1)) + 1), 0) from public.team_absences x where x.team_id = p_team and x.user_id = m.user_id and x.kind = 'ferie' and x.status = 'approved' and x.to_day >= make_date(extract(year from p_from)::int, 1, 1) and x.from_day <= make_date(extract(year from p_from)::int, 12, 31)),
    'cover', coalesce(v.available, false),
    'month_confirmed', (select status = 'confirmed' from public.group_months g where g.team_id = p_team and g.user_id = m.user_id and g.month = to_char(p_from, 'YYYY-MM'))
  ) order by public._person_name(m.user_id)), '[]'::jsonb) into out
  from public.team_members m
  left join public.group_contracts c on c.team_id = m.team_id and c.user_id = m.user_id
  left join public.group_cover v on v.team_id = m.team_id and v.user_id = m.user_id
  left join lateral (select sum(case when public._grp_minutes(s.end_t) <= public._grp_minutes(s.start_t) then public._grp_minutes(s.end_t) + 1440 - public._grp_minutes(s.start_t) else public._grp_minutes(s.end_t) - public._grp_minutes(s.start_t) end) / 60.0 as hrs
                     from public.group_shifts s where s.team_id = m.team_id and s.user_id = m.user_id and s.status = 'confirmed' and s.day between p_from and p_to) h on true
  where m.team_id = p_team;
  return out;
end $$;

revoke all on function public.group_create(text), public.group_contract_set(uuid, uuid, numeric, integer, text, numeric, numeric, integer, date), public.group_shift_set(uuid, uuid, date, text, text, text, text),
  public.group_shift_remove(text), public.group_shift_answer(text, boolean), public.group_cover_set(uuid, boolean, text), public.group_cover_ask(uuid, date, text, text, text, boolean),
  public.group_cover_take(text), public.group_swap_open(text, text), public.group_swap_take(text, text), public.group_swap_cancel(text), public.group_month_open(uuid, text),
  public.group_month_confirm(uuid, text, text), public.group_overview(uuid, date, date) from public, anon;
grant execute on function public.group_create(text), public.group_contract_set(uuid, uuid, numeric, integer, text, numeric, numeric, integer, date), public.group_shift_set(uuid, uuid, date, text, text, text, text),
  public.group_shift_remove(text), public.group_shift_answer(text, boolean), public.group_cover_set(uuid, boolean, text), public.group_cover_ask(uuid, date, text, text, text, boolean),
  public.group_cover_take(text), public.group_swap_open(text, text), public.group_swap_take(text, text), public.group_swap_cancel(text), public.group_month_open(uuid, text),
  public.group_month_confirm(uuid, text, text), public.group_overview(uuid, date, date) to authenticated;

alter publication supabase_realtime add table public.group_shifts;
alter publication supabase_realtime add table public.group_swaps;
alter publication supabase_realtime add table public.group_cover_requests;

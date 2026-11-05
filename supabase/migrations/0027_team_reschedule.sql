-- Spostare un impegno condiviso: chi era invitato riceve una notifica e accetta o no. Se non accetta, un incontro a due si annulla,
-- uno tra più persone resta per chi ha accettato; l'organizzatore riceve l'esito con «Riorganizza». Solo oggetti nuovi.
create table if not exists public.team_notifications (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,      -- a chi è destinata
  kind text not null check (kind in ('reschedule_ask', 'reschedule_accepted', 'reschedule_declined', 'cancelled')),
  title text not null check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 600),
  data jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists team_notifications_user on public.team_notifications (user_id, created_at desc);
create table if not exists public.team_reschedules (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  kind text not null check (kind in ('meeting', 'event')),
  target text not null,
  proposed_by uuid not null references auth.users (id) on delete cascade,
  old_day date not null, old_time text not null,
  new_day date not null, new_time text not null,
  votes jsonb not null default '{}'::jsonb,           -- {utente: 'pending'|'accept'|'decline'}
  snapshot jsonb not null default '{}'::jsonb,        -- titolo, durata, invitati, progetto, ordine del giorno: serve a «Riorganizza»
  status text not null default 'pending' check (status in ('pending', 'settled', 'cancelled')),
  created_at timestamptz not null default now()
);
alter table public.team_notifications enable row level security;
alter table public.team_reschedules enable row level security;
create policy notif_select on public.team_notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.team_notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.team_notifications from authenticated;
grant update (read, done) on public.team_notifications to authenticated;
create policy notif_delete on public.team_notifications for delete to authenticated using (user_id = auth.uid());
create policy resch_select on public.team_reschedules for select to authenticated using (proposed_by = auth.uid() or votes ? auth.uid()::text);

create or replace function public._person_name(u uuid) returns text
language sql stable security definer set search_path = ''
as $$ select coalesce(nullif(btrim(coalesce(p.nome, '') || ' ' || coalesce(p.cognome, '')), ''), 'Un collega') from (select 1) x left join public.profiles p on p.user_id = u $$;
revoke all on function public._person_name(uuid) from public, anon, authenticated;

create or replace function public._notify(t uuid, u uuid, k text, ti text, b text, d jsonb) returns void
language sql security definer set search_path = ''
as $$ insert into public.team_notifications (id, team_id, user_id, kind, title, body, data) values ('n' || substr(md5(random()::text || clock_timestamp()::text), 1, 14), t, u, k, left(ti, 200), left(b, 600), d) $$;
revoke all on function public._notify(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;

-- Sposta una riunione o un impegno condiviso e chiede a chi era invitato se accetta il nuovo orario. Lo può fare chi l'ha creato o un amministratore.
create or replace function public.team_reschedule_propose(p_kind text, p_target text, p_new_day date, p_new_time text) returns text
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); tm uuid; t_title text; t_dur int; t_att uuid[]; t_creator uuid; o_day date; o_time text; t_proj text; t_agenda text; t_ev text; rid text; a uuid; votes jsonb := '{}'::jsonb; me_name text;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if p_new_time !~ '^[0-2][0-9]:[0-5][0-9]$' then raise exception 'ora_non_valida' using errcode = 'P0001'; end if;
  if p_kind = 'meeting' then
    select team_id, title, dur, attendees, created_by, day, time, project, agenda, event_id into tm, t_title, t_dur, t_att, t_creator, o_day, o_time, t_proj, t_agenda, t_ev from public.team_meetings where id = p_target and not deleted;
  elsif p_kind = 'event' then
    select team_id, title, dur, attendees, created_by, day, time, project into tm, t_title, t_dur, t_att, t_creator, o_day, o_time, t_proj from public.team_events where id = p_target and not deleted;
    t_agenda := '';
  else raise exception 'tipo_non_valido' using errcode = 'P0001'; end if;
  if tm is null then raise exception 'non_trovato' using errcode = 'P0001'; end if;
  if not (t_creator = uid or public.is_team_member(tm, 'admin')) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  if p_kind = 'meeting' then
    update public.team_meetings set day = p_new_day, time = p_new_time where id = p_target;
    if t_ev is not null then update public.team_events set day = p_new_day, time = p_new_time where id = t_ev; end if;
  else update public.team_events set day = p_new_day, time = p_new_time where id = p_target; end if;
  t_att := array_remove(t_att, uid);
  if coalesce(cardinality(t_att), 0) = 0 then return null; end if;
  foreach a in array t_att loop votes := votes || jsonb_build_object(a::text, 'pending'); end loop;
  rid := 'r' || substr(md5(random()::text || clock_timestamp()::text), 1, 14); me_name := public._person_name(uid);
  insert into public.team_reschedules (id, team_id, kind, target, proposed_by, old_day, old_time, new_day, new_time, votes, snapshot)
  values (rid, tm, p_kind, p_target, uid, o_day, o_time, p_new_day, p_new_time, votes, jsonb_build_object('title', t_title, 'dur', t_dur, 'attendees', to_jsonb(t_att), 'project', t_proj, 'agenda', coalesce(t_agenda, ''), 'kind', p_kind));
  foreach a in array t_att loop
    perform public._notify(tm, a, 'reschedule_ask', 'Spostamento: ' || t_title, me_name || ' ha spostato «' || t_title || '» da ' || to_char(o_day, 'DD/MM') || ' ' || o_time || ' a ' || to_char(p_new_day, 'DD/MM') || ' ' || p_new_time || '. Accetti il nuovo orario?', jsonb_build_object('reschedule', rid, 'target', p_target, 'kind', p_kind));
  end loop;
  return rid;
end $$;

-- Risponde a una richiesta di spostamento. «Non posso»: un incontro a due si annulla; tra più persone resta per chi ha accettato (si annulla se non accetta nessuno).
create or replace function public.team_reschedule_answer(p_id text, p_accept boolean) returns text
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); r public.team_reschedules; me_name text; total int; remaining uuid[]; t_att uuid[]; any_accept boolean; ev text; title text;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into r from public.team_reschedules where id = p_id for update;
  if not found or (r.votes ->> uid::text) is distinct from 'pending' then raise exception 'non_trovata' using errcode = 'P0001'; end if;
  me_name := public._person_name(uid); title := r.snapshot ->> 'title';
  r.votes := r.votes || jsonb_build_object(uid::text, case when p_accept then 'accept' else 'decline' end);
  update public.team_reschedules set votes = r.votes where id = p_id;
  update public.team_notifications set done = true, read = true where user_id = uid and data ->> 'reschedule' = p_id and kind = 'reschedule_ask';
  if p_accept then
    perform public._notify(r.team_id, r.proposed_by, 'reschedule_accepted', title || ': accettato', me_name || ' ha accettato il nuovo orario di «' || title || '».', jsonb_build_object('reschedule', p_id, 'target', r.target, 'kind', r.kind));
    if not exists (select 1 from jsonb_each_text(r.votes) v where v.value = 'pending') then update public.team_reschedules set status = 'settled' where id = p_id; end if;
    return 'accepted';
  end if;
  -- rifiutato: chi non può viene tolto dagli invitati
  if r.kind = 'meeting' then
    update public.team_meetings set attendees = array_remove(attendees, uid) where id = r.target returning attendees, event_id into t_att, ev;
    if ev is not null then update public.team_events set attendees = array_remove(attendees, uid) where id = ev; end if;
  else update public.team_events set attendees = array_remove(attendees, uid) where id = r.target returning attendees into t_att; end if;
  total := (select count(*) from jsonb_object_keys(r.votes));
  select exists (select 1 from jsonb_each_text(r.votes) v where v.value = 'accept') into any_accept;
  remaining := t_att;
  if total = 1 or (coalesce(cardinality(remaining), 0) = 0 and not any_accept) then
    if r.kind = 'meeting' then
      update public.team_meetings set deleted = true where id = r.target returning event_id into ev;
      if ev is not null then update public.team_events set deleted = true where id = ev; end if;
    else update public.team_events set deleted = true where id = r.target; end if;
    update public.team_reschedules set status = 'cancelled' where id = p_id;
    perform public._notify(r.team_id, r.proposed_by, 'cancelled', title || ': annullato', me_name || ' non può il nuovo orario e «' || title || '» è stata annullata. Vuoi riorganizzarla?', jsonb_build_object('reschedule', p_id, 'snapshot', r.snapshot || jsonb_build_object('declined_by', uid), 'kind', r.kind));
    return 'cancelled';
  end if;
  perform public._notify(r.team_id, r.proposed_by, 'reschedule_declined', title || ': ' || me_name || ' non può', me_name || ' non può il nuovo orario di «' || title || '»: gli altri restano. Puoi andare avanti senza o riorganizzare.', jsonb_build_object('reschedule', p_id, 'snapshot', r.snapshot || jsonb_build_object('declined_by', uid), 'kind', r.kind));
  if not exists (select 1 from jsonb_each_text(r.votes) v where v.value = 'pending') then update public.team_reschedules set status = 'settled' where id = p_id; end if;
  return 'declined';
end $$;

revoke all on function public.team_reschedule_propose(text, text, date, text), public.team_reschedule_answer(text, boolean) from public, anon;
grant execute on function public.team_reschedule_propose(text, text, date, text), public.team_reschedule_answer(text, boolean) to authenticated;
alter publication supabase_realtime add table public.team_notifications;

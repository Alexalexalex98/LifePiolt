-- Notifiche push mirate: ogni notifica di lavoro (turno da confermare, turno da coprire, scambio, ferie, contratto, conferma del mese...) arriva anche sul telefono
-- di chi la riceve, e solo a lui. Il telefono si registra con il suo codice di notifica (token Expo); il server lo usa quando nasce una riga in team_notifications.
-- Ogni mese, il giorno 1, il server ricorda a chi ha lavorato di confermare le ore del mese scorso. Nessun contenuto sensibile nel testo: solo ciò che c'è già nella notifica.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table if not exists public.push_tokens (
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null check (token ~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{10,80}\]$'),
  platform text not null default 'android' check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);
create index if not exists push_tokens_user on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

-- Il telefono comunica il suo codice. Se lo stesso telefono passa a un altro account, il codice si sposta: le notifiche vanno solo a chi ha fatto l'accesso.
create or replace function public.push_register(p_token text, p_platform text default 'android') returns void
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  delete from public.push_tokens where token = p_token and user_id <> uid;
  insert into public.push_tokens (user_id, token, platform) values (uid, p_token, case when p_platform = 'ios' then 'ios' else 'android' end)
    on conflict (user_id, token) do update set platform = excluded.platform, updated_at = now();
end $$;
create or replace function public.push_unregister(p_token text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
end $$;
revoke all on function public.push_register(text, text), public.push_unregister(text) from public, anon;
grant execute on function public.push_register(text, text), public.push_unregister(text) to authenticated;

-- Invio: un solo messaggio al servizio di notifiche di Expo con tutti i telefoni di quella persona. Se l'invio non è possibile non blocca mai chi ha creato la notifica.
create or replace function public._push_send(p_user uuid, p_title text, p_body text, p_data jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare msgs jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('to', t.token, 'title', left(p_title, 100), 'body', left(p_body, 240), 'data', p_data, 'sound', 'default', 'priority', 'high', 'channelId', 'work')), '[]'::jsonb)
    into msgs from public.push_tokens t where t.user_id = p_user;
  if jsonb_array_length(msgs) = 0 then return; end if;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then return; end if;
  perform net.http_post(url := 'https://exp.host/--/api/v2/push/send', body := msgs, headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb);
exception when others then null;
end $$;
revoke all on function public._push_send(uuid, text, text, jsonb) from public, anon, authenticated;

create or replace function public._push_on_notification() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._push_send(new.user_id, new.title, new.body,
    jsonb_build_object('kind', new.kind, 'ref', case when new.kind in ('shift_ask', 'shift_ok', 'shift_no', 'cover_ask', 'cover_filled', 'swap_open', 'swap_done', 'month_ask', 'contract') then 'group' else 'system' end,
      'team', new.team_id, 'notif', new.id));
  return new;
exception when others then return new;
end $$;
drop trigger if exists team_notifications_push on public.team_notifications;
create trigger team_notifications_push after insert on public.team_notifications for each row execute function public._push_on_notification();

-- Promemoria mensile: a chi nel mese scorso ha turni confermati e non ha ancora confermato le ore.
create or replace function public.group_month_remind() returns integer
language plpgsql security definer set search_path = ''
as $$
declare m text := to_char(now() - interval '1 month', 'YYYY-MM'); r record; n integer := 0; names text[] := array['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
begin
  for r in
    select distinct s.team_id, s.user_id from public.group_shifts s join public.teams t on t.id = s.team_id and t.kind = 'group'
    where s.status = 'confirmed' and to_char(s.day, 'YYYY-MM') = m
      and not exists (select 1 from public.group_months g where g.team_id = s.team_id and g.user_id = s.user_id and g.month = m and g.status = 'confirmed')
      and not exists (select 1 from public.team_notifications x where x.user_id = s.user_id and x.kind = 'month_ask' and x.data ->> 'month' = m and x.data ->> 'team' = s.team_id::text)
  loop
    perform public._notify(r.team_id, r.user_id, 'month_ask', 'Conferma le ore di ' || names[substr(m, 6, 2)::int] || ' ' || substr(m, 1, 4), 'Rivedi i tuoi turni del mese e conferma: genero il PDF per te.', jsonb_build_object('month', m, 'team', r.team_id));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.group_month_remind() from public, anon, authenticated;
select cron.schedule('group-month-remind', '0 8 1 * *', 'select public.group_month_remind()');

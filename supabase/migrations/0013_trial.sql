-- Prova di 14 giorni: una sola per persona. Si tiene solo l'impronta (hash) dell'email normalizzata, anche dopo la cancellazione dell'account.
-- (già applicata sul progetto Lifepilot2 come migrazione «trial_14_giorni»)
create table if not exists public.trials (
  email_hash text primary key,
  user_id uuid,
  started_at timestamptz not null default now()
);
alter table public.trials enable row level security;

create or replace function public._norm_email(e text) returns text
language sql immutable set search_path = ''
as $$
  select case
    when split_part(lower(btrim(e)), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(lower(btrim(e)), '@', 1), '+', 1), '.', '') || '@gmail.com'
    else split_part(split_part(lower(btrim(e)), '@', 1), '+', 1) || '@' || split_part(lower(btrim(e)), '@', 2)
  end
$$;

create or replace function public.trial_status() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  em text := coalesce(auth.jwt() ->> 'email', '');
  h text;
  r public.trials;
  plan_now text;
  left_days int;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if em = '' then raise exception 'email_mancante' using errcode = 'P0001'; end if;
  h := encode(sha256(convert_to(public._norm_email(em), 'utf8')), 'hex');
  insert into public.trials (email_hash, user_id) values (h, uid) on conflict (email_hash) do nothing;
  select * into r from public.trials where email_hash = h;
  select e.plan into plan_now from public.entitlements e where e.user_id = uid;
  left_days := greatest(0, 14 - floor(extract(epoch from (now() - r.started_at)) / 86400)::int);
  return jsonb_build_object('started_at', r.started_at, 'days_total', 14, 'days_left', left_days, 'expired', left_days = 0, 'plan', coalesce(plan_now, 'free'));
end
$$;

revoke all on function public.trial_status() from public, anon;
grant execute on function public.trial_status() to authenticated;
revoke all on function public._norm_email(text) from public, anon, authenticated;

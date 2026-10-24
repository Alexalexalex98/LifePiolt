-- Limiti giornalieri dell'IA per piano. Theia risponde SEMPRE: finiti i messaggi "completi" del giorno passa alla modalita' leggera.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default (now() at time zone 'utc')::date,
  n       integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated, public;

-- Chiamata dal server IA con il token dell'utente: conta una richiesta e dice piano, limite e se e' ancora "completa".
create or replace function public.ai_take()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  p text := 'free';
  lim integer;
  used integer;
begin
  if uid is null then raise exception 'non autenticato'; end if;
  select e.plan into p from public.entitlements e where e.user_id = uid;
  p := coalesce(p, 'free');
  lim := case p when 'pro' then 1000 when 'plus' then 200 else 30 end;
  insert into public.ai_usage (user_id, day, n) values (uid, (now() at time zone 'utc')::date, 1)
    on conflict (user_id, day) do update set n = public.ai_usage.n + 1
    returning n into used;
  return jsonb_build_object('plan', p, 'limit', lim, 'used', used, 'full', used <= lim);
end $$;
revoke all on function public.ai_take() from public, anon;
grant execute on function public.ai_take() to authenticated;

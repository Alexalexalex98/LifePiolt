-- Durante i 14 giorni di prova l'AI è piena (più ampia del gratis, con un tetto che protegge i costi) e Theia può conoscere meglio la persona.
-- Chi ha già Premium/Pro resta sul suo piano; finita la prova si torna ai limiti del piano gratuito.
create or replace function public._in_trial(p_user uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.trials t where t.user_id = p_user and t.started_at > now() - interval '14 days')
$$;
revoke all on function public._in_trial(uuid) from public, anon, authenticated;

create or replace function public.ai_take()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  p text := 'free';
  lim integer; cap integer; used integer;
begin
  if uid is null then raise exception 'non autenticato'; end if;
  select e.plan into p from public.entitlements e where e.user_id = uid;
  p := coalesce(p, 'free');
  if p = 'free' and public._in_trial(uid) then p := 'trial'; end if;
  lim := case p when 'pro' then 400 when 'plus' then 100 when 'trial' then 60 else 10 end;
  cap := case p when 'pro' then 800 when 'plus' then 250 when 'trial' then 150 else 30 end;
  insert into public.ai_usage (user_id, day, n) values (uid, (now() at time zone 'utc')::date, 1)
    on conflict (user_id, day) do update set n = public.ai_usage.n + 1
    returning n into used;
  return jsonb_build_object('plan', p, 'limit', lim, 'used', used, 'full', used <= lim, 'hard', cap, 'blocked', used > cap);
end $$;
revoke all on function public.ai_take() from public, anon;
grant execute on function public.ai_take() to authenticated;

create or replace function public.ai_take_doc()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  p text := 'free';
  lim integer; used integer;
begin
  if uid is null then raise exception 'non autenticato'; end if;
  select e.plan into p from public.entitlements e where e.user_id = uid;
  p := coalesce(p, 'free');
  if p = 'free' and public._in_trial(uid) then p := 'trial'; end if;
  lim := case p when 'pro' then 100 when 'plus' then 30 when 'trial' then 15 else 3 end;
  select coalesce(u.docs, 0) into used from public.ai_usage u where u.user_id = uid and u.day = (now() at time zone 'utc')::date;
  if coalesce(used, 0) >= lim then
    return jsonb_build_object('plan', p, 'limit', lim, 'used', coalesce(used, 0), 'full', true, 'blocked', true, 'doc', true);
  end if;
  insert into public.ai_usage (user_id, day, n, docs) values (uid, (now() at time zone 'utc')::date, 0, 1)
    on conflict (user_id, day) do update set docs = public.ai_usage.docs + 1
    returning docs into used;
  return jsonb_build_object('plan', p, 'limit', lim, 'used', used, 'full', true, 'blocked', false, 'doc', true);
end $$;
revoke all on function public.ai_take_doc() from public, anon;
grant execute on function public.ai_take_doc() to authenticated;

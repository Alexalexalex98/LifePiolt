-- Limiti giornalieri dell'IA durante le prove: free 100, plus 400, pro 2000 messaggi "completi" al giorno (poi Theia risponde comunque, in modo piu' breve).
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
  lim := case p when 'pro' then 2000 when 'plus' then 400 else 100 end;
  insert into public.ai_usage (user_id, day, n) values (uid, (now() at time zone 'utc')::date, 1)
    on conflict (user_id, day) do update set n = public.ai_usage.n + 1
    returning n into used;
  return jsonb_build_object('plan', p, 'limit', lim, 'used', used, 'full', used <= lim);
end $$;
revoke all on function public.ai_take() from public, anon;
grant execute on function public.ai_take() to authenticated;

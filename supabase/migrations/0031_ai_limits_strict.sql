-- Limiti IA più stretti (stile versioni gratuite dei grandi assistenti) per tenere bassa la spesa.
-- «Completi» al giorno: free 15, plus 100, pro 400. Oltre questa soglia Theia passa alla modalità leggera (breve ed economica).
-- Tetto massimo al giorno (completi + leggeri): free 40, plus 250, pro 800. Oltre il tetto il server risponde con un invito a riprovare domani.
-- Cambia solo la funzione ai_take(): stessa firma, in più i campi `hard` e `blocked`; i Worker vecchi li ignorano.
create or replace function public.ai_take()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  p text := 'free';
  lim integer;
  cap integer;
  used integer;
begin
  if uid is null then raise exception 'non autenticato'; end if;
  select e.plan into p from public.entitlements e where e.user_id = uid;
  p := coalesce(p, 'free');
  lim := case p when 'pro' then 400 when 'plus' then 100 else 15 end;
  cap := case p when 'pro' then 800 when 'plus' then 250 else 40 end;
  insert into public.ai_usage (user_id, day, n) values (uid, (now() at time zone 'utc')::date, 1)
    on conflict (user_id, day) do update set n = public.ai_usage.n + 1
    returning n into used;
  return jsonb_build_object('plan', p, 'limit', lim, 'used', used, 'full', used <= lim, 'hard', cap, 'blocked', used > cap);
end $$;
revoke all on function public.ai_take() from public, anon;
grant execute on function public.ai_take() to authenticated;

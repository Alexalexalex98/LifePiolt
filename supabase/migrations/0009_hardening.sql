-- 0009: indurimento dopo i controlli di sicurezza di Supabase (advisors). Idempotente.
--  1) funzioni con search_path fisso;
--  2) le funzioni dei trigger non si chiamano da fuori (nessuno le puo' invocare via /rest/v1/rpc);
--  3) are_friends risponde solo se chi chiede e' uno dei due: non si puo' scoprire chi e' amico di chi.
alter function public.min_age_years() set search_path = '';
alter function public.sync_limits() set search_path = '';
alter function public.hlc_wall_ms(text) set search_path = '';

revoke all on function public.shared_command_score() from public, anon, authenticated;
revoke all on function public.shared_command_self_vote() from public, anon, authenticated;
revoke all on function public.social_count_comments() from public, anon, authenticated;
revoke all on function public.social_count_likes() from public, anon, authenticated;
revoke all on function public.social_set_author() from public, anon, authenticated;
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select auth.uid() is not null and auth.uid() in (a, b)
     and exists (select 1 from public.friendships where user_low = least(a, b) and user_high = greatest(a, b) and status = 'accepted');
$$;
revoke all on function public.are_friends(uuid, uuid) from public, anon, authenticated;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

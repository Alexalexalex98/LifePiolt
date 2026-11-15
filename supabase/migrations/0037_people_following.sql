-- Chi seguo, dal server: l'app lo usa per tenere allineato l'elenco di chi segui su ogni telefono. Solo le informazioni principali di ogni persona.
create or replace function public.people_following() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(public._card(f.followed_id) order by f.created_at desc), '[]'::jsonb)
  from public.social_follows f where f.follower_id = auth.uid()
$$;
revoke all on function public.people_following() from public, anon;
grant execute on function public.people_following() to authenticated;

-- Esportazione dei propri dati (GDPR art. 20 / nLPD): una sola funzione, solo per l'utente collegato, che restituisce tutto cio' che il server sa di lui.
-- Non include: il codice d'identita' (solo lo stato), i dati degli altri utenti (degli amici solo il nome mostrato), le password.
create or replace function public.export_my_data()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  wait int;
  out jsonb;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  wait := public._rate_hit(uid, 'export', 3);
  if wait > 0 then return public._too_many(wait); end if;

  select jsonb_build_object(
    'version', 1,
    'exported_at', now(),
    'account', jsonb_build_object(
      'email', (select u.email from auth.users u where u.id = uid),
      'created_at', (select u.created_at from auth.users u where u.id = uid),
      'profile', (select to_jsonb(p) - 'user_id' from public.profiles p where p.user_id = uid),
      'plan', (select e.plan from public.entitlements e where e.user_id = uid),
      'consents', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' - 'id' order by c.accettato_il) from public.consent_log c where c.user_id = uid), '[]'::jsonb),
      'devices', coalesce((select jsonb_agg(to_jsonb(d) - 'user_id' order by d.creato_il) from public.devices d where d.user_id = uid), '[]'::jsonb),
      'identity', (select jsonb_build_object('provider', i.provider, 'document_country', i.paese_doc, 'document_type', i.tipo_doc, 'verified_at', i.verificato_il) from public.identity_claims i where i.user_id = uid)
    ),
    'social', jsonb_build_object(
      'profile', (select to_jsonb(s) - 'user_id' from public.social_profiles s where s.user_id = uid),
      'posts', coalesce((select jsonb_agg(to_jsonb(p) - 'author_id' order by p.created_at) from public.social_posts p where p.author_id = uid), '[]'::jsonb),
      'comments', coalesce((select jsonb_agg(to_jsonb(c) - 'author_id' order by c.created_at) from public.social_comments c where c.author_id = uid), '[]'::jsonb),
      'likes', coalesce((select jsonb_agg(jsonb_build_object('post_id', l.post_id, 'created_at', l.created_at) order by l.created_at) from public.social_likes l where l.user_id = uid), '[]'::jsonb),
      'following', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(sp.display_name, ''), 'since', f.created_at) order by f.created_at) from public.social_follows f left join public.social_profiles sp on sp.user_id = f.followed_id where f.follower_id = uid), '[]'::jsonb),
      'followers_count', (select count(*) from public.social_follows f where f.followed_id = uid),
      'reports_sent', coalesce((select jsonb_agg(jsonb_build_object('post_id', r.post_id, 'reason', r.reason, 'created_at', r.created_at) order by r.created_at) from public.social_reports r where r.reporter_id = uid), '[]'::jsonb),
      'shared_commands', coalesce((select jsonb_agg(jsonb_build_object('pattern', c.pattern, 'kind', c.kind, 'target', c.target, 'score', c.score, 'created_at', c.created_at)) from public.shared_commands c where c.created_by = uid), '[]'::jsonb)
    ),
    'friends', coalesce((select jsonb_agg(jsonb_build_object(
        'name', coalesce(sp.display_name, ''),
        'status', f.status,
        'requested_by_me', f.requested_by = uid,
        'blocked_by_me', f.blocked_by = uid,
        'since', f.created_at) order by f.created_at)
      from public.friendships f
      left join public.social_profiles sp on sp.user_id = case when f.user_low = uid then f.user_high else f.user_low end
      where f.user_low = uid or f.user_high = uid), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(jsonb_build_object(
        'direction', case when m.sender = uid then 'sent' else 'received' end,
        'with', coalesce(sp.display_name, ''),
        'body', m.body, 'sent_at', m.created_at, 'read_at', m.read_at) order by m.created_at)
      from public.dm_messages m
      left join public.social_profiles sp on sp.user_id = case when m.sender = uid then m.recipient else m.sender end
      where m.sender = uid or m.recipient = uid), '[]'::jsonb),
    'ai_usage', coalesce((select jsonb_agg(jsonb_build_object('day', a.day, 'requests', a.n) order by a.day) from public.ai_usage a where a.user_id = uid), '[]'::jsonb),
    'sync', jsonb_build_object(
      'state', (select to_jsonb(s) - 'user_id' from public.sync_state s where s.user_id = uid),
      'note', 'I dati sincronizzati sono cifrati sul tuo telefono: qui trovi i blocchi cifrati, che solo i tuoi dispositivi sanno leggere.',
      'changes', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.server_seq) from (select * from public.sync_changes x where x.user_id = uid order by x.server_seq limit 5000) c), '[]'::jsonb)
    )
  ) into out;
  return out;
end $$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

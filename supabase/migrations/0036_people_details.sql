-- Anteprima del profilo più ricca: voto (media con affidabilità), iscritto da, identità verificata, numero di post e di annunci che chi guarda può vedere.
-- Ancora nessun contenuto: l'anteprima mostra solo numeri e informazioni principali. I voti vivono in una tabella chiusa: si leggono e si danno solo con le funzioni.
create table if not exists public.social_ratings (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'profile' check (kind in ('profile', 'qa', 'item')),
  ref text not null default 'profile' check (char_length(ref) between 1 and 80),
  stars smallint not null check (stars between 1 and 5),
  helpful boolean,
  created_at timestamptz not null default now(),
  unique (from_user, to_user, kind, ref),
  check (from_user <> to_user)
);
create index if not exists social_ratings_to on public.social_ratings (to_user);
alter table public.social_ratings enable row level security;
revoke all on public.social_ratings from anon, authenticated;

-- Voto complessivo (0-5): media pesata con valore di partenza 3,5 e peso 5 (poche valutazioni restano vicine a 3,5). Pesi: profilo 1, botta e risposta 0,5, corso 1/3;
-- moltiplicati per l'anzianità dell'account che vota (meno di 7 giorni 0,4, meno di 30 giorni 0,7, poi 1). «Non utile» vale al massimo 2 stelle.
create or replace function public._reputation(p_user uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  with v as (
    select case when r.helpful is false then least(r.stars, 2) else r.stars end as stars,
      (case r.kind when 'profile' then 1.0 when 'qa' then 0.5 else 1.0 / 3 end) * (case when u.created_at > now() - interval '7 days' then 0.4 when u.created_at > now() - interval '30 days' then 0.7 else 1.0 end) as w
    from public.social_ratings r join auth.users u on u.id = r.from_user where r.to_user = p_user)
  select jsonb_build_object(
    'votes', (select count(*) from v),
    'score', (select case when count(*) = 0 then null else round(((5 * 3.5 + sum(w * stars)) / (5 + sum(w)))::numeric, 2) end from v),
    'confidence', (select case when count(*) = 0 then 'nessuna' when count(*) < 3 then 'bassa' when count(*) < 10 then 'media' else 'alta' end from v))
$$;
revoke all on function public._reputation(uuid) from public, anon, authenticated;

-- La scheda del profilo, con i dettagli. I numeri di post e annunci contano solo ciò che chi guarda può già vedere.
create or replace function public._card(p_user uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', p.user_id, 'display_name', p.display_name, 'username', p.username, 'avatar_url', p.avatar_url, 'bio', p.bio,
    'followers', (select count(*) from public.social_follows f where f.followed_id = p.user_id and f.status = 'accepted'),
    'following', (select count(*) from public.social_follows f where f.follower_id = p.user_id and f.status = 'accepted'),
    'follow', (select f.status from public.social_follows f where f.follower_id = auth.uid() and f.followed_id = p.user_id),
    'follow_approval', p.follow_approval, 'me', p.user_id = auth.uid(),
    'since', p.created_at,
    'verified', exists (select 1 from public.identity_claims c where c.user_id = p.user_id),
    'posts', (select count(*) from public.social_posts s where s.author_id = p.user_id and s.deleted_at is null and public._aud_ok(s.author_id, s.audience)),
    'listings', jsonb_build_object(
      'service', (select count(*) from public.social_listings l where l.author_id = p.user_id and l.deleted_at is null and l.kind = 'service' and public._aud_ok(l.author_id, l.audience)),
      'seminar', (select count(*) from public.social_listings l where l.author_id = p.user_id and l.deleted_at is null and l.kind = 'seminar' and public._aud_ok(l.author_id, l.audience)),
      'idea', (select count(*) from public.social_listings l where l.author_id = p.user_id and l.deleted_at is null and l.kind = 'idea' and public._aud_ok(l.author_id, l.audience)),
      'offer', (select count(*) from public.social_listings l where l.author_id = p.user_id and l.deleted_at is null and l.kind = 'offer' and public._aud_ok(l.author_id, l.audience))),
    'reputation', public._reputation(p.user_id),
    'my_vote', (select r.stars from public.social_ratings r where r.from_user = auth.uid() and r.to_user = p.user_id and r.kind = 'profile' and r.ref = 'profile'))
  from public.social_profiles p where p.user_id = p_user
$$;
revoke all on function public._card(uuid) from public, anon, authenticated;

-- Dare un voto. Al profilo: serve seguire la persona (un solo voto, cambiabile dopo 30 giorni). Ai singoli scambi o corsi: massimo 10 voti in 24 ore.
create or replace function public.people_rate(p_to uuid, p_stars integer, p_kind text default 'profile', p_ref text default 'profile', p_helpful boolean default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); old public.social_ratings;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if p_to = uid then raise exception 'voto_a_se_stessi' using errcode = 'P0001'; end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 or p_kind not in ('profile', 'qa', 'item') then raise exception 'voto_non_valido' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.social_profiles where user_id = p_to) then raise exception 'non_visibile' using errcode = 'P0001'; end if;
  if p_kind = 'profile' then
    p_ref := 'profile';
    if not exists (select 1 from public.social_follows f where f.follower_id = uid and f.followed_id = p_to and f.status = 'accepted') then raise exception 'non_puoi_votare' using errcode = 'P0001'; end if;
  else
    if (select count(*) from public.social_ratings where from_user = uid and kind <> 'profile' and created_at > now() - interval '24 hours') >= 10 then raise exception 'troppi_voti' using errcode = 'P0001'; end if;
  end if;
  select * into old from public.social_ratings where from_user = uid and to_user = p_to and kind = p_kind and ref = left(p_ref, 80);
  if found then
    if old.created_at > now() - interval '30 days' then raise exception 'voto_gia_dato' using errcode = 'P0001'; end if;
    update public.social_ratings set stars = p_stars, helpful = p_helpful, created_at = now() where id = old.id;
  else
    insert into public.social_ratings (from_user, to_user, kind, ref, stars, helpful) values (uid, p_to, p_kind, left(p_ref, 80), p_stars, p_helpful);
  end if;
  return public._card(p_to);
end $$;
revoke all on function public.people_rate(uuid, integer, text, text, boolean) from public, anon;
grant execute on function public.people_rate(uuid, integer, text, text, boolean) to authenticated;

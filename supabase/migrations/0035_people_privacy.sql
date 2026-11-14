-- Persone: codice univoco (QR), nome utente facoltativo, profilo trovabile o privato, follow sul server, pubblico di post, annunci, idee e seminari.
-- Regole: nome e cognome (display_name) ci sono sempre; i dati personali (via, età, email...) restano nella tabella privata `profiles` e non si leggono mai da qui.
-- Un profilo privato non compare nelle ricerche per nome o nome utente; si trova solo con il codice o il QR, oppure arrivando da un suo contenuto pubblico.
-- L'anteprima di un profilo mostra solo le informazioni principali: mai post, idee o annunci. Solo oggetti nuovi o colonne in più; cambiano le regole di lettura di profili, post, commenti e mi piace.

alter table public.social_profiles add column if not exists username text;
alter table public.social_profiles add column if not exists username_changed_at timestamptz;
alter table public.social_profiles add column if not exists discoverable boolean not null default true;
alter table public.social_profiles add column if not exists follow_approval boolean not null default false;
alter table public.social_profiles drop constraint if exists social_profiles_username_check;
alter table public.social_profiles add constraint social_profiles_username_check check (username is null or username ~ '^[a-z0-9][a-z0-9._]{2,19}$');
create unique index if not exists social_profiles_username on public.social_profiles (username) where username is not null;

alter table public.social_follows add column if not exists status text not null default 'accepted';
alter table public.social_follows drop constraint if exists social_follows_status_check;
alter table public.social_follows add constraint social_follows_status_check check (status in ('accepted', 'pending'));
alter table public.social_posts add column if not exists audience text not null default 'public';
alter table public.social_posts drop constraint if exists social_posts_audience_check;
alter table public.social_posts add constraint social_posts_audience_check check (audience in ('public', 'followers'));

-- Annunci (servizi, seminari...) e idee condivisi: il pubblico lo sceglie chi li pubblica.
create table if not exists public.social_listings (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null default '' check (char_length(author_name) <= 60),
  kind text not null check (kind in ('service', 'seminar', 'idea', 'offer')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null default '' check (char_length(body) <= 4000),
  payload jsonb not null default '{}'::jsonb check (octet_length(payload::text) <= 20000),
  audience text not null default 'public' check (audience in ('public', 'followers', 'not_followers')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists social_listings_author on public.social_listings (author_id, created_at desc) where deleted_at is null;
create index if not exists social_listings_kind on public.social_listings (kind, created_at desc) where deleted_at is null;

create table if not exists public.people_search_log (user_id uuid not null references auth.users (id) on delete cascade, at timestamptz not null default now());
create index if not exists people_search_log_user on public.people_search_log (user_id, at desc);
alter table public.people_search_log enable row level security;
revoke all on public.people_search_log from anon, authenticated;

-- ---------- chi può vedere cosa ----------
-- Il pubblico di un contenuto rispetto a chi guarda: tutti / solo chi segue l'autore / tutti tranne chi segue l'autore. L'autore vede sempre i suoi.
create or replace function public._aud_ok(p_author uuid, p_audience text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when auth.uid() is null then false
    when p_author = auth.uid() then true
    when p_audience = 'public' then true
    when p_audience = 'followers' then exists (select 1 from public.social_follows f where f.follower_id = auth.uid() and f.followed_id = p_author and f.status = 'accepted')
    when p_audience = 'not_followers' then not exists (select 1 from public.social_follows f where f.follower_id = auth.uid() and f.followed_id = p_author and f.status = 'accepted')
    else false end
$$;
revoke all on function public._aud_ok(uuid, text) from public, anon;
grant execute on function public._aud_ok(uuid, text) to authenticated;

-- Lettura: un profilo privato non si elenca; post e annunci seguono il loro pubblico; commenti e mi piace seguono il post.
drop policy if exists sp_read on public.social_profiles;
create policy sp_read on public.social_profiles for select to authenticated using (
  user_id = auth.uid() or discoverable
  or exists (select 1 from public.social_follows f where (f.follower_id = auth.uid() and f.followed_id = user_id) or (f.followed_id = auth.uid() and f.follower_id = user_id)));
drop policy if exists po_read on public.social_posts;
create policy po_read on public.social_posts for select to authenticated using (deleted_at is null and public._aud_ok(author_id, audience));
drop policy if exists co_read on public.social_comments;
create policy co_read on public.social_comments for select to authenticated using (deleted_at is null and exists (select 1 from public.social_posts p where p.id = post_id));
drop policy if exists li_read on public.social_likes;
create policy li_read on public.social_likes for select to authenticated using (exists (select 1 from public.social_posts p where p.id = post_id));
drop policy if exists li_ins on public.social_likes;
create policy li_ins on public.social_likes for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.social_posts p where p.id = post_id));
drop policy if exists co_ins on public.social_comments;
create policy co_ins on public.social_comments for insert to authenticated with check (author_id = auth.uid() and exists (select 1 from public.social_posts p where p.id = post_id));

alter table public.social_listings enable row level security;
create policy sl_read on public.social_listings for select to authenticated using (author_id = auth.uid() or (deleted_at is null and public._aud_ok(author_id, audience)));
create policy sl_ins on public.social_listings for insert to authenticated with check (author_id = auth.uid());
create policy sl_upd on public.social_listings for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create or replace function public._listing_author() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select display_name into new.author_name from public.social_profiles where user_id = new.author_id;
  if new.author_name is null then raise exception 'profilo_pubblico_mancante' using errcode = 'P0001'; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists social_listings_author on public.social_listings;
create trigger social_listings_author before insert or update on public.social_listings for each row execute function public._listing_author();

-- Il follow passa solo dalle funzioni: con «approvazione» la richiesta resta in attesa finché non la accetti.
drop policy if exists fo_ins on public.social_follows;
drop policy if exists fo_read on public.social_follows;
create policy fo_read on public.social_follows for select to authenticated using (follower_id = auth.uid() or followed_id = auth.uid());
revoke insert, update on public.social_follows from authenticated, anon;

-- ---------- funzioni dell'app ----------
create or replace function public._card(p_user uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', p.user_id, 'display_name', p.display_name, 'username', p.username, 'avatar_url', p.avatar_url, 'bio', p.bio,
    'followers', (select count(*) from public.social_follows f where f.followed_id = p.user_id and f.status = 'accepted'),
    'following', (select count(*) from public.social_follows f where f.follower_id = p.user_id and f.status = 'accepted'),
    'follow', (select f.status from public.social_follows f where f.follower_id = auth.uid() and f.followed_id = p.user_id),
    'follow_approval', p.follow_approval, 'me', p.user_id = auth.uid())
  from public.social_profiles p where p.user_id = p_user
$$;
revoke all on function public._card(uuid) from public, anon, authenticated;

-- Il mio profilo: crea il profilo pubblico se manca (con nome e cognome) e restituisce codice, nome utente e privacy.
create or replace function public.people_me(p_name text default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); p public.social_profiles; code text;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into p from public.social_profiles where user_id = uid;
  if not found then
    if char_length(btrim(coalesce(p_name, ''))) < 1 then raise exception 'profilo_pubblico_mancante' using errcode = 'P0001'; end if;
    insert into public.social_profiles (user_id, display_name) values (uid, left(btrim(p_name), 60));
  end if;
  code := public.my_friend_code();
  select * into p from public.social_profiles where user_id = uid;
  return jsonb_build_object('user_id', uid, 'display_name', p.display_name, 'username', p.username, 'code', code, 'discoverable', p.discoverable, 'follow_approval', p.follow_approval,
    'can_change_username_at', case when p.username_changed_at is null then null else p.username_changed_at + interval '30 days' end);
end $$;

create or replace function public.people_set_username(p_username text) returns text
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); u text := lower(btrim(coalesce(p_username, ''))); p public.social_profiles;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into p from public.social_profiles where user_id = uid;
  if not found then raise exception 'profilo_pubblico_mancante' using errcode = 'P0001'; end if;
  if u = '' then update public.social_profiles set username = null, username_changed_at = now(), updated_at = now() where user_id = uid; return null; end if;
  if u !~ '^[a-z0-9][a-z0-9._]{2,19}$' or u ~ '\.\.' or u in ('admin', 'lifepilot', 'theia', 'support', 'assistenza', 'staff') then raise exception 'nome_utente_non_valido' using errcode = 'P0001'; end if;
  if p.username = u then return u; end if;
  if p.username is not null and p.username_changed_at is not null and p.username_changed_at > now() - interval '30 days' then raise exception 'nome_utente_troppo_presto' using errcode = 'P0001'; end if;
  if exists (select 1 from public.social_profiles where username = u) then raise exception 'nome_utente_occupato' using errcode = 'P0001'; end if;
  update public.social_profiles set username = u, username_changed_at = now(), updated_at = now() where user_id = uid;
  return u;
end $$;

create or replace function public.people_set_privacy(p_discoverable boolean, p_follow_approval boolean) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  update public.social_profiles set discoverable = coalesce(p_discoverable, true), follow_approval = coalesce(p_follow_approval, false), updated_at = now() where user_id = auth.uid();
  if not found then raise exception 'profilo_pubblico_mancante' using errcode = 'P0001'; end if;
end $$;

-- Cerca: «@nome» = nome utente, 8 caratteri del codice = codice (anche se il profilo è privato), altrimenti nome e cognome (solo profili trovabili). Poche ricerche al minuto.
create or replace function public.people_search(p_q text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); q text := btrim(coalesce(p_q, '')); out jsonb; code text;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if (select count(*) from public.people_search_log where user_id = uid and at > now() - interval '1 minute') >= 20 then raise exception 'troppe_ricerche' using errcode = 'P0001'; end if;
  delete from public.people_search_log where user_id = uid and at < now() - interval '1 hour';
  insert into public.people_search_log (user_id) values (uid);
  code := upper(regexp_replace(q, '[\s-]', '', 'g'));
  if code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$' then
    select coalesce(jsonb_agg(public._card(p.user_id)), '[]'::jsonb) into out from public.social_profiles p where p.friend_code = code and p.user_id <> uid;
    if jsonb_array_length(out) > 0 then return out; end if;
  end if;
  if left(q, 1) = '@' then
    q := lower(substr(q, 2));
    if char_length(q) < 2 then return '[]'::jsonb; end if;
    select coalesce(jsonb_agg(public._card(x.user_id)), '[]'::jsonb) into out from (select user_id from public.social_profiles where discoverable and username like replace(replace(q, '%', ''), '_', '\_') || '%' and user_id <> uid order by username limit 20) x;
    return out;
  end if;
  if char_length(q) < 3 then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(public._card(x.user_id)), '[]'::jsonb) into out from (
    select user_id from public.social_profiles where discoverable and user_id <> uid and (lower(display_name) like '%' || replace(replace(lower(q), '%', ''), '_', '\_') || '%' or username = lower(q))
    order by (lower(display_name) like lower(q) || '%') desc, display_name limit 20) x;
  return out;
end $$;

-- Anteprima: solo informazioni principali (nome, nome utente, foto, bio, numeri). Si vede se il profilo è trovabile, se c'è un legame di follow,
-- oppure se si arriva da un suo contenuto che puoi vedere (post o annuncio pubblico).
create or replace function public.people_preview(p_user uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); ok boolean;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select (p.user_id = uid or p.discoverable
      or exists (select 1 from public.social_follows f where (f.follower_id = uid and f.followed_id = p.user_id) or (f.followed_id = uid and f.follower_id = p.user_id))
      or exists (select 1 from public.social_listings l where l.author_id = p.user_id and l.deleted_at is null and public._aud_ok(l.author_id, l.audience))
      or exists (select 1 from public.social_posts s where s.author_id = p.user_id and s.deleted_at is null and public._aud_ok(s.author_id, s.audience)))
    into ok from public.social_profiles p where p.user_id = p_user;
  if ok is not true then raise exception 'non_visibile' using errcode = 'P0001'; end if;
  return public._card(p_user);
end $$;

-- Dal QR o dal codice: sempre possibile, anche per i profili privati.
create or replace function public.people_by_code(p_code text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare c text := upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g')); u uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if c !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$' then raise exception 'codice_non_valido' using errcode = 'P0001'; end if;
  select user_id into u from public.social_profiles where friend_code = c;
  if u is null then raise exception 'codice_non_valido' using errcode = 'P0001'; end if;
  return public._card(u);
end $$;

create or replace function public.people_follow(p_user uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); need boolean; st text;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if p_user = uid then raise exception 'non_valido' using errcode = 'P0001'; end if;
  select follow_approval into need from public.social_profiles where user_id = p_user;
  if not found then raise exception 'non_visibile' using errcode = 'P0001'; end if;
  st := case when need then 'pending' else 'accepted' end;
  insert into public.social_follows (follower_id, followed_id, status) values (uid, p_user, st) on conflict (follower_id, followed_id) do nothing;
  return (select status from public.social_follows where follower_id = uid and followed_id = p_user);
end $$;

create or replace function public.people_unfollow(p_user uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  delete from public.social_follows where follower_id = auth.uid() and followed_id = p_user;
end $$;

create or replace function public.people_follow_answer(p_user uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if p_accept then update public.social_follows set status = 'accepted' where follower_id = p_user and followed_id = auth.uid() and status = 'pending';
  else delete from public.social_follows where follower_id = p_user and followed_id = auth.uid() and status = 'pending'; end if;
end $$;

create or replace function public.people_follow_requests() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(public._card(f.follower_id) order by f.created_at desc), '[]'::jsonb) from public.social_follows f where f.followed_id = auth.uid() and f.status = 'pending'
$$;

revoke all on function public.people_me(text), public.people_set_username(text), public.people_set_privacy(boolean, boolean), public.people_search(text), public.people_preview(uuid), public.people_by_code(text),
  public.people_follow(uuid), public.people_unfollow(uuid), public.people_follow_answer(uuid, boolean), public.people_follow_requests() from public, anon;
grant execute on function public.people_me(text), public.people_set_username(text), public.people_set_privacy(boolean, boolean), public.people_search(text), public.people_preview(uuid), public.people_by_code(text),
  public.people_follow(uuid), public.people_unfollow(uuid), public.people_follow_answer(uuid, boolean), public.people_follow_requests() to authenticated;

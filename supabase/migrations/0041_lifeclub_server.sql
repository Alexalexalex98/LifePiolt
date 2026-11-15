-- LifeClub sul server. Privato per costruzione: chi non è iscritto non legge niente (nemmeno le anteprime), i contenuti Premium solo agli abbonati, i file in un archivio
-- privato con accesso deciso dal server (link firmati a scadenza breve). Parte social: serve avere almeno 16 anni e nessuna sospensione. I club 18+ solo da 18 anni.
-- Il Premium NON si compra ancora: i pagamenti non sono attivi. Un abbonamento Premium lo può assegnare solo il creatore (regalo o prova) finché non c'è un fornitore di pagamenti.
create or replace function public.club_rules_version() returns integer language sql immutable as $$ select 1 $$;

create table if not exists public.club_clubs (
  id text primary key check (char_length(id) between 1 and 80),
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_name text not null default '' check (char_length(owner_name) <= 80),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  tagline text not null default '' check (char_length(tagline) <= 200),
  description text not null default '' check (char_length(description) <= 4000),
  cover jsonb not null default '{}'::jsonb,
  categories text[] not null default '{}' check (cardinality(categories) <= 8),
  published boolean not null default false,
  adult boolean not null default false,
  pricing jsonb not null default '{}'::jsonb,
  chat jsonb not null default '{}'::jsonb,
  rules_version integer,
  rules_at timestamptz,
  hidden boolean not null default false,          -- sospeso da chi gestisce l'app
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.club_courses (
  id text primary key check (char_length(id) between 1 and 80),
  club_id text not null references public.club_clubs (id) on delete cascade,
  published boolean not null default false,
  position integer not null default 0,
  data jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 60000)
);
create index if not exists club_courses_club on public.club_courses (club_id, position);
create table if not exists public.club_lessons (
  id text primary key check (char_length(id) between 1 and 80),
  club_id text not null references public.club_clubs (id) on delete cascade,
  course_id text not null references public.club_courses (id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'premium')),
  preview boolean not null default false,
  position integer not null default 0,
  media_path text check (media_path is null or char_length(media_path) <= 300),
  hidden boolean not null default false,
  data jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 60000)
);
create index if not exists club_lessons_club on public.club_lessons (club_id, course_id, position);
create table if not exists public.club_posts (
  id text primary key check (char_length(id) between 1 and 80),
  club_id text not null references public.club_clubs (id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'premium')),
  hidden boolean not null default false,
  data jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 20000)
);
create index if not exists club_posts_club on public.club_posts (club_id);
create table if not exists public.club_members (
  club_id text not null references public.club_clubs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  tier text not null default 'free' check (tier in ('follower', 'free', 'premium')),
  status text not null default 'attiva' check (status in ('attiva', 'in_pausa', 'annullata')),
  since timestamptz not null default now(),
  ends_at timestamptz,
  granted boolean not null default false,          -- Premium assegnato dal creatore
  muted_by_owner boolean not null default false,
  ever_joined boolean not null default true,
  primary key (club_id, user_id)
);
create index if not exists club_members_user on public.club_members (user_id);
create table if not exists public.club_comments (
  id text primary key check (char_length(id) between 1 and 80),
  club_id text not null references public.club_clubs (id) on delete cascade,
  lesson_id text not null,
  author_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null default '',
  data jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 6000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists club_comments_lesson on public.club_comments (club_id, lesson_id, created_at);
create table if not exists public.club_ratings (
  club_id text not null references public.club_clubs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
alter table public.club_clubs enable row level security;
alter table public.club_courses enable row level security;
alter table public.club_lessons enable row level security;
alter table public.club_posts enable row level security;
alter table public.club_members enable row level security;
alter table public.club_comments enable row level security;
alter table public.club_ratings enable row level security;
-- nessuna lettura o scrittura diretta dall'app: tutto passa dalle funzioni (che applicano età, sospensioni, iscrizioni e livello)
revoke all on public.club_clubs, public.club_courses, public.club_lessons, public.club_posts, public.club_members, public.club_comments, public.club_ratings from anon, authenticated;

-- ---------- chi può cosa ----------
create or replace function public._age_at_least(p_user uuid, p_years integer) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles p where p.user_id = p_user and p.data_nascita is not null and p.data_nascita <= (current_date - make_interval(years => p_years))::date) $$;
revoke all on function public._age_at_least(uuid, integer) from public, anon, authenticated;

-- Il livello di una persona in un club: owner, premium, free, follower o none. Il Premium scaduto (o annullato dopo la fine del periodo) vale free.
create or replace function public._club_tier(p_club text, p_user uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when exists (select 1 from public.club_clubs c where c.id = p_club and c.owner_id = p_user) then 'owner'
    else coalesce((select case
      when m.tier = 'premium' and m.status <> 'in_pausa' and (m.ends_at is null or m.ends_at > now()) then 'premium'
      when m.tier in ('free', 'premium') then 'free'
      when m.tier = 'follower' then 'follower'
      else 'none' end from public.club_members m where m.club_id = p_club and m.user_id = p_user), 'none') end
$$;
revoke all on function public._club_tier(text, uuid) from public, anon;
grant execute on function public._club_tier(text, uuid) to authenticated;

-- La pagina del club (nome, descrizione, prezzo) la vede: il creatore, gli iscritti, e chiunque (con i requisiti) se è pubblicato e non sospeso. Un club 18+ solo da maggiorenni.
create or replace function public._club_meta_ok(p_club text, p_user uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public._social_ok(p_user) and exists (select 1 from public.club_clubs c where c.id = p_club and (
    c.owner_id = p_user
    or (not c.hidden and public._social_ok(c.owner_id) and (not c.adult or public._age_at_least(p_user, 18)) and (c.published or exists (select 1 from public.club_members m where m.club_id = c.id and m.user_id = p_user)))))
$$;
revoke all on function public._club_meta_ok(text, uuid) from public, anon;
grant execute on function public._club_meta_ok(text, uuid) to authenticated;

-- ---------- archivio privato dei file ----------
-- Percorso: <club>/<free|premium|cover>/<nome>. Free: iscritti; Premium: abbonati; cover: chi può vedere la pagina. Scrive solo il creatore del club.
insert into storage.buckets (id, name, public, file_size_limit) values ('club-private', 'club-private', false, 209715200) on conflict (id) do nothing;
create or replace function public._club_path_ok(p_name text, p_write boolean) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare club text := split_part(p_name, '/', 1); part text := split_part(p_name, '/', 2); t text; uid uuid := auth.uid();
begin
  if uid is null or club = '' or part = '' or not public._social_ok(uid) then return false; end if;
  t := public._club_tier(club, uid);
  if t = 'owner' then return true; end if;
  if p_write then return false; end if;
  if exists (select 1 from public.club_clubs c where c.id = club and (c.hidden or not public._social_ok(c.owner_id))) then return false; end if;
  if part = 'premium' then return t = 'premium'; end if;
  if part = 'free' then return t in ('free', 'premium'); end if;
  if part = 'cover' then return public._club_meta_ok(club, uid); end if;
  return false;
end $$;
revoke all on function public._club_path_ok(text, boolean) from public, anon;
grant execute on function public._club_path_ok(text, boolean) to authenticated;
drop policy if exists club_files_read on storage.objects;
create policy club_files_read on storage.objects for select to authenticated using (bucket_id = 'club-private' and public._club_path_ok(name, false));
drop policy if exists club_files_write on storage.objects;
create policy club_files_write on storage.objects for insert to authenticated with check (bucket_id = 'club-private' and public._club_path_ok(name, true));
drop policy if exists club_files_update on storage.objects;
create policy club_files_update on storage.objects for update to authenticated using (bucket_id = 'club-private' and public._club_path_ok(name, true));
drop policy if exists club_files_delete on storage.objects;
create policy club_files_delete on storage.objects for delete to authenticated using (bucket_id = 'club-private' and public._club_path_ok(name, true));

-- ---------- il creatore salva il suo club ----------
create or replace function public.club_save(p_doc jsonb) returns text
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); d jsonb := p_doc -> 'club'; cid text := p_doc -> 'club' ->> 'id'; c jsonb; l jsonb; pst jsonb; ci integer := 0; li integer; nl integer := 0; want_pub boolean; ack_v integer; oname text;
begin
  perform public._require_social();
  if octet_length(p_doc::text) > 3000000 then raise exception 'club_troppo_grande' using errcode = 'P0001'; end if;
  if cid is null or char_length(btrim(coalesce(d ->> 'name', ''))) < 1 then raise exception 'club_non_valido' using errcode = 'P0001'; end if;
  if exists (select 1 from public.club_clubs where id = cid and owner_id <> uid) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  want_pub := coalesce((d ->> 'published')::boolean, false); ack_v := nullif(d -> 'rulesAccepted' ->> 'version', '')::integer;
  if want_pub and ack_v is distinct from public.club_rules_version() then raise exception 'regole_non_accettate' using errcode = 'P0001'; end if;
  if coalesce((d ->> 'adult')::boolean, false) and not public._age_at_least(uid, 18) then raise exception 'club_adulti_solo_maggiorenni' using errcode = 'P0001'; end if;
  select display_name into oname from public.social_profiles where user_id = uid;
  insert into public.club_clubs (id, owner_id, owner_name, name, tagline, description, cover, categories, published, adult, pricing, chat, rules_version, rules_at)
  values (cid, uid, coalesce(oname, ''), left(btrim(d ->> 'name'), 120), left(coalesce(d ->> 'tagline', ''), 200), left(coalesce(d ->> 'description', ''), 4000), coalesce(d -> 'cover', '{}'::jsonb),
    coalesce((select array_agg(x) from (select jsonb_array_elements_text(coalesce(d -> 'categories', '[]'::jsonb)) as x limit 8) q), '{}'), want_pub, coalesce((d ->> 'adult')::boolean, false),
    coalesce(d -> 'pricing', '{}'::jsonb), coalesce(d -> 'chat', '{}'::jsonb), ack_v, case when ack_v is null then null else to_timestamp(coalesce(nullif(d -> 'rulesAccepted' ->> 'at', '')::double precision, 0) / 1000.0) end)
  on conflict (id) do update set name = excluded.name, tagline = excluded.tagline, description = excluded.description, cover = excluded.cover, categories = excluded.categories,
    published = excluded.published, adult = excluded.adult, pricing = excluded.pricing, chat = excluded.chat, rules_version = excluded.rules_version, rules_at = excluded.rules_at, owner_name = excluded.owner_name, updated_at = now();
  -- corsi e lezioni: quelli non più presenti si tolgono
  delete from public.club_lessons where club_id = cid and id not in (select lx ->> 'id' from jsonb_array_elements(coalesce(p_doc -> 'courses', '[]'::jsonb)) cx, jsonb_array_elements(coalesce(cx -> 'lessons', '[]'::jsonb)) lx);
  delete from public.club_courses where club_id = cid and id not in (select cx ->> 'id' from jsonb_array_elements(coalesce(p_doc -> 'courses', '[]'::jsonb)) cx);
  for c in select value from jsonb_array_elements(coalesce(p_doc -> 'courses', '[]'::jsonb)) loop
    ci := ci + 1; if ci > 100 then raise exception 'troppi_corsi' using errcode = 'P0001'; end if;
    insert into public.club_courses (id, club_id, published, position, data) values (c ->> 'id', cid, coalesce((c ->> 'published')::boolean, false), ci, c - 'lessons')
      on conflict (id) do update set published = excluded.published, position = excluded.position, data = excluded.data where public.club_courses.club_id = cid;
    li := 0;
    for l in select value from jsonb_array_elements(coalesce(c -> 'lessons', '[]'::jsonb)) loop
      li := li + 1; nl := nl + 1; if nl > 2000 then raise exception 'troppe_lezioni' using errcode = 'P0001'; end if;
      if (l ->> 'mediaPath') is not null and split_part(l ->> 'mediaPath', '/', 1) <> cid then raise exception 'file_non_valido' using errcode = 'P0001'; end if;
      insert into public.club_lessons (id, club_id, course_id, tier, preview, position, media_path, data)
      values (l ->> 'id', cid, c ->> 'id', case when l ->> 'tier' = 'premium' then 'premium' else 'free' end, coalesce((l ->> 'preview')::boolean, false), li, l ->> 'mediaPath', (l - 'uri' - 'mediaPath'))
      on conflict (id) do update set course_id = excluded.course_id, tier = excluded.tier, preview = excluded.preview, position = excluded.position, media_path = excluded.media_path, data = excluded.data where public.club_lessons.club_id = cid;
    end loop;
  end loop;
  delete from public.club_posts where club_id = cid and id not in (select px ->> 'id' from jsonb_array_elements(coalesce(p_doc -> 'posts', '[]'::jsonb)) px);
  for pst in select value from jsonb_array_elements(coalesce(p_doc -> 'posts', '[]'::jsonb)) limit 500 loop
    insert into public.club_posts (id, club_id, tier, data) values (pst ->> 'id', cid, case when pst ->> 'tier' = 'premium' then 'premium' else 'free' end, pst)
      on conflict (id) do update set tier = excluded.tier, data = excluded.data where public.club_posts.club_id = cid;
  end loop;
  return cid;
end $$;

-- ---------- lettura: solo quello che questa persona può vedere ----------
create or replace function public._club_card(p_club text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('id', c.id, 'owner', c.owner_name, 'ownerId', c.owner_id, 'name', c.name, 'tagline', c.tagline, 'description', c.description, 'cover', c.cover, 'categories', c.categories,
    'published', c.published, 'adult', c.adult, 'pricing', c.pricing, 'chat', c.chat, 'createdAt', (extract(epoch from c.created_at) * 1000)::bigint, 'hidden', c.hidden,
    'rulesAccepted', case when c.rules_version is null then null else jsonb_build_object('version', c.rules_version, 'at', (extract(epoch from coalesce(c.rules_at, c.created_at)) * 1000)::bigint) end,
    'counts', jsonb_build_object('followers', (select count(*) from public.club_members m where m.club_id = c.id and m.tier = 'follower'),
      'free', (select count(*) from public.club_members m where m.club_id = c.id and m.tier in ('free', 'premium')),
      'premium', (select count(*) from public.club_members m where m.club_id = c.id and m.tier = 'premium' and (m.ends_at is null or m.ends_at > now()))),
    'rating', (select jsonb_build_object('n', count(*), 'avg', round(avg(stars)::numeric, 2)) from public.club_ratings r where r.club_id = c.id))
  from public.club_clubs c where c.id = p_club
$$;
revoke all on function public._club_card(text) from public, anon, authenticated;

create or replace function public.club_get(p_club text) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); t text; out jsonb; courses jsonb := '[]'::jsonb; posts jsonb := '[]'::jsonb; mine jsonb;
begin
  perform public._require_social();
  if not public._club_meta_ok(p_club, uid) then raise exception 'non_trovato' using errcode = 'P0001'; end if;
  t := public._club_tier(p_club, uid);
  out := public._club_card(p_club);
  if t in ('free', 'premium', 'owner') then
    select coalesce(jsonb_agg(
      (cr.data || jsonb_build_object('id', cr.id, 'published', cr.published, 'lessons', coalesce((
        select jsonb_agg(case
            when t in ('owner', 'premium') or l.tier = 'free' then (l.data || jsonb_build_object('id', l.id, 'tier', l.tier, 'preview', l.preview, 'mediaPath', l.media_path))
            else jsonb_build_object('id', l.id, 'title', l.data ->> 'title', 'kind', l.data ->> 'kind', 'sectionId', l.data ->> 'sectionId', 'order', (l.data ->> 'order')::numeric, 'tier', 'premium', 'preview', false, 'locked', true) end
          order by l.position) from public.club_lessons l where l.course_id = cr.id and (t = 'owner' or not l.hidden)), '[]'::jsonb)))
      order by cr.position), '[]'::jsonb)
    into courses from public.club_courses cr where cr.club_id = p_club and (t = 'owner' or cr.published);
    select coalesce(jsonb_agg(px.data order by px.id), '[]'::jsonb) into posts from public.club_posts px
      where px.club_id = p_club and (t = 'owner' or not px.hidden) and (t in ('owner', 'premium') or px.tier = 'free');
  end if;
  select to_jsonb(m) - 'club_id' - 'user_id' into mine from public.club_members m where m.club_id = p_club and m.user_id = uid;
  return out || jsonb_build_object('courses', courses, 'posts', posts, 'access', t, 'membership', mine);
end $$;

create or replace function public.club_discover(p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  perform public._require_social();
  return coalesce((select jsonb_agg(public._club_card(c.id) order by c.created_at desc) from (
    select id, created_at from public.club_clubs where published and not hidden and not adult and owner_id <> uid and public._social_ok(owner_id)
      and not exists (select 1 from public.club_members m where m.club_id = club_clubs.id and m.user_id = uid)
    order by created_at desc limit least(greatest(p_limit, 1), 100)) c), '[]'::jsonb);
end $$;

-- I miei club (creati e a cui sono iscritto), con il mio livello.
create or replace function public.club_mine() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  perform public._require_social();
  return jsonb_build_object(
    'owned', coalesce((select jsonb_agg(id) from public.club_clubs where owner_id = uid), '[]'::jsonb),
    'member', coalesce((select jsonb_agg(jsonb_build_object('club', m.club_id, 'tier', m.tier, 'status', m.status, 'since', (extract(epoch from m.since) * 1000)::bigint, 'endsAt', case when m.ends_at is null then null else (extract(epoch from m.ends_at) * 1000)::bigint end, 'muted', m.muted_by_owner))
      from public.club_members m join public.club_clubs c on c.id = m.club_id where m.user_id = uid and not c.hidden and public._social_ok(c.owner_id)), '[]'::jsonb));
end $$;

-- ---------- iscrizioni ----------
create or replace function public.club_join(p_club text, p_tier text default 'free') returns text
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); t text;
begin
  perform public._require_social();
  if not public._club_meta_ok(p_club, uid) then raise exception 'non_trovato' using errcode = 'P0001'; end if;
  if p_tier not in ('follower', 'free') then raise exception 'livello_non_valido' using errcode = 'P0001'; end if;
  if exists (select 1 from public.club_clubs where id = p_club and owner_id = uid) then raise exception 'sei_il_creatore' using errcode = 'P0001'; end if;
  insert into public.club_members (club_id, user_id, tier, status, ever_joined) values (p_club, uid, p_tier, 'attiva', p_tier = 'free')
  on conflict (club_id, user_id) do update set tier = case when public.club_members.tier = 'premium' then 'premium' when excluded.tier = 'free' then 'free' else public.club_members.tier end,
    ever_joined = public.club_members.ever_joined or excluded.ever_joined;
  return public._club_tier(p_club, uid);
end $$;
create or replace function public.club_leave(p_club text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  delete from public.club_members where club_id = p_club and user_id = auth.uid();
end $$;
-- Il creatore assegna (o toglie) il Premium a una persona: regalo o prova. Non è un pagamento.
create or replace function public.club_grant(p_club text, p_user uuid, p_days integer default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  perform public._require_social();
  if not exists (select 1 from public.club_clubs where id = p_club and owner_id = uid) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  if not public._social_ok(p_user) then raise exception 'persona_non_ammessa' using errcode = 'P0001'; end if;
  insert into public.club_members (club_id, user_id, tier, status, ends_at, granted, ever_joined) values (p_club, p_user, 'premium', 'attiva', case when p_days is null then null else now() + make_interval(days => least(greatest(p_days, 1), 3650)) end, true, true)
  on conflict (club_id, user_id) do update set tier = 'premium', status = 'attiva', ends_at = excluded.ends_at, granted = true, ever_joined = true;
end $$;
create or replace function public.club_member_set(p_club text, p_user uuid, p_muted boolean default null, p_remove boolean default false) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._require_social();
  if not exists (select 1 from public.club_clubs where id = p_club and owner_id = auth.uid()) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  if p_remove then delete from public.club_members where club_id = p_club and user_id = p_user;
  elsif p_muted is not null then update public.club_members set muted_by_owner = p_muted where club_id = p_club and user_id = p_user; end if;
end $$;
create or replace function public.club_members_list(p_club text) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public._require_social();
  if not exists (select 1 from public.club_clubs where id = p_club and owner_id = auth.uid()) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('userId', m.user_id, 'name', coalesce(sp.display_name, 'Iscritto'), 'tier', m.tier, 'status', m.status, 'since', (extract(epoch from m.since) * 1000)::bigint, 'muted', m.muted_by_owner, 'granted', m.granted) order by m.since desc)
    from public.club_members m left join public.social_profiles sp on sp.user_id = m.user_id where m.club_id = p_club), '[]'::jsonb);
end $$;

-- ---------- domande e commenti sotto le lezioni (solo iscritti) ----------
create or replace function public.club_comment_add(p_club text, p_lesson text, p_id text, p_data jsonb) returns text
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); t text; lt text; nm text;
begin
  perform public._require_social();
  t := public._club_tier(p_club, uid);
  if t not in ('free', 'premium', 'owner') then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  if exists (select 1 from public.club_members where club_id = p_club and user_id = uid and muted_by_owner) then raise exception 'silenziato' using errcode = 'P0001'; end if;
  select tier into lt from public.club_lessons where id = p_lesson and club_id = p_club;
  if lt is null then raise exception 'non_trovato' using errcode = 'P0001'; end if;
  if lt = 'premium' and t = 'free' then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  if char_length(btrim(coalesce(p_data ->> 'text', ''))) < 1 or char_length(p_data ->> 'text') > 2000 then raise exception 'testo_non_valido' using errcode = 'P0001'; end if;
  if (select count(*) from public.club_comments where author_id = uid and created_at > now() - interval '1 hour') >= 60 then raise exception 'troppi_commenti' using errcode = 'P0001'; end if;
  select display_name into nm from public.social_profiles where user_id = uid;
  insert into public.club_comments (id, club_id, lesson_id, author_id, author_name, data) values (p_id, p_club, p_lesson, uid, coalesce(nm, ''), p_data - 'author') on conflict (id) do nothing;
  return p_id;
end $$;
create or replace function public.club_comments_list(p_club text, p_lesson text) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); t text; lt text;
begin
  perform public._require_social();
  t := public._club_tier(p_club, uid);
  select tier into lt from public.club_lessons where id = p_lesson and club_id = p_club;
  if t not in ('free', 'premium', 'owner') or lt is null or (lt = 'premium' and t = 'free') then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(c.data || jsonb_build_object('id', c.id, 'author', c.author_name, 'authorId', c.author_id, 'lessonId', c.lesson_id, 'clubId', c.club_id, 'ts', (extract(epoch from c.created_at) * 1000)::bigint) order by c.created_at)
    from public.club_comments c where c.club_id = p_club and c.lesson_id = p_lesson and not c.hidden), '[]'::jsonb);
end $$;
create or replace function public.club_comment_delete(p_id text) returns void
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  update public.club_comments c set hidden = true where c.id = p_id and (c.author_id = uid or exists (select 1 from public.club_clubs k where k.id = c.club_id and k.owner_id = uid));
end $$;
-- Il voto al club: chi si è iscritto almeno una volta.
create or replace function public.club_rate(p_club text, p_stars integer, p_note text default '') returns void
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  perform public._require_social();
  if p_stars < 1 or p_stars > 5 then raise exception 'voto_non_valido' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.club_members where club_id = p_club and user_id = uid and ever_joined) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  insert into public.club_ratings (club_id, user_id, stars, note) values (p_club, uid, p_stars, left(coalesce(p_note, ''), 500))
  on conflict (club_id, user_id) do update set stars = excluded.stars, note = excluded.note, created_at = now();
end $$;
create or replace function public.club_delete(p_club text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._require_social();
  delete from public.club_clubs where id = p_club and owner_id = auth.uid();
end $$;

-- ---------- moderazione: il club e i suoi contenuti si possono sospendere ----------
create or replace function public._content_author(p_kind text, p_ref text) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare u uuid; rid uuid;
begin
  if p_kind = 'club' then select owner_id into u from public.club_clubs where id = p_ref; return u; end if;
  if p_kind = 'clubitem' then select owner_id into u from public.club_clubs where id = split_part(p_ref, ':', 1); return u; end if;
  begin rid := p_ref::uuid; exception when others then return null; end;
  if p_kind in ('post', 'comment') then select author_id into u from public.social_posts where id = rid;
  elsif p_kind in ('seminar', 'service', 'idea') then select author_id into u from public.social_listings where id = rid; end if;
  return u;
end $$;
revoke all on function public._content_author(text, text) from public, anon, authenticated;
create or replace function public._remove_content(p_kind text, p_ref text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare u uuid; rid uuid;
begin
  if p_kind = 'club' then update public.club_clubs set hidden = true, updated_at = now() where id = p_ref returning owner_id into u; return u; end if;
  if p_kind = 'clubitem' then
    update public.club_lessons set hidden = true where id = split_part(p_ref, ':', 2) and club_id = split_part(p_ref, ':', 1);
    update public.club_posts set hidden = true where id = split_part(p_ref, ':', 2) and club_id = split_part(p_ref, ':', 1);
    update public.club_comments set hidden = true where id = split_part(p_ref, ':', 2) and club_id = split_part(p_ref, ':', 1);
    select owner_id into u from public.club_clubs where id = split_part(p_ref, ':', 1); return u;
  end if;
  begin rid := p_ref::uuid; exception when others then return null; end;
  if p_kind in ('post', 'comment') then update public.social_posts set deleted_at = coalesce(deleted_at, now()) where id = rid returning author_id into u;
  elsif p_kind in ('seminar', 'service', 'idea') then update public.social_listings set deleted_at = coalesce(deleted_at, now()) where id = rid returning author_id into u; end if;
  return u;
end $$;
revoke all on function public._remove_content(text, text) from public, anon, authenticated;

revoke all on function public.club_save(jsonb), public.club_get(text), public.club_discover(integer), public.club_mine(), public.club_join(text, text), public.club_leave(text), public.club_grant(text, uuid, integer),
  public.club_member_set(text, uuid, boolean, boolean), public.club_members_list(text), public.club_comment_add(text, text, text, jsonb), public.club_comments_list(text, text), public.club_comment_delete(text),
  public.club_rate(text, integer, text), public.club_delete(text) from public, anon;
grant execute on function public.club_save(jsonb), public.club_get(text), public.club_discover(integer), public.club_mine(), public.club_join(text, text), public.club_leave(text), public.club_grant(text, uuid, integer),
  public.club_member_set(text, uuid, boolean, boolean), public.club_members_list(text), public.club_comment_add(text, text, text, jsonb), public.club_comments_list(text, text), public.club_comment_delete(text),
  public.club_rate(text, integer, text), public.club_delete(text) to authenticated;

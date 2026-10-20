-- =====================================================================================================
-- LifePilot - migrazione 0004: LAYER SOCIALE PUBBLICO (stessi contenuti su iPhone e Android) e comandi condivisi di Theia.
--
-- ATTENZIONE: questo e' il solo punto in cui il server conserva contenuti CHE L'UTENTE HA SCELTO DI PUBBLICARE
-- (post, commenti, mi piace, chi segui). Sono pubblici per definizione, come su Instagram. Le tabelle private
-- (profiles, sync_changes, ...) non cambiano e restano senza lettura pubblica. Salute, finanze, chat, documenti: MAI qui.
-- Idempotente: si puo' rieseguire. Si applica dall'editor SQL di Supabase (vedi docs/server-social.md).
-- =====================================================================================================

-- ---- profilo pubblico (diverso da public.profiles, che e' privato) -------------------------------------
create table if not exists public.social_profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url   text check (avatar_url is null or char_length(avatar_url) <= 500),
  bio          text check (bio is null or char_length(bio) <= 300),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---- post -----------------------------------------------------------------------------------------------
create table if not exists public.social_posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references auth.users (id) on delete cascade,
  author_name   text not null check (char_length(author_name) between 1 and 60),
  body          text not null default '' check (char_length(body) <= 4000),
  media         text check (media in ('photo', 'video')),
  media_url     text check (media_url is null or char_length(media_url) <= 600),
  media_urls    text[] not null default '{}' check (cardinality(media_urls) <= 10),
  poster_url    text check (poster_url is null or char_length(poster_url) <= 600),
  tag           text check (tag is null or char_length(tag) <= 40),
  fx            jsonb,                          -- filtri e ritocchi dell'editor
  caption_mode  text check (caption_mode in ('photo', 'below')),
  comments_off  boolean not null default false,
  hide_likes    boolean not null default false,
  likes_count   int not null default 0 check (likes_count >= 0),
  comments_count int not null default 0 check (comments_count >= 0),
  created_at    timestamptz not null default now(),
  edited_at     timestamptz,
  deleted_at    timestamptz
);
create index if not exists social_posts_feed on public.social_posts (created_at desc) where deleted_at is null;
create index if not exists social_posts_author on public.social_posts (author_id, created_at desc) where deleted_at is null;

create table if not exists public.social_likes (
  post_id    uuid not null references public.social_posts (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.social_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.social_posts (id) on delete cascade,
  author_id   uuid not null references auth.users (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 60),
  body        text not null check (char_length(body) between 1 and 1000),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists social_comments_post on public.social_comments (post_id, created_at) where deleted_at is null;
create table if not exists public.social_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followed_id uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);
create table if not exists public.social_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  post_id     uuid references public.social_posts (id) on delete cascade,
  reason      text not null check (char_length(reason) between 1 and 300),
  created_at  timestamptz not null default now(),
  unique (reporter_id, post_id)
);

-- ---- contatori (mi piace e commenti) tenuti dal server, non dal telefono --------------------------------
create or replace function public.social_count_likes() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then update public.social_posts set likes_count = likes_count + 1 where id = new.post_id;
  else update public.social_posts set likes_count = greatest(0, likes_count - 1) where id = old.post_id; end if;
  return null;
end $$;
drop trigger if exists social_likes_count on public.social_likes;
create trigger social_likes_count after insert or delete on public.social_likes for each row execute function public.social_count_likes();

create or replace function public.social_count_comments() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then update public.social_posts set comments_count = comments_count + 1 where id = new.post_id;
  elsif tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then update public.social_posts set comments_count = greatest(0, comments_count - 1) where id = new.post_id; end if;
  return null;
end $$;
drop trigger if exists social_comments_count on public.social_comments;
create trigger social_comments_count after insert or update on public.social_comments for each row execute function public.social_count_comments();

-- il nome dell'autore lo mette il server dal profilo pubblico: nessuno puo' pubblicare a nome di un altro
create or replace function public.social_set_author() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select display_name into new.author_name from public.social_profiles where user_id = new.author_id;
  if new.author_name is null then raise exception 'profilo_pubblico_mancante' using errcode = 'P0001'; end if;
  return new;
end $$;
drop trigger if exists social_posts_author on public.social_posts;
create trigger social_posts_author before insert on public.social_posts for each row execute function public.social_set_author();
drop trigger if exists social_comments_author on public.social_comments;
create trigger social_comments_author before insert on public.social_comments for each row execute function public.social_set_author();

-- ---- sicurezza: tutti gli utenti connessi leggono, ognuno scrive solo il suo -----------------------------
alter table public.social_profiles enable row level security;
alter table public.social_posts    enable row level security;
alter table public.social_likes    enable row level security;
alter table public.social_comments enable row level security;
alter table public.social_follows  enable row level security;
alter table public.social_reports  enable row level security;

drop policy if exists sp_read on public.social_profiles;  create policy sp_read on public.social_profiles for select to authenticated using (true);
drop policy if exists sp_write on public.social_profiles; create policy sp_write on public.social_profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists po_read on public.social_posts;     create policy po_read on public.social_posts for select to authenticated using (deleted_at is null);
drop policy if exists po_ins on public.social_posts;      create policy po_ins on public.social_posts for insert to authenticated with check (author_id = auth.uid());
drop policy if exists po_upd on public.social_posts;      create policy po_upd on public.social_posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists po_del on public.social_posts;      create policy po_del on public.social_posts for delete to authenticated using (author_id = auth.uid());
drop policy if exists li_read on public.social_likes;     create policy li_read on public.social_likes for select to authenticated using (true);
drop policy if exists li_ins on public.social_likes;      create policy li_ins on public.social_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists li_del on public.social_likes;      create policy li_del on public.social_likes for delete to authenticated using (user_id = auth.uid());
drop policy if exists co_read on public.social_comments;  create policy co_read on public.social_comments for select to authenticated using (deleted_at is null);
drop policy if exists co_ins on public.social_comments;   create policy co_ins on public.social_comments for insert to authenticated with check (author_id = auth.uid());
drop policy if exists co_upd on public.social_comments;   create policy co_upd on public.social_comments for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists fo_read on public.social_follows;   create policy fo_read on public.social_follows for select to authenticated using (true);
drop policy if exists fo_ins on public.social_follows;    create policy fo_ins on public.social_follows for insert to authenticated with check (follower_id = auth.uid());
drop policy if exists fo_del on public.social_follows;    create policy fo_del on public.social_follows for delete to authenticated using (follower_id = auth.uid());
drop policy if exists re_ins on public.social_reports;    create policy re_ins on public.social_reports for insert to authenticated with check (reporter_id = auth.uid());

-- ---- foto e video dei post: lettura per tutti, scrittura solo nella propria cartella ----------------------
insert into storage.buckets (id, name, public, file_size_limit) values ('social-media', 'social-media', true, 52428800) on conflict (id) do nothing;
drop policy if exists sm_read on storage.objects;  create policy sm_read on storage.objects for select using (bucket_id = 'social-media');
drop policy if exists sm_ins on storage.objects;   create policy sm_ins on storage.objects for insert to authenticated with check (bucket_id = 'social-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists sm_del on storage.objects;   create policy sm_del on storage.objects for delete to authenticated using (bucket_id = 'social-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---- comandi di Theia condivisi (solo se l'utente sceglie di condividerli) ---------------------------------
create table if not exists public.shared_commands (
  id         uuid primary key default gen_random_uuid(),
  pattern    text not null check (char_length(pattern) between 3 and 120 and pattern !~ '@' and pattern !~ 'https?:'),
  kind       text not null check (kind in ('page', 'cmd')),
  target     text not null check (char_length(target) between 1 and 200),
  created_by uuid not null references auth.users (id) on delete cascade,
  score      int not null default 0,           -- voti favorevoli meno contrari
  created_at timestamptz not null default now(),
  unique (pattern, kind, target)
);
create table if not exists public.shared_command_votes (
  command_id uuid not null references public.shared_commands (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  vote       smallint not null check (vote in (-1, 1)),
  primary key (command_id, user_id)
);
alter table public.shared_commands enable row level security;
alter table public.shared_command_votes enable row level security;
drop policy if exists sc_read on public.shared_commands;  create policy sc_read on public.shared_commands for select to authenticated using (true);
drop policy if exists sc_ins on public.shared_commands;   create policy sc_ins on public.shared_commands for insert to authenticated with check (created_by = auth.uid());
drop policy if exists sv_read on public.shared_command_votes; create policy sv_read on public.shared_command_votes for select to authenticated using (user_id = auth.uid());
drop policy if exists sv_write on public.shared_command_votes; create policy sv_write on public.shared_command_votes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.shared_command_score() returns trigger language plpgsql security definer set search_path = '' as $$
declare cid uuid := coalesce(new.command_id, old.command_id);
begin
  update public.shared_commands c set score = coalesce((select sum(vote) from public.shared_command_votes v where v.command_id = cid), 0) where c.id = cid;
  return null;
end $$;
drop trigger if exists shared_command_votes_score on public.shared_command_votes;
create trigger shared_command_votes_score after insert or update or delete on public.shared_command_votes for each row execute function public.shared_command_score();
-- chi propone un comando lo vota a favore (e un solo voto per persona)
create or replace function public.shared_command_self_vote() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.shared_command_votes (command_id, user_id, vote) values (new.id, new.created_by, 1) on conflict do nothing; return null; end $$;
drop trigger if exists shared_commands_self_vote on public.shared_commands;
create trigger shared_commands_self_vote after insert on public.shared_commands for each row execute function public.shared_command_self_vote();

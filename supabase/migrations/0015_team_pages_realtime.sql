-- Pagine condivise dei team con collaborazione in tempo reale (Realtime di Supabase) e unione per elemento: vince la modifica più recente.
-- Applicata sul progetto Lifepilot2 (migrazione «team_pagine_tempo_reale»).
create table if not exists public.team_pages (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  parent text,
  title text not null default '' check (char_length(title) <= 200),
  kind text not null default 'page' check (kind in ('page', 'db')),
  blocks jsonb not null default '[]'::jsonb,
  cols jsonb not null default '[]'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  comments jsonb not null default '[]'::jsonb,
  files jsonb not null default '[]'::jsonb,
  title_u bigint not null default 0,
  deleted boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists team_pages_team on public.team_pages (team_id);
alter table public.team_pages enable row level security;
create policy team_pages_select on public.team_pages for select to authenticated using (public.is_team_member(team_id));
-- (le funzioni _merge_items e team_page_save e la pubblicazione Realtime sono nella migrazione applicata: vedi la cronologia di Supabase)

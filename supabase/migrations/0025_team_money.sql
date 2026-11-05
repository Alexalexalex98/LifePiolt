-- Workspace Lavoro, punto 9: amministrazione e soldi. Note spese con foto dello scontrino, prima nota (entrate e uscite, cassa), budget, abbonamenti.
-- Le vede chi ha il permesso «fatture, pagamenti e spese» (amministrazione, direzione); ognuno vede e invia le proprie note spese. Solo oggetti nuovi.
create table if not exists public.team_expenses (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  category text not null check (char_length(btrim(category)) between 1 and 60),
  description text not null default '' check (char_length(description) <= 300),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'CHF' check (currency in ('CHF', 'EUR')),
  project text,
  receipt_path text,                                  -- file in «team-receipts»
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected', 'paid')),
  decided_by uuid references auth.users (id) on delete set null,
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists team_expenses_team on public.team_expenses (team_id, status, day desc);
create table if not exists public.team_entries (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('in', 'out')),
  category text not null check (char_length(btrim(category)) between 1 and 60),
  description text not null default '' check (char_length(description) <= 300),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'CHF' check (currency in ('CHF', 'EUR')),
  project text,
  doc_id text,                                        -- il documento collegato (fattura, bolletta)
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists team_entries_team on public.team_entries (team_id, day desc);
create table if not exists public.team_budgets (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  project text,
  category text not null check (char_length(btrim(category)) between 1 and 60),
  period text not null check (period ~ '^\d{4}(-\d{2})?$'),   -- «2026» o «2026-11»
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'CHF' check (currency in ('CHF', 'EUR'))
);
create table if not exists public.team_subscriptions (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  vendor text not null default '' check (char_length(vendor) <= 120),
  category text not null default 'Abbonamenti' check (char_length(category) <= 60),
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'CHF' check (currency in ('CHF', 'EUR')),
  cycle text not null default 'month' check (cycle in ('month', 'quarter', 'year')),
  next_date date,
  active boolean not null default true,
  created_by uuid not null references auth.users (id) on delete cascade
);
alter table public.team_expenses enable row level security;
alter table public.team_entries enable row level security;
alter table public.team_budgets enable row level security;
alter table public.team_subscriptions enable row level security;

-- note spese: le vede chi le ha scritte e l'amministrazione; le invia ognuno per sé; le decide solo l'amministrazione (funzione sotto)
create policy exp_select on public.team_expenses for select to authenticated using (public.is_team_member(team_id) and (user_id = auth.uid() or public.has_cap(team_id, 'fin.docs')));
create policy exp_insert on public.team_expenses for insert to authenticated with check (user_id = auth.uid() and public.is_team_member(team_id) and status = 'submitted');
create policy exp_delete on public.team_expenses for delete to authenticated using ((user_id = auth.uid() and status = 'submitted') or public.has_cap(team_id, 'fin.docs'));
create or replace function public.team_expense_decide(p_id text, p_status text, p_note text default '') returns void
language plpgsql security definer set search_path = ''
as $$
declare e public.team_expenses;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if p_status not in ('approved', 'rejected', 'paid') then raise exception 'stato_non_valido' using errcode = 'P0001'; end if;
  select * into e from public.team_expenses where id = p_id;
  if not found or not public.has_cap(e.team_id, 'fin.docs') then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  if e.user_id = auth.uid() and not public.is_team_member(e.team_id, 'admin') then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  update public.team_expenses set status = p_status, decided_by = auth.uid(), note = left(p_note, 300) where id = p_id;
end $$;
revoke all on function public.team_expense_decide(text, text, text) from public, anon;
grant execute on function public.team_expense_decide(text, text, text) to authenticated;

create policy entries_all on public.team_entries for all to authenticated using (public.is_team_member(team_id) and public.has_cap(team_id, 'fin.docs')) with check (created_by = auth.uid() and public.is_team_member(team_id) and public.has_cap(team_id, 'fin.docs'));
create policy budgets_select on public.team_budgets for select to authenticated using (public.is_team_member(team_id) and (public.has_cap(team_id, 'fin.docs') or public.has_cap(team_id, 'reports.view')));
create policy budgets_write on public.team_budgets for all to authenticated using (public.is_team_member(team_id) and public.has_cap(team_id, 'fin.docs')) with check (public.is_team_member(team_id) and public.has_cap(team_id, 'fin.docs'));
create policy subs_all on public.team_subscriptions for all to authenticated using (public.is_team_member(team_id) and public.has_cap(team_id, 'fin.docs')) with check (created_by = auth.uid() and public.is_team_member(team_id) and public.has_cap(team_id, 'fin.docs'));

-- Scontrini: «<team>/<persona>/file». Li vede chi li ha caricati e l'amministrazione; li carica ognuno nella propria cartella.
insert into storage.buckets (id, name, public, file_size_limit) values ('team-receipts', 'team-receipts', false, 10485760) on conflict (id) do nothing;
create policy receipts_select on storage.objects for select to authenticated using (bucket_id = 'team-receipts' and public.is_team_member(((storage.foldername(name))[1])::uuid) and ((storage.foldername(name))[2] = auth.uid()::text or public.has_cap(((storage.foldername(name))[1])::uuid, 'fin.docs')));
create policy receipts_insert on storage.objects for insert to authenticated with check (bucket_id = 'team-receipts' and public.is_team_member(((storage.foldername(name))[1])::uuid) and (storage.foldername(name))[2] = auth.uid()::text);
create policy receipts_delete on storage.objects for delete to authenticated using (bucket_id = 'team-receipts' and (owner = auth.uid() or public.has_cap(((storage.foldername(name))[1])::uuid, 'fin.docs')));

alter publication supabase_realtime add table public.team_expenses;

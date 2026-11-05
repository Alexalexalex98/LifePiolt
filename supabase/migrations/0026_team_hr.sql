-- Workspace Lavoro, punto 10: persone e HR. Scheda di ogni persona (contratto, ferie), candidati con valutazione e colloqui, obiettivi e valutazioni, formazione e certificati.
-- Li gestisce chi ha il permesso HR (hr.docs: HR, direzione, amministrazione); ogni persona vede la propria scheda, le proprie valutazioni condivise e la propria formazione. Solo oggetti nuovi.
create table if not exists public.team_hr_profiles (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  hired_on date,
  contract text not null default 'indeterminato' check (contract in ('indeterminato', 'determinato', 'apprendistato', 'stage', 'collaborazione')),
  contract_end date,
  weekly_hours numeric(4, 1) check (weekly_hours between 1 and 60),
  vacation_days integer check (vacation_days between 0 and 60),
  phone text not null default '' check (char_length(phone) <= 60),
  emergency text not null default '' check (char_length(emergency) <= 200),
  hr_notes text not null default '' check (char_length(hr_notes) <= 4000),   -- riservate a HR: la persona non le legge (vedi vista team_my_hr)
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create table if not exists public.team_candidates (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  email text not null default '' check (char_length(email) <= 200),
  phone text not null default '' check (char_length(phone) <= 60),
  role text not null default '' check (char_length(role) <= 120),
  source text not null default '' check (char_length(source) <= 120),
  stage text not null default 'new' check (stage in ('new', 'screening', 'interview', 'offer', 'hired', 'rejected')),
  scores jsonb not null default '{}'::jsonb,         -- {competenze: 4, esperienza: 3, ...}
  notes text not null default '' check (char_length(notes) <= 4000),
  cv_doc text,                                        -- il curriculum in Documenti
  interview_at timestamptz,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists team_candidates_team on public.team_candidates (team_id, stage);
create table if not exists public.team_reviews (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  person uuid not null references auth.users (id) on delete cascade,
  period text not null check (char_length(period) between 3 and 30),
  goals jsonb not null default '[]'::jsonb,           -- [{t: "Chiudere 10 vendite", done: false}]
  rating integer check (rating between 1 and 5),
  feedback text not null default '' check (char_length(feedback) <= 4000),
  status text not null default 'draft' check (status in ('draft', 'shared')),
  by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.team_training (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  person uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  kind text not null default 'corso' check (kind in ('corso', 'certificato', 'obbligatoria')),
  done_on date,
  expires_on date,
  created_by uuid not null references auth.users (id) on delete cascade
);
alter table public.team_hr_profiles enable row level security;
alter table public.team_candidates enable row level security;
alter table public.team_reviews enable row level security;
alter table public.team_training enable row level security;

-- chi è il responsabile diretto di una persona (campo «risponde a» delle posizioni)
create or replace function public.is_manager_of(t uuid, p uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.team_members m where m.team_id = t and m.user_id = p and m.reports_to = auth.uid()) $$;
revoke all on function public.is_manager_of(uuid, uuid) from public, anon;
grant execute on function public.is_manager_of(uuid, uuid) to authenticated;

-- scheda HR: HR scrive e legge tutto; la persona legge la propria tramite la funzione team_my_hr (senza note riservate)
create policy hrp_select on public.team_hr_profiles for select to authenticated using (public.is_team_member(team_id) and public.has_cap(team_id, 'hr.docs'));
create policy hrp_insert on public.team_hr_profiles for insert to authenticated with check (public.has_cap(team_id, 'hr.docs') and updated_by = auth.uid());
create policy hrp_update on public.team_hr_profiles for update to authenticated using (public.has_cap(team_id, 'hr.docs')) with check (public.has_cap(team_id, 'hr.docs') and updated_by = auth.uid());
create or replace function public.team_my_hr(p_team uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_team_member(p_team) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  return (select to_jsonb(x) from (select hired_on, contract, contract_end, weekly_hours, vacation_days, phone, emergency from public.team_hr_profiles where team_id = p_team and user_id = auth.uid()) x);
end $$;
revoke all on function public.team_my_hr(uuid) from public, anon;
grant execute on function public.team_my_hr(uuid) to authenticated;

create policy cand_all on public.team_candidates for all to authenticated using (public.is_team_member(team_id) and public.has_cap(team_id, 'hr.docs')) with check (created_by = auth.uid() and public.is_team_member(team_id) and public.has_cap(team_id, 'hr.docs'));

-- valutazioni: le scrive HR o il responsabile diretto; le legge chi le ha scritte, HR e la persona solo quando sono condivise
create policy rev_select on public.team_reviews for select to authenticated using (public.is_team_member(team_id) and (public.has_cap(team_id, 'hr.docs') or by = auth.uid() or (person = auth.uid() and status = 'shared')));
create policy rev_insert on public.team_reviews for insert to authenticated with check (by = auth.uid() and public.is_team_member(team_id) and (public.has_cap(team_id, 'hr.docs') or public.is_manager_of(team_id, person)));
create policy rev_update on public.team_reviews for update to authenticated using (public.has_cap(team_id, 'hr.docs') or by = auth.uid() or (person = auth.uid() and status = 'shared')) with check (public.is_team_member(team_id));
revoke update on public.team_reviews from authenticated;
grant update (goals, rating, feedback, status) on public.team_reviews to authenticated;
create policy rev_delete on public.team_reviews for delete to authenticated using (by = auth.uid() or public.has_cap(team_id, 'hr.docs'));

-- formazione: la vedono la persona, HR e il responsabile; la scrive HR o il responsabile
create policy trn_select on public.team_training for select to authenticated using (public.is_team_member(team_id) and (person = auth.uid() or public.has_cap(team_id, 'hr.docs') or public.is_manager_of(team_id, person)));
create policy trn_insert on public.team_training for insert to authenticated with check (created_by = auth.uid() and public.is_team_member(team_id) and (public.has_cap(team_id, 'hr.docs') or public.is_manager_of(team_id, person) or person = auth.uid()));
create policy trn_update on public.team_training for update to authenticated using (public.has_cap(team_id, 'hr.docs') or public.is_manager_of(team_id, person) or person = auth.uid()) with check (public.is_team_member(team_id));
create policy trn_delete on public.team_training for delete to authenticated using (created_by = auth.uid() or public.has_cap(team_id, 'hr.docs'));

create or replace function public._hr_check() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare pe uuid;
begin
  if tg_table_name = 'team_hr_profiles' then pe := new.user_id; else pe := new.person; end if;
  if not exists (select 1 from public.team_members m where m.team_id = new.team_id and m.user_id = pe) then raise exception 'persona_non_nel_team' using errcode = 'P0001'; end if;
  return new;
end $$;
create trigger team_hrp_check before insert or update on public.team_hr_profiles for each row execute function public._hr_check();
create trigger team_rev_check before insert or update on public.team_reviews for each row execute function public._hr_check();
create trigger team_trn_check before insert or update on public.team_training for each row execute function public._hr_check();
revoke all on function public._hr_check() from public, anon, authenticated;

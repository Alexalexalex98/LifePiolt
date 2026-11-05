-- Workspace Lavoro, punto 5: task, progetti, scadenze. Task condivisi con responsabile, priorità, sottotask, ripetizioni, dipendenze, ore registrate.
-- Solo oggetti nuovi. Ogni permesso lo controlla il server.
create table if not exists public.team_projects (
  id text primary key,                                   -- è l'id della pagina del progetto
  team_id uuid not null references public.teams (id) on delete cascade,
  goal text not null default '' check (char_length(goal) <= 1000),
  due date,
  status text not null default 'active' check (status in ('active', 'paused', 'done')),
  created_by uuid not null references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now()
);
create table if not exists public.team_tasks (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  project text,                                          -- id del progetto (pagina)
  title text not null check (char_length(btrim(title)) between 1 and 300),
  notes text not null default '' check (char_length(notes) <= 4000),
  assignee uuid references auth.users (id) on delete set null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'todo' check (status in ('todo', 'doing', 'blocked', 'done')),
  due date,
  est_min integer check (est_min between 5 and 5760),
  parent text,                                           -- sottotask: id del task padre
  depends_on text[] not null default '{}',               -- parte solo quando questi sono finiti
  recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekly', 'monthly')),
  block_reason text not null default '' check (char_length(block_reason) <= 300),
  created_by uuid not null references auth.users (id) on delete cascade,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists team_tasks_team on public.team_tasks (team_id, project);
create index if not exists team_tasks_assignee on public.team_tasks (assignee) where not deleted;
create table if not exists public.team_time (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  task text not null references public.team_tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  minutes integer not null check (minutes between 1 and 1440),
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists team_time_task on public.team_time (task);

alter table public.team_projects enable row level security;
alter table public.team_tasks enable row level security;
alter table public.team_time enable row level security;

create policy proj_select on public.team_projects for select to authenticated using (public.is_team_member(team_id));
create policy proj_insert on public.team_projects for insert to authenticated with check (created_by = auth.uid() and public.is_team_member(team_id));
create policy proj_update on public.team_projects for update to authenticated using (created_by = auth.uid() or public.is_team_member(team_id, 'admin')) with check (public.is_team_member(team_id));
revoke update on public.team_projects from authenticated;
grant update (goal, due, status) on public.team_projects to authenticated;

create policy tasks_select on public.team_tasks for select to authenticated using (public.is_team_member(team_id) and not deleted);
create policy tasks_insert on public.team_tasks for insert to authenticated with check (created_by = auth.uid() and public.is_team_member(team_id));
-- li modificano chi li ha creati, chi ha il task assegnato e gli amministratori
create policy tasks_update on public.team_tasks for update to authenticated
  using (created_by = auth.uid() or assignee = auth.uid() or public.is_team_member(team_id, 'admin')) with check (public.is_team_member(team_id));
revoke update on public.team_tasks from authenticated;
grant update (title, notes, assignee, priority, status, due, est_min, parent, depends_on, recurrence, block_reason, deleted, project) on public.team_tasks to authenticated;

-- le ore le vedono chi le ha scritte e gli amministratori
create policy time_select on public.team_time for select to authenticated using (public.is_team_member(team_id) and (user_id = auth.uid() or public.is_team_member(team_id, 'admin')));
create policy time_insert on public.team_time for insert to authenticated with check (user_id = auth.uid() and public.is_team_member(team_id));
create policy time_delete on public.team_time for delete to authenticated using (user_id = auth.uid() or public.is_team_member(team_id, 'admin'));

create or replace function public._tasks_check() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.assignee is not null and not exists (select 1 from public.team_members m where m.team_id = new.team_id and m.user_id = new.assignee) then
    raise exception 'persona_non_nel_team' using errcode = 'P0001';
  end if;
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then new.done_at := now(); end if;
  if new.status <> 'done' then new.done_at := null; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger team_tasks_check before insert or update on public.team_tasks for each row execute function public._tasks_check();
revoke all on function public._tasks_check() from public, anon, authenticated;

alter publication supabase_realtime add table public.team_tasks;
alter publication supabase_realtime add table public.team_projects;

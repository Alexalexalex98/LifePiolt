-- Workspace Lavoro, punto 6: clienti, vendite e fornitori. Contatti, storia dei rapporti con richiami, trattative con fasi, assistenza, da incassare.
-- Li vede chi ha il permesso «clienti» (vendite, assistenza, direzione) o «fornitori» (acquisti, amministrazione). Solo oggetti nuovi; si aggiornano solo i permessi delle posizioni.
insert into public.team_positions (position, caps) values
  ('titolare', array['crm', 'suppliers', 'members.manage', 'hr.docs', 'fin.docs', 'legal.docs', 'absence.approve', 'tasks.assign', 'projects.create', 'announce', 'time.view', 'reports.view']::text[]),
  ('ceo', array['crm', 'suppliers', 'members.manage', 'hr.docs', 'fin.docs', 'legal.docs', 'absence.approve', 'tasks.assign', 'projects.create', 'announce', 'time.view', 'reports.view']::text[]),
  ('dg', array['crm', 'suppliers', 'members.manage', 'hr.docs', 'fin.docs', 'legal.docs', 'absence.approve', 'tasks.assign', 'projects.create', 'announce', 'time.view', 'reports.view']::text[]),
  ('coo', array['crm', 'suppliers', 'members.manage', 'absence.approve', 'tasks.assign', 'projects.create', 'announce', 'time.view', 'reports.view']::text[]),
  ('manager', array['crm', 'absence.approve', 'tasks.assign', 'projects.create', 'announce', 'time.view', 'reports.view']::text[]),
  ('team_lead', array['tasks.assign', 'projects.create', 'time.view']::text[]),
  ('pm', array['crm', 'tasks.assign', 'projects.create', 'time.view', 'reports.view']::text[]),
  ('hr_manager', array['members.manage', 'hr.docs', 'absence.approve', 'tasks.assign', 'projects.create', 'announce', 'time.view', 'reports.view']::text[]),
  ('hr_specialist', array['hr.docs', 'absence.approve']::text[]),
  ('payroll', array['hr.docs']::text[]),
  ('cfo', array['crm', 'suppliers', 'members.manage', 'fin.docs', 'hr.docs', 'legal.docs', 'absence.approve', 'tasks.assign', 'projects.create', 'announce', 'time.view', 'reports.view']::text[]),
  ('controller', array['suppliers', 'fin.docs', 'time.view', 'reports.view']::text[]),
  ('accountant', array['suppliers', 'fin.docs']::text[]),
  ('accounts', array['crm', 'suppliers', 'fin.docs']::text[]),
  ('sales_manager', array['crm', 'legal.docs', 'absence.approve', 'tasks.assign', 'projects.create', 'announce', 'time.view', 'reports.view']::text[]),
  ('account', array['crm']::text[]),
  ('sales', array['crm']::text[]),
  ('marketing_manager', array['crm', 'tasks.assign', 'projects.create', 'announce', 'time.view', 'reports.view']::text[]),
  ('marketer', array['crm', 'announce']::text[]),
  ('it_manager', array['members.manage', 'tasks.assign', 'projects.create', 'announce', 'time.view']::text[]),
  ('dev', array[]::text[]),
  ('legal', array['legal.docs', 'hr.docs', 'fin.docs', 'tasks.assign', 'projects.create', 'announce', 'reports.view']::text[]),
  ('compliance', array['legal.docs', 'reports.view']::text[]),
  ('ops_manager', array['crm', 'suppliers', 'fin.docs', 'absence.approve', 'tasks.assign', 'projects.create', 'announce', 'time.view', 'reports.view']::text[]),
  ('purchasing', array['suppliers', 'fin.docs']::text[]),
  ('customer_care', array['crm']::text[]),
  ('assistant', array['announce']::text[]),
  ('employee', array[]::text[]),
  ('intern', array[]::text[]),
  ('consultant', array[]::text[]),
  ('guest', array[]::text[])
on conflict (position) do update set caps = excluded.caps;

create table if not exists public.team_contacts (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  kind text not null check (kind in ('client', 'supplier', 'lead')),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  company text not null default '' check (char_length(company) <= 200),
  email text not null default '' check (char_length(email) <= 200),
  phone text not null default '' check (char_length(phone) <= 60),
  address text not null default '' check (char_length(address) <= 300),
  country text check (country in ('IT', 'CH')),
  vat text not null default '' check (char_length(vat) <= 40),
  notes text not null default '' check (char_length(notes) <= 4000),
  owner uuid references auth.users (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_contacts_team on public.team_contacts (team_id, kind);
create table if not exists public.team_interactions (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  contact text not null references public.team_contacts (id) on delete cascade,
  kind text not null check (kind in ('call', 'email', 'meeting', 'visit', 'note')),
  text text not null check (char_length(btrim(text)) between 1 and 4000),
  by uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  follow_up date,
  follow_done boolean not null default false
);
create index if not exists team_interactions_contact on public.team_interactions (contact, at desc);
create table if not exists public.team_deals (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  contact text not null references public.team_contacts (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  stage text not null default 'lead' check (stage in ('lead', 'contact', 'quote', 'negotiation', 'won', 'lost')),
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  currency text not null default 'CHF' check (currency in ('CHF', 'EUR')),
  expected_close date,
  renewal date,
  probability integer check (probability between 0 and 100),
  owner uuid references auth.users (id) on delete set null,
  notes text not null default '' check (char_length(notes) <= 4000),
  lost_reason text not null default '' check (char_length(lost_reason) <= 300),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_deals_team on public.team_deals (team_id, stage);
create table if not exists public.team_tickets (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  contact text references public.team_contacts (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  text text not null default '' check (char_length(text) <= 4000),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'doing', 'resolved')),
  assignee uuid references auth.users (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists team_tickets_team on public.team_tickets (team_id, status);
create table if not exists public.team_receivables (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  contact text not null references public.team_contacts (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 200),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'CHF' check (currency in ('CHF', 'EUR')),
  due date,
  paid boolean not null default false,
  paid_at timestamptz,
  created_by uuid not null references auth.users (id) on delete cascade
);
create index if not exists team_receivables_team on public.team_receivables (team_id, paid);

alter table public.team_contacts enable row level security;
alter table public.team_interactions enable row level security;
alter table public.team_deals enable row level security;
alter table public.team_tickets enable row level security;
alter table public.team_receivables enable row level security;

create or replace function public.can_contact(t uuid, c text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_team_member(t) and exists (
    select 1 from public.team_contacts k where k.id = c and k.team_id = t
      and case when k.kind = 'supplier' then public.has_cap(t, 'suppliers') else public.has_cap(t, 'crm') end
  )
$$;
create or replace function public.can_kind(t uuid, k text) returns boolean
language sql stable security definer set search_path = ''
as $$ select public.is_team_member(t) and case when k = 'supplier' then public.has_cap(t, 'suppliers') else public.has_cap(t, 'crm') end $$;
revoke all on function public.can_contact(uuid, text), public.can_kind(uuid, text) from public, anon;
grant execute on function public.can_contact(uuid, text), public.can_kind(uuid, text) to authenticated;

create policy contacts_select on public.team_contacts for select to authenticated using (public.can_kind(team_id, kind));
create policy contacts_insert on public.team_contacts for insert to authenticated with check (created_by = auth.uid() and public.can_kind(team_id, kind));
create policy contacts_update on public.team_contacts for update to authenticated using (public.can_kind(team_id, kind)) with check (public.can_kind(team_id, kind));
create policy contacts_delete on public.team_contacts for delete to authenticated using (public.can_kind(team_id, kind) and (created_by = auth.uid() or public.is_team_member(team_id, 'admin')));
revoke update on public.team_contacts from authenticated;
grant update (kind, name, company, email, phone, address, country, vat, notes, owner, status) on public.team_contacts to authenticated;

create policy inter_select on public.team_interactions for select to authenticated using (public.can_contact(team_id, contact));
create policy inter_insert on public.team_interactions for insert to authenticated with check (by = auth.uid() and public.can_contact(team_id, contact));
create policy inter_update on public.team_interactions for update to authenticated using (public.can_contact(team_id, contact)) with check (public.can_contact(team_id, contact));
create policy inter_delete on public.team_interactions for delete to authenticated using (by = auth.uid() or public.is_team_member(team_id, 'admin'));
revoke update on public.team_interactions from authenticated;
grant update (follow_up, follow_done) on public.team_interactions to authenticated;

create policy deals_select on public.team_deals for select to authenticated using (public.can_contact(team_id, contact));
create policy deals_insert on public.team_deals for insert to authenticated with check (created_by = auth.uid() and public.can_contact(team_id, contact));
create policy deals_update on public.team_deals for update to authenticated using (public.can_contact(team_id, contact)) with check (public.can_contact(team_id, contact));
create policy deals_delete on public.team_deals for delete to authenticated using (created_by = auth.uid() or public.is_team_member(team_id, 'admin'));
revoke update on public.team_deals from authenticated;
grant update (title, stage, amount, currency, expected_close, renewal, probability, owner, notes, lost_reason) on public.team_deals to authenticated;

create policy tickets_select on public.team_tickets for select to authenticated using (public.is_team_member(team_id) and public.has_cap(team_id, 'crm'));
create policy tickets_insert on public.team_tickets for insert to authenticated with check (created_by = auth.uid() and public.is_team_member(team_id) and public.has_cap(team_id, 'crm'));
create policy tickets_update on public.team_tickets for update to authenticated using (public.has_cap(team_id, 'crm')) with check (public.has_cap(team_id, 'crm'));
create policy tickets_delete on public.team_tickets for delete to authenticated using (created_by = auth.uid() or public.is_team_member(team_id, 'admin'));
revoke update on public.team_tickets from authenticated;
grant update (title, text, priority, status, assignee, resolved_at) on public.team_tickets to authenticated;

create policy recv_select on public.team_receivables for select to authenticated using (public.can_contact(team_id, contact));
create policy recv_insert on public.team_receivables for insert to authenticated with check (created_by = auth.uid() and public.can_contact(team_id, contact));
create policy recv_update on public.team_receivables for update to authenticated using (public.can_contact(team_id, contact)) with check (public.can_contact(team_id, contact));
create policy recv_delete on public.team_receivables for delete to authenticated using (created_by = auth.uid() or public.is_team_member(team_id, 'admin'));
revoke update on public.team_receivables from authenticated;
grant update (label, amount, currency, due, paid, paid_at) on public.team_receivables to authenticated;

create or replace function public._crm_check() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare pe uuid;
begin
  if tg_table_name = 'team_tickets' then pe := new.assignee; else pe := new.owner; end if;
  if pe is not null and not exists (select 1 from public.team_members m where m.team_id = new.team_id and m.user_id = pe) then
    raise exception 'persona_non_nel_team' using errcode = 'P0001';
  end if;
  if tg_table_name <> 'team_tickets' then new.updated_at := now(); end if;
  return new;
end $$;
create trigger team_contacts_check before insert or update on public.team_contacts for each row execute function public._crm_check();
create trigger team_deals_check before insert or update on public.team_deals for each row execute function public._crm_check();
create trigger team_tickets_check before insert or update on public.team_tickets for each row execute function public._crm_check();
revoke all on function public._crm_check() from public, anon, authenticated;

alter publication supabase_realtime add table public.team_deals;
alter publication supabase_realtime add table public.team_interactions;
alter publication supabase_realtime add table public.team_tickets;

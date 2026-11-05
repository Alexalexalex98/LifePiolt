-- Workspace Lavoro, punti 7 e 8: dati aziendali per i modelli (intestazione, logo, piè di pagina) usati da report, lettere, offerte e presentazioni in PDF.
-- Li vedono tutti i membri; li modifica chi ha il permesso di scrivere gli annunci (amministratori, responsabili, direzione). Solo oggetti nuovi.
create table if not exists public.team_brand (
  team_id uuid primary key references public.teams (id) on delete cascade,
  company text not null default '' check (char_length(company) <= 200),
  address text not null default '' check (char_length(address) <= 300),
  email text not null default '' check (char_length(email) <= 200),
  phone text not null default '' check (char_length(phone) <= 60),
  vat text not null default '' check (char_length(vat) <= 40),
  footer text not null default '' check (char_length(footer) <= 300),
  color text not null default '#0F766E' check (color ~ '^#[0-9a-fA-F]{6}$'),
  logo_path text,                                   -- file in «team-docs», cartella «team»
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.team_brand enable row level security;
create policy brand_select on public.team_brand for select to authenticated using (public.is_team_member(team_id));
create policy brand_insert on public.team_brand for insert to authenticated with check (public.has_cap(team_id, 'announce') and updated_by = auth.uid());
create policy brand_update on public.team_brand for update to authenticated using (public.has_cap(team_id, 'announce')) with check (public.has_cap(team_id, 'announce') and updated_by = auth.uid());
-- il logo vive in team-docs/<team>/team/...: lo possono caricare solo gli amministratori (regola già presente) e lo vedono tutti i membri

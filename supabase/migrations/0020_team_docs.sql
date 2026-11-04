-- Workspace Lavoro, punto 4: documenti intelligenti. Ogni documento è letto, riconosciuto e smistato (CV, fatture, buste paga, contratti...).
-- I documenti riservati (buste paga, CV, fatture) hanno un accesso ristretto: li vedono solo gli amministratori e, se è la sua, la persona interessata.
-- Solo oggetti nuovi.
create table if not exists public.team_docs (
  id text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  kind text not null check (kind in ('cv', 'invoice', 'bill', 'payslip', 'contract', 'quote', 'receipt', 'minutes', 'tax', 'registry', 'certificate', 'other')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  fields jsonb not null default '{}'::jsonb,        -- nome, cognome, importo, fornitore, periodo...
  access text not null default 'team' check (access in ('team', 'admin', 'person')),
  person uuid references auth.users (id) on delete set null,   -- la persona a cui si riferisce (buste paga, contratti)
  due date,                                                     -- scadenza (pagamento, rinnovo...)
  amount numeric(14, 2),
  currency text check (currency in ('CHF', 'EUR')),
  status text not null default 'new' check (status in ('new', 'paid', 'done', 'archived')),
  path text not null unique,                        -- file in «team-docs»
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime text,
  size bigint not null default 0,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_docs_team on public.team_docs (team_id, kind, created_at desc);
alter table public.team_docs enable row level security;

create policy docs_select on public.team_docs for select to authenticated using (
  public.is_team_member(team_id) and (access = 'team' or public.is_team_member(team_id, 'admin') or (access = 'person' and person = auth.uid()))
);
-- chi non è amministratore può caricare solo documenti visibili a tutto il team
create policy docs_insert on public.team_docs for insert to authenticated with check (
  created_by = auth.uid() and public.is_team_member(team_id) and (access = 'team' or public.is_team_member(team_id, 'admin'))
);
create policy docs_update on public.team_docs for update to authenticated
  using (created_by = auth.uid() or public.is_team_member(team_id, 'admin')) with check (public.is_team_member(team_id));
create policy docs_delete on public.team_docs for delete to authenticated using (created_by = auth.uid() or public.is_team_member(team_id, 'admin'));
revoke update on public.team_docs from authenticated;
grant update (title, fields, due, amount, currency, status, kind) on public.team_docs to authenticated;

create or replace function public._docs_check() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.person is not null and not exists (select 1 from public.team_members m where m.team_id = new.team_id and m.user_id = new.person) then
    raise exception 'persona_non_nel_team' using errcode = 'P0001';
  end if;
  if new.access = 'person' and new.person is null then raise exception 'persona_mancante' using errcode = 'P0001'; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger team_docs_check before insert or update on public.team_docs for each row execute function public._docs_check();
revoke all on function public._docs_check() from public, anon, authenticated;

-- Cartella privata dei documenti: «<team>/team/...» tutto il team, «<team>/admin/...» solo amministratori, «<team>/p-<persona>/...» amministratori e quella persona.
insert into storage.buckets (id, name, public, file_size_limit) values ('team-docs', 'team-docs', false, 26214400) on conflict (id) do nothing;
create policy team_docs_obj_select on storage.objects for select to authenticated using (
  bucket_id = 'team-docs' and public.is_team_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2] = 'team' or public.is_team_member(((storage.foldername(name))[1])::uuid, 'admin') or (storage.foldername(name))[2] = 'p-' || auth.uid()::text)
);
create policy team_docs_obj_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'team-docs' and public.is_team_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2] = 'team' or public.is_team_member(((storage.foldername(name))[1])::uuid, 'admin'))
);
create policy team_docs_obj_delete on storage.objects for delete to authenticated using (
  bucket_id = 'team-docs' and (owner = auth.uid() or public.is_team_member(((storage.foldername(name))[1])::uuid, 'admin'))
);

alter publication supabase_realtime add table public.team_docs;

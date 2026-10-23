-- =====================================================================================================
-- LifePilot - migrazione 0005: ACCOUNT (un'identita' per persona) e registro dei consensi.
-- Aggiunge a public.profiles l'indirizzo e la lingua, crea il registro dei consensi (solo aggiunta) e due funzioni:
--   account_save(p)  salva i dati dell'account e registra i consensi (eta' minima controllata anche qui)
--   account_get()    dice se l'account e' completo (serve per "ho gia' un account" su un nuovo telefono)
-- I dati restano privati: ognuno vede e scrive solo i propri (RLS). Idempotente.
-- =====================================================================================================
alter table public.profiles add column if not exists paese  text check (paese  is null or char_length(paese)  <= 60);
alter table public.profiles add column if not exists citta  text check (citta  is null or char_length(citta)  <= 80);
alter table public.profiles add column if not exists cap    text check (cap    is null or char_length(cap)    <= 12);
alter table public.profiles add column if not exists via    text check (via    is null or char_length(via)    <= 120);
alter table public.profiles add column if not exists lingua text check (lingua is null or char_length(lingua) <= 8);

-- registro dei consensi: prova di cosa e' stato accettato, quando e in quale versione. Non si modifica ne' si cancella dall'app.
create table if not exists public.consent_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  tipo        text not null check (tipo in ('termini', 'privacy', 'eta')),
  versione    text not null check (char_length(versione) <= 32),
  accettato_il timestamptz not null default now(),
  piattaforma text check (piattaforma is null or char_length(piattaforma) <= 16)
);
create index if not exists consent_log_user on public.consent_log (user_id, accettato_il desc);
alter table public.consent_log enable row level security;
revoke all on public.consent_log from public, anon, authenticated;
grant select, insert on public.consent_log to authenticated;
drop policy if exists consent_select on public.consent_log;
drop policy if exists consent_insert on public.consent_log;
create policy consent_select on public.consent_log for select to authenticated using (user_id = (select auth.uid()));
create policy consent_insert on public.consent_log for insert to authenticated with check (user_id = (select auth.uid()));

create or replace function public.account_save(p jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); v text := coalesce(p->>'versione', '');
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if char_length(btrim(coalesce(p->>'nome', ''))) < 1 or char_length(btrim(coalesce(p->>'cognome', ''))) < 1 then raise exception 'nome_mancante' using errcode = 'P0001'; end if;
  if (p->>'data_nascita') is null then raise exception 'data_nascita_mancante' using errcode = 'P0001'; end if;
  if char_length(btrim(coalesce(p->>'paese', ''))) < 2 or char_length(btrim(coalesce(p->>'citta', ''))) < 2 or char_length(btrim(coalesce(p->>'cap', ''))) < 3 or char_length(btrim(coalesce(p->>'via', ''))) < 3 then raise exception 'indirizzo_mancante' using errcode = 'P0001'; end if;
  if coalesce((p->>'termini')::boolean, false) is not true or coalesce((p->>'privacy')::boolean, false) is not true or coalesce((p->>'eta')::boolean, false) is not true then
    raise exception 'consensi_mancanti' using errcode = 'P0001';
  end if;
  insert into public.profiles (user_id, nome, cognome, data_nascita, paese, citta, cap, via, lingua, consenso_il, consenso_versione)
  values (uid, left(btrim(p->>'nome'), 80), left(btrim(p->>'cognome'), 80), (p->>'data_nascita')::date,
          nullif(left(btrim(coalesce(p->>'paese', '')), 60), ''), nullif(left(btrim(coalesce(p->>'citta', '')), 80), ''),
          nullif(left(btrim(coalesce(p->>'cap', '')), 12), ''), nullif(left(btrim(coalesce(p->>'via', '')), 120), ''),
          nullif(left(btrim(coalesce(p->>'lingua', '')), 8), ''), now(), left(v, 32))
  on conflict (user_id) do update set nome = excluded.nome, cognome = excluded.cognome, data_nascita = excluded.data_nascita,
    paese = excluded.paese, citta = excluded.citta, cap = excluded.cap, via = excluded.via, lingua = excluded.lingua,
    consenso_il = excluded.consenso_il, consenso_versione = excluded.consenso_versione;
  insert into public.consent_log (user_id, tipo, versione, piattaforma)
  select uid, t, left(v, 32), left(coalesce(p->>'piattaforma', ''), 16) from unnest(array['termini', 'privacy', 'eta']) as t;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.account_get() returns jsonb
language sql security invoker stable set search_path = '' as $$
  select coalesce((select jsonb_build_object('complete', true, 'nome', nome, 'cognome', cognome, 'paese', paese, 'citta', citta, 'cap', cap, 'via', via, 'versione', consenso_versione)
                   from public.profiles where user_id = auth.uid()), jsonb_build_object('complete', false));
$$;

revoke all on function public.account_save(jsonb) from public, anon, authenticated;
revoke all on function public.account_get() from public, anon, authenticated;
grant execute on function public.account_save(jsonb) to authenticated;
grant execute on function public.account_get() to authenticated;

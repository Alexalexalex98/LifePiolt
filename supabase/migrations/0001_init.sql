-- =====================================================================================================
-- LifePilot - schema del server (Supabase / Postgres). Migrazione 0001: tabelle, vincoli, RLS, trigger.
--
-- PRINCIPIO: sul server restano SOLO i dati di account (nome, cognome, email [in auth.users], data di
-- nascita, consenso, piano) e il registro di sincronizzazione che l'utente ha scelto di attivare, per
-- categoria. Salute, finanze, documenti, carte, ecc. NON hanno una tabella qui e non ne devono avere.
-- I payload di sync_changes sono cifrati dal telefono (end-to-end) per le categorie sensibili: il
-- server non li legge. Vedi docs/server-supabase.md e docs/privacy-model.md.
--
-- Tutte le istruzioni sono idempotenti: si puo' rieseguire il file senza danni.
-- Le funzioni (sync_push, sync_pull, ...) sono nel file 0002; storage e manutenzione nel 0003.
-- =====================================================================================================

-- ---------------------------------------------------------------------------------------------------
-- Costante di prodotto: eta' minima per creare un account (consenso digitale). Da confermare con un
-- consulente legale per i paesi in cui l'app viene distribuita (GDPR art. 8: 13-16 anni a seconda dello Stato).
-- ---------------------------------------------------------------------------------------------------
create or replace function public.min_age_years() returns int
language sql immutable as $$ select 16 $$;

-- ---------------------------------------------------------------------------------------------------
-- profiles: SOLO i dati di account concordati con l'utente. L'email sta in auth.users (non duplicata).
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  nome               text check (nome is null or char_length(nome) <= 80),
  cognome            text check (cognome is null or char_length(cognome) <= 80),
  data_nascita       date check (data_nascita is null or (data_nascita >= date '1900-01-01' and data_nascita < date '2100-01-01')),
  consenso_il        timestamptz,            -- quando l'utente ha accettato il trattamento dei dati di account
  consenso_versione  text check (consenso_versione is null or char_length(consenso_versione) <= 32),
  creato_il          timestamptz not null default now(),
  aggiornato_il      timestamptz not null default now()
);
comment on table public.profiles is 'Dati di account dichiarati dall''utente (nome, cognome, data di nascita). Niente salute, finanze o altro.';

-- Convalida e data di aggiornamento: l'eta' minima vale anche se qualcuno aggira l'app e parla direttamente con l'API.
create or replace function public.profiles_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.data_nascita is not null and new.data_nascita > (current_date - make_interval(years => public.min_age_years()))::date then
    raise exception 'eta_minima' using errcode = 'P0001', hint = 'Serve l''eta'' minima per creare un account.';
  end if;
  new.nome := nullif(btrim(new.nome), '');
  new.cognome := nullif(btrim(new.cognome), '');
  new.aggiornato_il := now();
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update on public.profiles for each row execute function public.profiles_guard();

-- ---------------------------------------------------------------------------------------------------
-- entitlements: piano dell'utente. Si legge ma NON si scrive dal telefono (solo service_role): altrimenti
-- ognuno potrebbe darsi il piano Pro.
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.entitlements (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  plan        text not null default 'free' check (plan in ('free', 'plus', 'pro')),
  updated_at  timestamptz not null default now()
);
comment on table public.entitlements is 'Piano (free/plus/pro). Scrittura riservata al service_role (pagamenti/amministrazione).';

-- ---------------------------------------------------------------------------------------------------
-- devices: dispositivi collegati all'account (nome scelto dall'utente, piattaforma, ultimo accesso).
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.devices (
  user_id         uuid not null references auth.users (id) on delete cascade,
  id              text not null check (char_length(id) between 1 and 64),
  nome            text check (nome is null or char_length(nome) <= 80),
  piattaforma     text check (piattaforma is null or char_length(piattaforma) <= 32),
  ultimo_accesso  timestamptz not null default now(),
  creato_il       timestamptz not null default now(),
  primary key (user_id, id)
);
comment on table public.devices is 'Dispositivi dell''account. id = deviceId generato dal telefono (uuid) e custodito nel portachiavi.';

-- ---------------------------------------------------------------------------------------------------
-- sync_state: contatore per utente. last_seq = ultimo serverSeq assegnato (SENZA BUCHI: si incrementa
-- sotto lock di riga nella stessa transazione che inserisce i cambi, quindi l'ordine di commit coincide
-- con l'ordine di serverSeq per quell'utente). min_seq = soglia sotto cui il server ha dimenticato
-- tombstone: un cursore piu' vecchio riceve reset. bytes_used = spazio occupato dai payload (quota).
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.sync_state (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  last_seq    bigint not null default 0 check (last_seq >= 0),
  min_seq     bigint not null default 0 check (min_seq >= 0),
  bytes_used  bigint not null default 0 check (bytes_used >= 0),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------------
-- sync_changes: registro append-only delle modifiche (contratto: docs/sync.md, src/schemas/change.ts).
--  * (user_id, change_id) UNIQUE: idempotenza per changeId. Per utente (non globale) cosi' nessuno puo'
--    scoprire se un uuid esiste presso un altro account.
--  * payload: testo opaco. Con codec E2E e' cifrato dal telefono e il server NON lo interpreta.
--  * il server non fa merge: conserva e ordina per server_seq.
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.sync_changes (
  user_id      uuid   not null references auth.users (id) on delete cascade,
  server_seq   bigint not null check (server_seq >= 1),
  change_id    uuid   not null,
  device_id    text   not null check (char_length(device_id) between 1 and 64),
  collection   text   not null check (collection ~ '^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$'),
  entity_id    text   not null check (char_length(entity_id) between 1 and 256),
  op           text   not null check (op in ('create', 'update', 'delete')),
  hlc          text   not null check (hlc ~ '^[0-9]{13}\.[0-9a-z]{4}\.[A-Za-z0-9_-]{1,64}$'),
  base_hlc     text   check (base_hlc is null or base_hlc ~ '^[0-9]{13}\.[0-9a-z]{4}\.[A-Za-z0-9_-]{1,64}$'),
  schema_v     int    not null check (schema_v between 1 and 1000),
  codec        text   not null check (char_length(codec) between 1 and 64),
  client_seq   bigint not null default 0 check (client_seq >= 0),
  payload      text   check (payload is null or octet_length(payload) <= 65536),
  size         int    not null default 0 check (size >= 0),
  created_at   timestamptz not null default now(),
  primary key (user_id, server_seq),
  constraint sync_changes_change_unique unique (user_id, change_id),
  constraint sync_changes_payload_required check (op = 'delete' or payload is not null)
);
comment on table public.sync_changes is 'Registro delle modifiche sincronizzate. payload cifrato dal client (E2E) per le categorie sensibili.';
comment on column public.sync_changes.size is 'Byte del payload (per quote e statistiche; non il contenuto).';
-- ricerca delle entita' per la pulizia delle tombstone
create index if not exists sync_changes_entity_idx on public.sync_changes (user_id, collection, entity_id, hlc desc);
-- pulizia: solo le cancellazioni
create index if not exists sync_changes_tombstone_idx on public.sync_changes (created_at) where op = 'delete';

-- ---------------------------------------------------------------------------------------------------
-- quotas: contatori per utente e finestra (AI, byte, ...). Scritti solo da funzioni (service_role).
-- rate_limits: richieste per finestra di un minuto (sync), per utente e dispositivo.
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.quotas (
  user_id       uuid not null references auth.users (id) on delete cascade,
  kind          text not null check (char_length(kind) between 1 and 48),
  window_start  timestamptz not null,
  used          numeric not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, kind, window_start)
);
comment on table public.quotas is 'Contatori di utilizzo per finestra (es. ai.tokens, ai.cost). Nessun contenuto, solo numeri.';

create table if not exists public.rate_limits (
  user_id       uuid not null references auth.users (id) on delete cascade,
  scope         text not null check (char_length(scope) between 1 and 96),
  window_start  timestamptz not null,
  hits          int not null default 0,
  primary key (user_id, scope, window_start)
);

-- ---------------------------------------------------------------------------------------------------
-- deleted_accounts: audit MINIMO. Solo un timestamp, nessun identificativo (neppure l'uuid).
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.deleted_accounts (
  id          uuid primary key default gen_random_uuid(),
  deleted_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------------
-- RLS: abilitata ovunque. Nessun accesso anonimo. Regola base: user_id = auth.uid().
-- ---------------------------------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.entitlements     enable row level security;
alter table public.devices          enable row level security;
alter table public.sync_state       enable row level security;
alter table public.sync_changes     enable row level security;
alter table public.quotas           enable row level security;
alter table public.rate_limits      enable row level security;
alter table public.deleted_accounts enable row level security;

-- privilegi minimi: si toglie tutto e si concede solo cio' che serve a 'authenticated'
revoke all on public.profiles, public.entitlements, public.devices, public.sync_state, public.sync_changes,
              public.quotas, public.rate_limits, public.deleted_accounts from anon, authenticated, public;

grant select, insert, update, delete on public.profiles to authenticated;
grant select                         on public.entitlements to authenticated;
grant select, insert, update, delete on public.devices to authenticated;
grant select                         on public.sync_state to authenticated;
-- sync_changes: lettura e cancellazione dei PROPRI dati. Insert/update SOLO tramite sync_push (limiti, quote, serverSeq).
grant select, delete                 on public.sync_changes to authenticated;
grant select                         on public.quotas to authenticated;

-- profiles (select/insert/update/delete sulla propria riga)
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_delete on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy profiles_delete on public.profiles for delete to authenticated using (user_id = (select auth.uid()));

-- entitlements: solo lettura della propria riga
drop policy if exists entitlements_select on public.entitlements;
create policy entitlements_select on public.entitlements for select to authenticated using (user_id = (select auth.uid()));

-- devices
drop policy if exists devices_select on public.devices;
drop policy if exists devices_insert on public.devices;
drop policy if exists devices_update on public.devices;
drop policy if exists devices_delete on public.devices;
create policy devices_select on public.devices for select to authenticated using (user_id = (select auth.uid()));
create policy devices_insert on public.devices for insert to authenticated with check (user_id = (select auth.uid()));
create policy devices_update on public.devices for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy devices_delete on public.devices for delete to authenticated using (user_id = (select auth.uid()));

-- sync_state, quotas: sola lettura
drop policy if exists sync_state_select on public.sync_state;
create policy sync_state_select on public.sync_state for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists quotas_select on public.quotas;
create policy quotas_select on public.quotas for select to authenticated using (user_id = (select auth.uid()));

-- sync_changes: lettura e cancellazione dei propri cambi (nessuna policy di insert/update: vedi sync_push)
drop policy if exists sync_changes_select on public.sync_changes;
drop policy if exists sync_changes_delete on public.sync_changes;
create policy sync_changes_select on public.sync_changes for select to authenticated using (user_id = (select auth.uid()));
create policy sync_changes_delete on public.sync_changes for delete to authenticated using (user_id = (select auth.uid()));

-- rate_limits, deleted_accounts: RLS attiva e NESSUNA policy = nessun accesso dal client.

-- ---------------------------------------------------------------------------------------------------
-- Registrazione: crea profiles/entitlements/sync_state con i metadati passati da signUp
-- (options.data = { nome, cognome, data_nascita, consenso_il, consenso_versione }).
-- SECURITY DEFINER perche' gira nel contesto di auth; search_path vuoto per evitare dirottamenti.
-- Se la data di nascita e' presente ma sotto l'eta' minima la registrazione fallisce ('eta_minima').
-- ---------------------------------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_birth date;
  v_consent timestamptz;
begin
  begin v_birth := nullif(m->>'data_nascita', '')::date; exception when others then v_birth := null; end;
  begin v_consent := nullif(m->>'consenso_il', '')::timestamptz; exception when others then v_consent := null; end;
  insert into public.profiles (user_id, nome, cognome, data_nascita, consenso_il, consenso_versione)
  values (new.id, left(btrim(coalesce(m->>'nome', '')), 80), left(btrim(coalesce(m->>'cognome', '')), 80), v_birth, v_consent, left(m->>'consenso_versione', 32))
  on conflict (user_id) do nothing;
  insert into public.entitlements (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.sync_state (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------------------------------
-- Realtime: PREDISPOSTO ma NON attivo. Per le chat future si abilitera' per tabella, solo se serve:
--   alter publication supabase_realtime add table public.<tabella>;
-- (le policy RLS valgono anche per Realtime). Nessuna tabella e' oggi pubblicata.
-- ---------------------------------------------------------------------------------------------------

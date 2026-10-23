-- ===== supabase/migrations/0001_init.sql =====
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

-- ===== supabase/migrations/0002_sync_functions.sql =====
-- =====================================================================================================
-- LifePilot - migrazione 0002: funzioni RPC di sincronizzazione, quote, pulizia, cancellazione account.
-- Implementano il contratto di docs/sync.md. Il server NON fa merge e NON legge i payload.
-- Funzioni SECURITY DEFINER con search_path vuoto e controllo ESPLICITO di auth.uid() (le tabelle non
-- concedono insert/update ai client: l'unica via di scrittura e' questa, con limiti e quote).
-- Errori: PostgREST traduce SQLSTATE 'PTnnn' in HTTP nnn. Il rate limit risponde 429 con Retry-After
-- ma SENZA rollback (cosi' il contatore resta).
-- =====================================================================================================

-- Limiti (devono coincidere con LIMITS in src/schemas/change.ts)
create or replace function public.sync_limits() returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'maxPayloadBytes', 65536, 'maxPushBatch', 200, 'maxPullPage', 500, 'rateLimitPerMinute', 60,
    'tombstoneTtlDays', 90, 'maxClockDriftMs', 86400000, 'maxBytesPerUser', 52428800)
$$;

-- millisecondi dell'HLC (prime 13 cifre)
create or replace function public.hlc_wall_ms(h text) returns bigint language sql immutable as $$
  select substr(h, 1, 13)::bigint
$$;

-- ---------------------------------------------------------------------------------------------------
-- Rate limit: ritorna 0 se la richiesta e' ammessa, altrimenti i secondi da attendere.
-- Finestra fissa di un minuto per (utente, ambito).
-- ---------------------------------------------------------------------------------------------------
create or replace function public._rate_hit(p_user uuid, p_scope text, p_max int) returns int
language plpgsql security definer set search_path = '' as $$
declare
  w timestamptz := date_trunc('minute', now());
  n int;
begin
  insert into public.rate_limits as r (user_id, scope, window_start, hits) values (p_user, left(p_scope, 96), w, 1)
  on conflict (user_id, scope, window_start) do update set hits = r.hits + 1
  returning hits into n;
  if n > p_max then
    return greatest(1, ceil(extract(epoch from (w + interval '1 minute' - now())))::int);
  end if;
  return 0;
end $$;

-- risposta 429 con Retry-After (la transazione NON viene annullata)
create or replace function public._too_many(p_retry int) returns jsonb
language plpgsql set search_path = '' as $$
begin
  perform set_config('response.status', '429', true);
  perform set_config('response.headers', jsonb_build_array(jsonb_build_object('Retry-After', p_retry::text))::text, true);
  return jsonb_build_object('error', 'rate_limited', 'retry_after', p_retry);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- sync_push(batch): batch = { v:1, deviceId, deviceName?, platform?, changes:[WireChange...] }
-- Ritorna { acked:[id], rejected:[{id,reason,retryable}], serverCursor }.
-- Idempotente per change_id. Valida come wireChangeSchema (strict) e applica i limiti.
-- ---------------------------------------------------------------------------------------------------
create or replace function public.sync_push(batch jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  lim jsonb := public.sync_limits();
  dev text;
  chs jsonb;
  n int;
  i int;
  c jsonb;
  retry int;
  st public.sync_state%rowtype;
  acked jsonb := '[]'::jsonb;
  rejected jsonb := '[]'::jsonb;
  cid uuid;
  cid_txt text;
  payload text;
  psize int;
  op text;
  v_hlc text;
  v_base text;
  v_seq bigint;
  prev_seq bigint;
  v_bytes bigint;
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  bad_key boolean;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if batch is null or jsonb_typeof(batch) <> 'object' then raise exception 'bad_request' using errcode = 'PT400'; end if;
  dev := batch->>'deviceId';
  if dev is null or char_length(dev) not between 1 and 64 then raise exception 'bad_request: deviceId' using errcode = 'PT400'; end if;
  chs := batch->'changes';
  if chs is null or jsonb_typeof(chs) <> 'array' then raise exception 'bad_request: changes' using errcode = 'PT400'; end if;
  n := jsonb_array_length(chs);
  if n > (lim->>'maxPushBatch')::int then raise exception 'batch_too_large' using errcode = 'PT413'; end if;

  retry := public._rate_hit(uid, 'sync:' || dev, (lim->>'rateLimitPerMinute')::int);
  if retry > 0 then return public._too_many(retry); end if;

  -- serializza i push dello stesso utente: l'ordine di commit coincide con l'ordine di server_seq
  insert into public.sync_state (user_id) values (uid) on conflict (user_id) do nothing;
  select * into st from public.sync_state where user_id = uid for update;

  insert into public.devices (user_id, id, nome, piattaforma, ultimo_accesso)
  values (uid, dev, left(coalesce(nullif(batch->>'deviceName', ''), dev), 80), left(batch->>'platform', 32), now())
  on conflict (user_id, id) do update set ultimo_accesso = now(),
    nome = coalesce(nullif(left(batch->>'deviceName', 80), ''), public.devices.nome),
    piattaforma = coalesce(left(batch->>'platform', 32), public.devices.piattaforma);

  v_seq := st.last_seq;
  v_bytes := st.bytes_used;

  for i in 0 .. n - 1 loop
    c := chs -> i;
    prev_seq := v_seq;
    cid_txt := case when jsonb_typeof(c) = 'object' then coalesce(c->>'id', '') else '' end;
    begin
      if jsonb_typeof(c) <> 'object' then raise exception 'invalid'; end if;
      cid := cid_txt::uuid;                                   -- uuid non valido -> invalid
      -- busta strict: nessun campo sconosciuto
      select bool_or(k not in ('v','id','collection','schemaV','entityId','op','hlc','base','deviceId','seq','codec','payload','serverSeq'))
        into bad_key from jsonb_object_keys(c) k;
      if bad_key then raise exception 'invalid'; end if;

      payload := null; psize := 0;
      if c ? 'payload' then
        if jsonb_typeof(c->'payload') <> 'string' then raise exception 'invalid'; end if;
        payload := c->>'payload';
        psize := octet_length(payload);
        if psize > (lim->>'maxPayloadBytes')::int then
          rejected := rejected || jsonb_build_object('id', cid_txt, 'reason', 'too-large', 'retryable', false);
          continue;
        end if;
      end if;

      op := c->>'op';
      v_hlc := c->>'hlc';
      v_base := c->>'base';
      if c->'v' is distinct from '1'::jsonb
         or jsonb_typeof(c->'collection') <> 'string' or (c->>'collection') !~ '^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$'
         or jsonb_typeof(c->'entityId') <> 'string' or char_length(c->>'entityId') not between 1 and 256
         or op is null or op not in ('create', 'update', 'delete')
         or jsonb_typeof(c->'hlc') <> 'string' or v_hlc !~ '^[0-9]{13}\.[0-9a-z]{4}\.[A-Za-z0-9_-]{1,64}$'
         or (c ? 'base' and (jsonb_typeof(c->'base') <> 'string' or v_base !~ '^[0-9]{13}\.[0-9a-z]{4}\.[A-Za-z0-9_-]{1,64}$'))
         or jsonb_typeof(c->'schemaV') <> 'number' or (c->>'schemaV')::int not between 1 and 1000
         or jsonb_typeof(c->'seq') <> 'number' or (c->>'seq')::bigint < 0
         or jsonb_typeof(c->'codec') <> 'string' or char_length(c->>'codec') not between 1 and 64
         or jsonb_typeof(c->'deviceId') <> 'string'
         or (op <> 'delete' and payload is null) then
        raise exception 'invalid';
      end if;
      if (c->>'deviceId') <> dev then
        rejected := rejected || jsonb_build_object('id', cid_txt, 'reason', 'forbidden', 'retryable', false);
        continue;
      end if;
      if public.hlc_wall_ms(v_hlc) - v_now_ms > (lim->>'maxClockDriftMs')::bigint then raise exception 'invalid'; end if;

      -- idempotenza: un change_id gia' noto e' confermato senza riapplicarlo
      if exists (select 1 from public.sync_changes where user_id = uid and change_id = cid) then
        acked := acked || to_jsonb(cid_txt);
        continue;
      end if;
      if v_bytes + psize > (lim->>'maxBytesPerUser')::bigint then
        rejected := rejected || jsonb_build_object('id', cid_txt, 'reason', 'quota', 'retryable', false);
        continue;
      end if;

      v_seq := v_seq + 1;
      insert into public.sync_changes (user_id, server_seq, change_id, device_id, collection, entity_id, op, hlc, base_hlc, schema_v, codec, client_seq, payload, size)
      values (uid, v_seq, cid, dev, c->>'collection', c->>'entityId', op, v_hlc, v_base, (c->>'schemaV')::int, c->>'codec', (c->>'seq')::bigint, payload, psize);
      v_bytes := v_bytes + psize;
      acked := acked || to_jsonb(cid_txt);
    exception when others then
      -- l'inserimento del singolo cambio e' annullato dal blocco; il numero di sequenza non si consuma
      if sqlerrm = 'invalid' or sqlstate in ('22P02', '22003', '22007', '22023', '23514', '42804') then
        v_seq := prev_seq;
        rejected := rejected || jsonb_build_object('id', cid_txt, 'reason', 'invalid', 'retryable', false);
      else
        raise;
      end if;
    end;
  end loop;

  update public.sync_state set last_seq = v_seq, bytes_used = v_bytes, updated_at = now() where user_id = uid;
  return jsonb_build_object('acked', acked, 'rejected', rejected, 'serverCursor', v_seq::text);
end $$;
comment on function public.sync_push(jsonb) is 'Push idempotente dei cambi (contratto docs/sync.md). Nessun merge, payload opaco.';

-- ---------------------------------------------------------------------------------------------------
-- sync_pull(cursor, limit, collections, device): cambi con server_seq > cursor, in ordine stabile.
-- Ritorna { changes:[WireChange+serverSeq], nextCursor, hasMore, reset? }.
-- reset = cursore piu' vecchio della memoria del server (tombstone dimenticate) o oltre l'ultimo seq.
-- ---------------------------------------------------------------------------------------------------
create or replace function public.sync_pull(p_cursor bigint default null, p_limit int default 500, p_collections text[] default null, p_device text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  lim jsonb := public.sync_limits();
  st public.sync_state%rowtype;
  retry int;
  lmt int := least(greatest(coalesce(p_limit, 500), 1), (lim->>'maxPullPage')::int);
  cur bigint := coalesce(p_cursor, 0);
  out_changes jsonb;
  more boolean;
  lastseq bigint;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if p_cursor is not null and p_cursor < 0 then raise exception 'bad_request: cursor' using errcode = 'PT400'; end if;
  if p_device is not null and char_length(p_device) not between 1 and 64 then raise exception 'bad_request: device' using errcode = 'PT400'; end if;

  retry := public._rate_hit(uid, 'sync:' || coalesce(p_device, '-'), (lim->>'rateLimitPerMinute')::int);
  if retry > 0 then return public._too_many(retry); end if;

  if p_device is not null then
    update public.devices set ultimo_accesso = now() where user_id = uid and id = p_device and ultimo_accesso < now() - interval '1 minute';
  end if;

  select * into st from public.sync_state where user_id = uid;
  if not found then
    if p_cursor is not null and p_cursor > 0 then
      return jsonb_build_object('changes', '[]'::jsonb, 'nextCursor', '0', 'hasMore', false, 'reset', true);
    end if;
    return jsonb_build_object('changes', '[]'::jsonb, 'nextCursor', '0', 'hasMore', false);
  end if;

  if p_cursor is not null and (p_cursor < st.min_seq or p_cursor > st.last_seq) then
    return jsonb_build_object('changes', '[]'::jsonb, 'nextCursor', st.last_seq::text, 'hasMore', false, 'reset', true);
  end if;

  with page as (
    select s.*, row_number() over (order by s.server_seq) as rn
    from public.sync_changes s
    where s.user_id = uid and s.server_seq > cur
      and (p_collections is null or s.collection = any (p_collections))
    order by s.server_seq
    limit lmt + 1
  )
  select
    coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'v', 1, 'id', change_id, 'collection', collection, 'schemaV', schema_v, 'entityId', entity_id, 'op', op,
      'hlc', hlc, 'base', base_hlc, 'deviceId', device_id, 'seq', client_seq, 'codec', codec,
      'payload', payload, 'serverSeq', server_seq)) order by server_seq) filter (where rn <= lmt), '[]'::jsonb),
    count(*) > lmt,
    coalesce(max(server_seq) filter (where rn <= lmt), 0)
  into out_changes, more, lastseq
  from page;

  return jsonb_build_object('changes', out_changes, 'nextCursor', (case when more then lastseq else st.last_seq end)::text, 'hasMore', more);
end $$;
comment on function public.sync_pull(bigint, int, text[], text) is 'Pull per cursore (server_seq). Ordine stabile, reset oltre il TTL delle tombstone.';

-- ---------------------------------------------------------------------------------------------------
-- sync_delete_all(): cancella tutti i cambi dell'utente. I cursori vecchi di altri dispositivi ricevono reset.
-- ---------------------------------------------------------------------------------------------------
create or replace function public.sync_delete_all() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n bigint;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  with d as (delete from public.sync_changes where user_id = uid returning 1) select count(*) into n from d;
  update public.sync_state set min_seq = last_seq, bytes_used = 0, updated_at = now() where user_id = uid;
  return jsonb_build_object('deleted', n);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- sync_prune(ttl_days): dimentica le entita' la cui ULTIMA versione (per HLC) e' una cancellazione piu'
-- vecchia del TTL, e le righe vecchie di rate_limits/quotas. Pianificabile (pg_cron, migrazione 0003).
-- Riservata a service_role/postgres.
-- ---------------------------------------------------------------------------------------------------
create or replace function public.sync_prune(p_ttl_days int default 90) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare entities bigint; rows_deleted bigint;
begin
  with dead as (
    select l.user_id, l.collection, l.entity_id from (
      select distinct on (user_id, collection, entity_id) user_id, collection, entity_id, op, created_at
      from public.sync_changes order by user_id, collection, entity_id, hlc desc, server_seq desc
    ) l where l.op = 'delete' and l.created_at < now() - make_interval(days => p_ttl_days)
  ), del as (
    delete from public.sync_changes s using dead d
    where s.user_id = d.user_id and s.collection = d.collection and s.entity_id = d.entity_id
    returning s.user_id, s.server_seq, s.size
  ), agg as (
    select user_id, max(server_seq) as mx, sum(size) as sz, count(*) as cnt from del group by user_id
  ), upd as (
    update public.sync_state st set min_seq = greatest(st.min_seq, agg.mx), bytes_used = greatest(0, st.bytes_used - agg.sz), updated_at = now()
    from agg where st.user_id = agg.user_id returning agg.cnt
  )
  select (select count(*) from dead), coalesce((select sum(cnt) from upd), 0) into entities, rows_deleted;

  delete from public.rate_limits where window_start < now() - interval '1 day';
  delete from public.quotas where window_start < now() - interval '40 days';
  return jsonb_build_object('entities', entities, 'rows', rows_deleted);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- Quote (usate da Edge Function ai-route con service_role). Finestra fissa di p_window secondi
-- (0 = mese di calendario UTC). Ritorna { ok, used, limit }.
-- ---------------------------------------------------------------------------------------------------
create or replace function public._window_start(p_window int) returns timestamptz
language sql stable set search_path = '' as $$
  select case when p_window = 0 then date_trunc('month', now() at time zone 'utc') at time zone 'utc'
              else to_timestamp(floor(extract(epoch from now()) / p_window) * p_window) end
$$;

create or replace function public.quota_consume(p_user uuid, p_kind text, p_window int, p_limit numeric, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare w timestamptz := public._window_start(p_window); u numeric;
begin
  if p_amount < 0 then raise exception 'bad_request: amount' using errcode = 'PT400'; end if;
  insert into public.quotas as q (user_id, kind, window_start, used) values (p_user, p_kind, w, 0) on conflict do nothing;
  update public.quotas q set used = q.used + p_amount, updated_at = now()
    where q.user_id = p_user and q.kind = p_kind and q.window_start = w and q.used + p_amount <= p_limit
    returning q.used into u;
  if u is null then
    select q.used into u from public.quotas q where q.user_id = p_user and q.kind = p_kind and q.window_start = w;
    return jsonb_build_object('ok', false, 'used', u, 'limit', p_limit);
  end if;
  return jsonb_build_object('ok', true, 'used', u, 'limit', p_limit);
end $$;

-- correzione a consuntivo (anche negativa): stima -> consumo reale
create or replace function public.quota_adjust(p_user uuid, p_kind text, p_window int, p_delta numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare w timestamptz := public._window_start(p_window);
begin
  insert into public.quotas as q (user_id, kind, window_start, used) values (p_user, p_kind, w, greatest(0, p_delta))
  on conflict (user_id, kind, window_start) do update set used = greatest(0, q.used + p_delta), updated_at = now();
end $$;

-- ---------------------------------------------------------------------------------------------------
-- Cancellazione account: TUTTO cio' che riguarda l'utente. auth.users e' l'origine delle cascade
-- (profiles, devices, sync_*, quotas, rate_limits, entitlements). I file in Storage vanno rimossi con
-- l'API di Storage PRIMA (lo fa la Edge Function delete-account): Supabase vieta il DELETE diretto su
-- storage.objects, quindi qui e' solo un tentativo prudente.
-- ---------------------------------------------------------------------------------------------------
create or replace function public.delete_user_data(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then raise exception 'bad_request' using errcode = 'PT400'; end if;
  if to_regclass('storage.objects') is not null then
    begin
      execute 'delete from storage.objects where bucket_id = $1 and (storage.foldername(name))[1] = $2' using 'user-files', p_user::text;
    exception when others then null;   -- protetto da Storage: ci pensa l'API
    end;
  end if;
  delete from auth.users where id = p_user;
  insert into public.deleted_accounts default values;     -- solo un timestamp
end $$;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  perform public.delete_user_data(auth.uid());
end $$;

-- ---------------------------------------------------------------------------------------------------
-- Permessi sulle funzioni: di base nessuno; poi solo cio' che serve.
-- ---------------------------------------------------------------------------------------------------
revoke all on function public.sync_push(jsonb) from public, anon, authenticated;
revoke all on function public.sync_pull(bigint, int, text[], text) from public, anon, authenticated;
revoke all on function public.sync_delete_all() from public, anon, authenticated;
revoke all on function public.sync_prune(int) from public, anon, authenticated;
revoke all on function public.quota_consume(uuid, text, int, numeric, numeric) from public, anon, authenticated;
revoke all on function public.quota_adjust(uuid, text, int, numeric) from public, anon, authenticated;
revoke all on function public.delete_user_data(uuid) from public, anon, authenticated;
revoke all on function public.delete_my_account() from public, anon, authenticated;
revoke all on function public._rate_hit(uuid, text, int) from public, anon, authenticated;
revoke all on function public._too_many(int) from public, anon, authenticated;
revoke all on function public.sync_limits() from public, anon;
revoke all on function public.hlc_wall_ms(text) from public, anon;

grant execute on function public.sync_push(jsonb) to authenticated;
grant execute on function public.sync_pull(bigint, int, text[], text) to authenticated;
grant execute on function public.sync_delete_all() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.sync_limits() to authenticated;
grant execute on function public.hlc_wall_ms(text) to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.sync_prune(int) to service_role;
    grant execute on function public.quota_consume(uuid, text, int, numeric, numeric) to service_role;
    grant execute on function public.quota_adjust(uuid, text, int, numeric) to service_role;
    grant execute on function public.delete_user_data(uuid) to service_role;
  end if;
end $$;

-- ===== supabase/migrations/0003_storage_maintenance.sql =====
-- =====================================================================================================
-- LifePilot - migrazione 0003: Storage privato per i file dell'utente e pulizia pianificata.
-- Si puo' eseguire anche senza Storage/pg_cron: i blocchi sono protetti e saltano da soli.
-- =====================================================================================================

-- Bucket privato 'user-files': percorso {user_id}/... ; ogni utente vede solo la propria cartella.
-- Limite dimensione per file: 10 MiB (il piano gratuito ha un tetto globale: vedi docs/server-supabase.md).
-- Oggi l'app NON carica file (LifeDrive sincronizza solo l'elenco): il bucket e' predisposto.
do $$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'Storage non presente: salto il bucket user-files';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit)
  values ('user-files', 'user-files', false, 10485760)
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

  execute 'drop policy if exists "user-files select" on storage.objects';
  execute 'drop policy if exists "user-files insert" on storage.objects';
  execute 'drop policy if exists "user-files update" on storage.objects';
  execute 'drop policy if exists "user-files delete" on storage.objects';
  execute $p$create policy "user-files select" on storage.objects for select to authenticated
             using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
  execute $p$create policy "user-files insert" on storage.objects for insert to authenticated
             with check (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
  execute $p$create policy "user-files update" on storage.objects for update to authenticated
             using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
             with check (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
  execute $p$create policy "user-files delete" on storage.objects for delete to authenticated
             using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
end $$;

-- Pulizia giornaliera (03:17 UTC) delle tombstone oltre i 90 giorni e dei contatori vecchi.
-- Richiede l'estensione pg_cron: Dashboard > Database > Extensions > pg_cron (poi rieseguire questo file).
-- Senza pg_cron il sync funziona lo stesso; le tombstone si accumulano soltanto (vedi docs).
do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron non attivo: la pulizia non e'' pianificata (abilitalo in Database > Extensions e riesegui)';
    return;
  end if;
  perform cron.schedule('lifepilot-sync-prune', '17 3 * * *', 'select public.sync_prune(90)');
exception when others then
  raise notice 'impossibile pianificare la pulizia: %', sqlerrm;
end $$;

-- ===== supabase/migrations/0004_social.sql =====
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

-- ===== supabase/migrations/0005_account.sql =====
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

-- ===== supabase/migrations/0006_identity.sql =====
-- =====================================================================================================
-- LifePilot - migrazione 0006: UNA PERSONA, UN ACCOUNT (impronta del documento).
-- Il server NON conserva né il numero del documento né le foto: solo un'impronta (HMAC con un segreto che sta
-- nella funzione server, mai nel database né nell'app) calcolata dopo la verifica fatta da un fornitore di identita'.
-- Se la stessa impronta compare su un altro account, la verifica viene rifiutata ("documento_gia_usato").
-- Cancellando l'account sparisce anche l'impronta: la stessa persona potra' crearne uno nuovo.
-- Scrittura riservata al service_role (la funzione server che riceve l'esito del fornitore). Idempotente.
-- =====================================================================================================
create table if not exists public.identity_claims (
  claim_hash   text primary key check (claim_hash ~ '^[0-9a-f]{64}$'),
  user_id      uuid not null unique references auth.users (id) on delete cascade,
  provider     text not null check (char_length(provider) <= 40),
  paese_doc    text check (paese_doc is null or char_length(paese_doc) <= 3),
  tipo_doc     text check (tipo_doc is null or char_length(tipo_doc) <= 24),
  verificato_il timestamptz not null default now()
);
alter table public.identity_claims enable row level security;
revoke all on public.identity_claims from public, anon, authenticated;

create or replace function public.identity_claim(p_hash text, p_user uuid, p_provider text, p_country text, p_type text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.identity_claims (claim_hash, user_id, provider, paese_doc, tipo_doc) values (p_hash, p_user, p_provider, p_country, p_type);
  return jsonb_build_object('ok', true);
exception when unique_violation then
  if exists (select 1 from public.identity_claims where user_id = p_user) then return jsonb_build_object('ok', false, 'error', 'account_gia_verificato'); end if;
  return jsonb_build_object('ok', false, 'error', 'documento_gia_usato');
end $$;

-- l'app chiede solo "sono verificato?": mai l'impronta
create or replace function public.identity_status() returns jsonb
language sql security definer stable set search_path = '' as $$
  select jsonb_build_object('verified', exists (select 1 from public.identity_claims where user_id = auth.uid()));
$$;

revoke all on function public.identity_claim(text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.identity_status() from public, anon, authenticated;
grant execute on function public.identity_status() to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.identity_claim(text, uuid, text, text, text) to service_role;
  end if;
end $$;

-- ===== supabase/migrations/0007_friends_messages.sql =====
-- =====================================================================================================
-- LifePilot - migrazione 0007: AMICI (codice amico) e MESSAGGI DIRETTI tra due persone.
--  - ognuno ha un codice amico; chi lo conosce puo' mandare una richiesta; si diventa amici solo se l'altro accetta;
--  - i messaggi si possono scrivere SOLO tra amici (controllato dal server) e li leggono solo mittente e destinatario (RLS);
--  - nessuna ricerca per nome: se non dai il tuo codice, nessuno puo' trovarti.
-- ATTENZIONE: i messaggi stanno sul server in chiaro (non ancora cifrati end-to-end): chi amministra il progetto puo' leggerli.
-- Va scritto nell'informativa. Scrittura solo tramite funzioni. Idempotente.
-- =====================================================================================================
alter table public.social_profiles add column if not exists friend_code text;
create unique index if not exists social_profiles_friend_code on public.social_profiles (friend_code);

create or replace function public.my_friend_code() returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c text; i int;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select friend_code into c from public.social_profiles where user_id = uid;
  if not found then raise exception 'profilo_pubblico_mancante' using errcode = 'P0001'; end if;
  if c is not null then return c; end if;
  for i in 1..20 loop
    c := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 8));
    begin
      update public.social_profiles set friend_code = c where user_id = uid;
      return c;
    exception when unique_violation then null;
    end;
  end loop;
  raise exception 'codice_non_creato' using errcode = 'P0001';
end $$;

create table if not exists public.friendships (
  user_low     uuid not null references auth.users (id) on delete cascade,
  user_high    uuid not null references auth.users (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  status       text not null check (status in ('pending', 'accepted', 'blocked')),
  blocked_by   uuid references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low < user_high)
);
alter table public.friendships enable row level security;
revoke all on public.friendships from public, anon, authenticated;
grant select on public.friendships to authenticated;
drop policy if exists fr_read on public.friendships;
create policy fr_read on public.friendships for select to authenticated using (auth.uid() in (user_low, user_high));

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.friendships where user_low = least(a, b) and user_high = greatest(a, b) and status = 'accepted');
$$;

create or replace function public.friend_request(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); other uuid; lo uuid; hi uuid; f public.friendships; recent int;
begin
  if me is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select count(*) into recent from public.friendships where requested_by = me and created_at > now() - interval '1 hour';
  if recent >= 20 then return jsonb_build_object('ok', false, 'error', 'troppe_richieste'); end if;
  select user_id into other from public.social_profiles where friend_code = upper(btrim(coalesce(p_code, '')));
  if other is null or other = me then return jsonb_build_object('ok', false, 'error', 'codice_non_valido'); end if;
  lo := least(me, other); hi := greatest(me, other);
  select * into f from public.friendships where user_low = lo and user_high = hi;
  if found then
    if f.status = 'blocked' then return jsonb_build_object('ok', false, 'error', 'codice_non_valido'); end if;
    if f.status = 'accepted' then return jsonb_build_object('ok', true, 'status', 'accepted'); end if;
    if f.requested_by <> me then
      update public.friendships set status = 'accepted', updated_at = now() where user_low = lo and user_high = hi;
      return jsonb_build_object('ok', true, 'status', 'accepted');
    end if;
    return jsonb_build_object('ok', true, 'status', 'pending');
  end if;
  insert into public.friendships (user_low, user_high, requested_by, status) values (lo, hi, me, 'pending');
  return jsonb_build_object('ok', true, 'status', 'pending');
end $$;

create or replace function public.friend_respond(p_other uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); lo uuid := least(auth.uid(), p_other); hi uuid := greatest(auth.uid(), p_other); n int;
begin
  if me is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if p_accept then
    update public.friendships set status = 'accepted', updated_at = now() where user_low = lo and user_high = hi and status = 'pending' and requested_by <> me;
  else
    delete from public.friendships where user_low = lo and user_high = hi and status = 'pending' and requested_by <> me;
  end if;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n > 0);
end $$;

-- toglie un amico o ritira/annulla una richiesta; non toglie un blocco messo dall'altra persona
create or replace function public.friend_remove(p_other uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); n int;
begin
  if me is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  delete from public.friendships where user_low = least(me, p_other) and user_high = greatest(me, p_other) and (status <> 'blocked' or blocked_by = me);
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n > 0);
end $$;

create or replace function public.friend_block(p_other uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if p_other = me then return jsonb_build_object('ok', false); end if;
  insert into public.friendships (user_low, user_high, requested_by, status, blocked_by) values (least(me, p_other), greatest(me, p_other), me, 'blocked', me)
  on conflict (user_low, user_high) do update set status = 'blocked', blocked_by = me, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- la lista: amici, richieste ricevute e inviate, persone bloccate da me. Chi mi ha bloccato non compare.
create or replace function public.friends_list() returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', o.id, 'name', coalesce(p.display_name, 'Utente'), 'status', case when f.status = 'pending' then (case when f.requested_by = me then 'pending_out' else 'pending_in' end) when f.status = 'blocked' then 'blocked' else 'accepted' end, 'since', f.updated_at)
      order by f.updated_at desc)
    from public.friendships f
    cross join lateral (select case when f.user_low = me then f.user_high else f.user_low end as id) o
    left join public.social_profiles p on p.user_id = o.id
    where me in (f.user_low, f.user_high) and (f.status <> 'blocked' or f.blocked_by = me)), '[]'::jsonb);
end $$;

-- ---- messaggi diretti ----------------------------------------------------------------------------------
create table if not exists public.dm_messages (
  id         uuid primary key default gen_random_uuid(),
  sender     uuid not null references auth.users (id) on delete cascade,
  recipient  uuid not null references auth.users (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 4000),
  client_id  text check (client_id is null or char_length(client_id) <= 64),
  created_at timestamptz not null default now(),
  read_at    timestamptz,
  check (sender <> recipient)
);
create unique index if not exists dm_messages_client on public.dm_messages (sender, client_id) where client_id is not null;
create index if not exists dm_messages_recipient on public.dm_messages (recipient, created_at desc);
create index if not exists dm_messages_sender on public.dm_messages (sender, created_at desc);
alter table public.dm_messages enable row level security;
revoke all on public.dm_messages from public, anon, authenticated;
grant select, insert on public.dm_messages to authenticated;
drop policy if exists dm_read on public.dm_messages;
drop policy if exists dm_send on public.dm_messages;
create policy dm_read on public.dm_messages for select to authenticated using (auth.uid() in (sender, recipient));
create policy dm_send on public.dm_messages for insert to authenticated with check (sender = auth.uid() and public.are_friends(sender, recipient));

create or replace function public.dm_mark_read(p_other uuid) returns void
language sql security definer set search_path = '' as $$
  update public.dm_messages set read_at = now() where recipient = auth.uid() and sender = p_other and read_at is null;
$$;

revoke all on function public.my_friend_code() from public, anon, authenticated;
revoke all on function public.are_friends(uuid, uuid) from public, anon, authenticated;
revoke all on function public.friend_request(text) from public, anon, authenticated;
revoke all on function public.friend_respond(uuid, boolean) from public, anon, authenticated;
revoke all on function public.friend_remove(uuid) from public, anon, authenticated;
revoke all on function public.friend_block(uuid) from public, anon, authenticated;
revoke all on function public.friends_list() from public, anon, authenticated;
revoke all on function public.dm_mark_read(uuid) from public, anon, authenticated;
grant execute on function public.my_friend_code() to authenticated;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.friend_request(text) to authenticated;
grant execute on function public.friend_respond(uuid, boolean) to authenticated;
grant execute on function public.friend_remove(uuid) to authenticated;
grant execute on function public.friend_block(uuid) to authenticated;
grant execute on function public.friends_list() to authenticated;
grant execute on function public.dm_mark_read(uuid) to authenticated;

-- messaggi in tempo reale (Supabase Realtime rispetta le regole RLS)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'dm_messages') then
    alter publication supabase_realtime add table public.dm_messages;
  end if;
end $$;

-- ===== supabase/migrations/0008_account_complete.sql =====
-- 0008: "account completo" solo se ci sono nome, data di nascita e consenso. Il profilo vuoto che il server crea da solo
-- al primo accesso (0001, handle_new_user) non conta: altrimenti l'app salta il modulo dei dati. Idempotente.
create or replace function public.account_get() returns jsonb
language sql security invoker stable set search_path = '' as $$
  select coalesce((select jsonb_build_object('complete', true, 'nome', nome, 'cognome', cognome, 'paese', paese, 'citta', citta, 'cap', cap, 'via', via, 'versione', consenso_versione)
                   from public.profiles
                   where user_id = auth.uid() and btrim(coalesce(nome, '')) <> '' and data_nascita is not null and consenso_il is not null), jsonb_build_object('complete', false));
$$;
revoke all on function public.account_get() from public, anon, authenticated;
grant execute on function public.account_get() to authenticated;


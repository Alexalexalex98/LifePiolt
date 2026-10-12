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

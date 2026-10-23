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

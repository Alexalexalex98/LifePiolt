-- Età e moderazione.
--  1. L'app si può usare da 14 anni (età minima dell'account); la PARTE SOCIAL (profilo pubblico, post, follow, ricerca persone, annunci, LifeClub) solo da 16.
--     L'età è quella della data di nascita dell'account: la verifica avviene sul server, non nell'app.
--  2. Chi gestisce l'app (app_admins) vede le segnalazioni, le chiude e può togliere un contenuto, avvisare, sospendere dal social o chiudere l'accesso al social.
--     Una sospensione vale per tutta la parte social; il resto dell'app continua a funzionare.
--  3. Le segnalazioni urgenti (minorenni, contenuti illegali) mandano subito una notifica agli amministratori.
create or replace function public.min_age_years() returns int language sql immutable as $$ select 14 $$;
create or replace function public.social_min_age_years() returns int language sql immutable as $$ select 16 $$;

create table if not exists public.app_admins (user_id uuid primary key references auth.users (id) on delete cascade, created_at timestamptz not null default now());
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;

create table if not exists public.user_sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('warning', 'suspend_social', 'ban_social')),
  reason text not null default '' check (char_length(reason) <= 500),
  report_id uuid,
  until timestamptz,                         -- vuoto = senza scadenza
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists user_sanctions_user on public.user_sanctions (user_id, created_at desc);
alter table public.user_sanctions enable row level security;
create policy us_own on public.user_sanctions for select to authenticated using (user_id = auth.uid());
revoke all on public.user_sanctions from anon;
revoke insert, update, delete on public.user_sanctions from authenticated;

create or replace function public._is_admin(p_user uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.app_admins where user_id = p_user) $$;
revoke all on function public._is_admin(uuid) from public, anon, authenticated;

-- Ha almeno 16 anni (data di nascita dell'account)?
create or replace function public._age_ok(p_user uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles p where p.user_id = p_user and p.data_nascita is not null and p.data_nascita <= (current_date - make_interval(years => public.social_min_age_years()))::date) $$;
revoke all on function public._age_ok(uuid) from public, anon;
grant execute on function public._age_ok(uuid) to authenticated;

-- Può usare la parte social? Almeno 16 anni e nessuna sospensione attiva.
create or replace function public._social_ok(p_user uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select p_user is not null and public._age_ok(p_user)
  and not exists (select 1 from public.user_sanctions s where s.user_id = p_user and s.kind in ('suspend_social', 'ban_social') and (s.until is null or s.until > now())) $$;
revoke all on function public._social_ok(uuid) from public, anon;
grant execute on function public._social_ok(uuid) to authenticated;

create or replace function public._require_social() returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if not public._age_ok(auth.uid()) then raise exception 'social_eta_minima' using errcode = 'P0001'; end if;
  if not public._social_ok(auth.uid()) then raise exception 'social_sospeso' using errcode = 'P0001'; end if;
end $$;
revoke all on function public._require_social() from public, anon, authenticated;

-- Lo stato per l'app: può usare il social? se no, perché; se è un amministratore.
create or replace function public.my_social_status() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); s record;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select kind, until, reason into s from public.user_sanctions where user_id = uid and kind in ('suspend_social', 'ban_social') and (until is null or until > now()) order by created_at desc limit 1;
  return jsonb_build_object('allowed', public._social_ok(uid), 'age_ok', public._age_ok(uid), 'min_age', public.social_min_age_years(),
    'sanction', case when s.kind is null then null else jsonb_build_object('kind', s.kind, 'until', s.until, 'reason', s.reason) end, 'admin', public._is_admin(uid));
end $$;
revoke all on function public.my_social_status() from public, anon;
grant execute on function public.my_social_status() to authenticated;

-- ---------- la parte social richiede età e nessuna sospensione ----------
drop policy if exists sp_read on public.social_profiles;
create policy sp_read on public.social_profiles for select to authenticated using (public._social_ok(auth.uid()) and (
  user_id = auth.uid() or discoverable
  or exists (select 1 from public.social_follows f where (f.follower_id = auth.uid() and f.followed_id = user_id) or (f.followed_id = auth.uid() and f.follower_id = user_id))));
drop policy if exists sp_write on public.social_profiles;
drop policy if exists sp_ins on public.social_profiles;
drop policy if exists sp_upd on public.social_profiles;
drop policy if exists sp_del on public.social_profiles;
create policy sp_ins on public.social_profiles for insert to authenticated with check (user_id = auth.uid() and public._social_ok(auth.uid()));
create policy sp_upd on public.social_profiles for update to authenticated using (user_id = auth.uid() and public._social_ok(auth.uid())) with check (user_id = auth.uid());
create policy sp_del on public.social_profiles for delete to authenticated using (user_id = auth.uid());
drop policy if exists po_read on public.social_posts;
create policy po_read on public.social_posts for select to authenticated using (deleted_at is null and public._social_ok(auth.uid()) and public._aud_ok(author_id, audience));
drop policy if exists po_ins on public.social_posts;
create policy po_ins on public.social_posts for insert to authenticated with check (author_id = auth.uid() and public._social_ok(auth.uid()));
drop policy if exists co_read on public.social_comments;
create policy co_read on public.social_comments for select to authenticated using (deleted_at is null and public._social_ok(auth.uid()) and exists (select 1 from public.social_posts p where p.id = post_id));
drop policy if exists co_ins on public.social_comments;
create policy co_ins on public.social_comments for insert to authenticated with check (author_id = auth.uid() and public._social_ok(auth.uid()) and exists (select 1 from public.social_posts p where p.id = post_id));
drop policy if exists li_read on public.social_likes;
create policy li_read on public.social_likes for select to authenticated using (public._social_ok(auth.uid()) and exists (select 1 from public.social_posts p where p.id = post_id));
drop policy if exists li_ins on public.social_likes;
create policy li_ins on public.social_likes for insert to authenticated with check (user_id = auth.uid() and public._social_ok(auth.uid()) and exists (select 1 from public.social_posts p where p.id = post_id));
drop policy if exists sl_read on public.social_listings;
create policy sl_read on public.social_listings for select to authenticated using (public._social_ok(auth.uid()) and (author_id = auth.uid() or (deleted_at is null and public._aud_ok(author_id, audience))));
drop policy if exists sl_ins on public.social_listings;
create policy sl_ins on public.social_listings for insert to authenticated with check (author_id = auth.uid() and public._social_ok(auth.uid()));

-- Le funzioni delle persone: stesse di prima, ma prima controllano l'età e le sospensioni. Le originali restano solo per le nuove (non chiamabili dall'app).
alter function public.people_me(text) rename to _people_me;
alter function public.people_search(text) rename to _people_search;
alter function public.people_preview(uuid) rename to _people_preview;
alter function public.people_by_code(text) rename to _people_by_code;
alter function public.people_follow(uuid) rename to _people_follow;
alter function public.people_rate(uuid, integer, text, text, boolean) rename to _people_rate;
revoke all on function public._people_me(text), public._people_search(text), public._people_preview(uuid), public._people_by_code(text), public._people_follow(uuid), public._people_rate(uuid, integer, text, text, boolean) from public, anon, authenticated;

create or replace function public.people_me(p_name text default null) returns jsonb language plpgsql security definer set search_path = '' as $$ begin perform public._require_social(); return public._people_me(p_name); end $$;
create or replace function public.people_search(p_q text) returns jsonb language plpgsql security definer set search_path = '' as $$ begin perform public._require_social(); return public._people_search(p_q); end $$;
create or replace function public.people_preview(p_user uuid) returns jsonb language plpgsql security definer set search_path = '' as $$ begin perform public._require_social(); return public._people_preview(p_user); end $$;
create or replace function public.people_by_code(p_code text) returns jsonb language plpgsql security definer set search_path = '' as $$ begin perform public._require_social(); return public._people_by_code(p_code); end $$;
create or replace function public.people_follow(p_user uuid) returns text language plpgsql security definer set search_path = '' as $$ begin perform public._require_social(); return public._people_follow(p_user); end $$;
create or replace function public.people_rate(p_to uuid, p_stars integer, p_kind text default 'profile', p_ref text default 'profile', p_helpful boolean default null) returns jsonb language plpgsql security definer set search_path = '' as $$ begin perform public._require_social(); return public._people_rate(p_to, p_stars, p_kind, p_ref, p_helpful); end $$;
revoke all on function public.people_me(text), public.people_search(text), public.people_preview(uuid), public.people_by_code(text), public.people_follow(uuid), public.people_rate(uuid, integer, text, text, boolean) from public, anon;
grant execute on function public.people_me(text), public.people_search(text), public.people_preview(uuid), public.people_by_code(text), public.people_follow(uuid), public.people_rate(uuid, integer, text, text, boolean) to authenticated;

-- ---------- segnalazioni: chi le gestisce ----------
alter table public.content_reports add column if not exists author_id uuid references auth.users (id) on delete set null;
alter table public.content_reports add column if not exists decided_by uuid references auth.users (id) on delete set null;
alter table public.content_reports add column if not exists decided_at timestamptz;
alter table public.content_reports add column if not exists decision text check (decision is null or decision in ('dismiss', 'remove', 'warn', 'suspend', 'ban'));

drop function if exists public.report_content(text, text, text, text, text, text);
create or replace function public.report_content(p_kind text, p_ref text, p_label text, p_author text, p_reason text, p_note text default '', p_author_id uuid default null) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); rid uuid;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if (select count(*) from public.content_reports where reporter_id = uid and created_at > now() - interval '1 day') >= 30 then raise exception 'troppe_segnalazioni' using errcode = 'P0001'; end if;
  insert into public.content_reports (reporter_id, kind, ref, label, author, author_id, reason, note, urgent)
  values (uid, p_kind, left(p_ref, 200), left(coalesce(p_label, ''), 200), left(coalesce(p_author, ''), 120), p_author_id, p_reason, left(coalesce(p_note, ''), 1000), p_reason in ('minori', 'illegale'))
  on conflict (reporter_id, kind, ref, reason) do update set note = excluded.note, created_at = now()
  returning id into rid;
  return rid;
end $$;
revoke all on function public.report_content(text, text, text, text, text, text, uuid) from public, anon;
grant execute on function public.report_content(text, text, text, text, text, text, uuid) to authenticated;

-- Le urgenti avvisano subito chi gestisce l'app.
create or replace function public._report_urgent() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare a uuid;
begin
  if new.urgent and to_regprocedure('public._push_send(uuid,text,text,jsonb)') is not null then
    for a in select user_id from public.app_admins loop
      perform public._push_send(a, 'Segnalazione urgente', left(coalesce(nullif(new.label, ''), new.kind), 120) || ' · ' || new.reason, jsonb_build_object('kind', 'admin_report', 'ref', 'admin', 'report', new.id));
    end loop;
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists content_reports_urgent on public.content_reports;
create trigger content_reports_urgent after insert on public.content_reports for each row execute function public._report_urgent();

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$ select public._is_admin(auth.uid()) $$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.admin_reports(p_status text default 'open', p_limit integer default 100) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public._is_admin(auth.uid()) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.urgent desc, x.created_at desc) from (
    select r.id, r.kind, r.ref, r.label, r.author, r.author_id, r.reason, r.note, r.urgent, r.status, r.decision, r.created_at,
      (select count(*) from public.content_reports o where o.kind = r.kind and o.ref = r.ref) as times
    from public.content_reports r where r.status = p_status order by r.urgent desc, r.created_at desc limit least(greatest(p_limit, 1), 200)) x), '[]'::jsonb);
end $$;
revoke all on function public.admin_reports(text, integer) from public, anon;
grant execute on function public.admin_reports(text, integer) to authenticated;

-- Toglie un contenuto dal server (per ora post e annunci; il LifeClub lo aggiunge la sua migrazione). Restituisce l'autore, se lo conosce.
create or replace function public._remove_content(p_kind text, p_ref text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare u uuid; rid uuid;
begin
  begin rid := p_ref::uuid; exception when others then return null; end;
  if p_kind in ('post', 'comment') then
    update public.social_posts set deleted_at = coalesce(deleted_at, now()) where id = rid returning author_id into u;
  elsif p_kind in ('seminar', 'service', 'idea') then
    update public.social_listings set deleted_at = coalesce(deleted_at, now()) where id = rid returning author_id into u;
  end if;
  return u;
end $$;
revoke all on function public._remove_content(text, text) from public, anon, authenticated;

create or replace function public._content_author(p_kind text, p_ref text) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare u uuid; rid uuid;
begin
  begin rid := p_ref::uuid; exception when others then return null; end;
  if p_kind in ('post', 'comment') then select author_id into u from public.social_posts where id = rid;
  elsif p_kind in ('seminar', 'service', 'idea') then select author_id into u from public.social_listings where id = rid; end if;
  return u;
end $$;
revoke all on function public._content_author(text, text) from public, anon, authenticated;

-- Decide su una segnalazione: archivia, toglie il contenuto, avvisa, sospende dal social (p_days giorni) o chiude l'accesso al social.
create or replace function public.admin_report_decide(p_id uuid, p_action text, p_note text default '', p_days integer default 7) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); r public.content_reports; target uuid; k text; until_t timestamptz;
begin
  if not public._is_admin(uid) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  if p_action not in ('dismiss', 'remove', 'warn', 'suspend', 'ban') then raise exception 'azione_non_valida' using errcode = 'P0001'; end if;
  select * into r from public.content_reports where id = p_id for update;
  if not found then raise exception 'non_trovata' using errcode = 'P0001'; end if;
  target := coalesce(r.author_id, public._content_author(r.kind, r.ref));
  if p_action = 'remove' then perform public._remove_content(r.kind, r.ref); end if;
  if p_action in ('warn', 'suspend', 'ban') then
    if target is null then raise exception 'autore_sconosciuto' using errcode = 'P0001'; end if;
    k := case p_action when 'warn' then 'warning' when 'suspend' then 'suspend_social' else 'ban_social' end;
    until_t := case when p_action = 'suspend' then now() + make_interval(days => least(greatest(p_days, 1), 365)) else null end;
    insert into public.user_sanctions (user_id, kind, reason, report_id, until, created_by) values (target, k, left(coalesce(nullif(p_note, ''), r.reason), 500), r.id, until_t, uid);
    if to_regprocedure('public._push_send(uuid,text,text,jsonb)') is not null then
      perform public._push_send(target, case p_action when 'warn' then 'Avviso dalla community' when 'suspend' then 'Social sospeso' else 'Accesso al social chiuso' end,
        case p_action when 'warn' then 'Un tuo contenuto non rispetta le regole di LifePilot.' when 'suspend' then 'Un tuo contenuto non rispetta le regole: il social è sospeso per ' || greatest(p_days, 1) || ' giorni. Il resto dell''app funziona.' else 'Per ripetute violazioni delle regole l''accesso al social è stato chiuso. Il resto dell''app funziona.' end,
        jsonb_build_object('kind', 'sanction', 'ref', 'system'));
    end if;
  end if;
  update public.content_reports set status = case p_action when 'dismiss' then 'dismissed' when 'remove' then 'actioned' else 'actioned' end, decision = p_action, decided_by = uid, decided_at = now(),
    note = case when p_note <> '' then left(note || ' | ' || p_note, 1000) else note end where id = p_id;
  -- le segnalazioni uguali (stesso contenuto e motivo) si chiudono insieme
  update public.content_reports set status = case p_action when 'dismiss' then 'dismissed' else 'actioned' end, decision = p_action, decided_by = uid, decided_at = now()
    where status = 'open' and kind = r.kind and ref = r.ref and id <> p_id and reason = r.reason;
  return jsonb_build_object('ok', true, 'target', target);
end $$;
revoke all on function public.admin_report_decide(uuid, text, text, integer) from public, anon;
grant execute on function public.admin_report_decide(uuid, text, text, integer) to authenticated;

-- Chi ha una sospensione può toglierla solo un amministratore.
create or replace function public.admin_lift_sanction(p_user uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public._is_admin(auth.uid()) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  update public.user_sanctions set until = now() where user_id = p_user and kind in ('suspend_social', 'ban_social') and (until is null or until > now());
end $$;
revoke all on function public.admin_lift_sanction(uuid) from public, anon;
grant execute on function public.admin_lift_sanction(uuid) to authenticated;

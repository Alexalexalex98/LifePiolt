-- Segnalazioni dei contenuti (LifeClub, post, profili, annunci...): arrivano a chi gestisce l'app, non restano solo sul telefono di chi segnala.
-- Chi segnala vede solo le sue. Le urgenti (minorenni, contenuti illegali) sono marcate per essere guardate per prime. Si leggono dal pannello di Supabase.
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('post', 'comment', 'seminar', 'service', 'community', 'profile', 'idea', 'club', 'clubitem')),
  ref text not null check (char_length(ref) between 1 and 200),
  label text not null default '' check (char_length(label) <= 200),
  author text not null default '' check (char_length(author) <= 120),
  reason text not null check (reason in ('spam', 'offensivo', 'truffa', 'falso', 'esplicito', 'minori', 'copyright', 'illegale', 'adulti', 'altro')),
  note text not null default '' check (char_length(note) <= 1000),
  urgent boolean not null default false,
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, kind, ref, reason)
);
create index if not exists content_reports_open on public.content_reports (urgent desc, created_at desc) where status = 'open';
alter table public.content_reports enable row level security;
create policy cr_own on public.content_reports for select to authenticated using (reporter_id = auth.uid());
revoke insert, update, delete on public.content_reports from anon, authenticated;
revoke all on public.content_reports from anon;

create or replace function public.report_content(p_kind text, p_ref text, p_label text, p_author text, p_reason text, p_note text default '') returns uuid
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); rid uuid;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if (select count(*) from public.content_reports where reporter_id = uid and created_at > now() - interval '1 day') >= 30 then raise exception 'troppe_segnalazioni' using errcode = 'P0001'; end if;
  insert into public.content_reports (reporter_id, kind, ref, label, author, reason, note, urgent)
  values (uid, p_kind, left(p_ref, 200), left(coalesce(p_label, ''), 200), left(coalesce(p_author, ''), 120), p_reason, left(coalesce(p_note, ''), 1000), p_reason in ('minori', 'illegale'))
  on conflict (reporter_id, kind, ref, reason) do update set note = excluded.note, created_at = now()
  returning id into rid;
  return rid;
end $$;
revoke all on function public.report_content(text, text, text, text, text, text) from public, anon;
grant execute on function public.report_content(text, text, text, text, text, text) to authenticated;

-- Riunioni: si entra e si esce liberamente. La registrazione e la trascrizione partono da sole per chi è dentro (lo dice la policy).
-- Quando esce l'ultimo la riunione si chiude da sola. Solo funzioni nuove: nessuna modifica alle tabelle.
create or replace function public.team_meeting_join(p_id text) returns public.team_meetings
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); m public.team_meetings;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if not public.can_see_meeting(p_id) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  select * into m from public.team_meetings where id = p_id for update;
  if m.deleted or m.status = 'ended' then raise exception 'riunione_chiusa' using errcode = 'P0001'; end if;
  update public.team_meetings set status = 'live',
    rec_users = (select array_agg(distinct x) from unnest(m.rec_users || uid) x),
    rec_by = coalesce(m.rec_by, uid)
  where id = p_id returning * into m;
  return m;
end $$;

-- Esce dalla riunione. Se era l'ultimo la chiude: chi esce per ultimo riceve la riunione con status 'ended' e prepara appunti e verbale.
create or replace function public.team_meeting_leave(p_id text) returns public.team_meetings
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); m public.team_meetings; rest uuid[];
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  if not public.can_see_meeting(p_id) then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  select * into m from public.team_meetings where id = p_id for update;
  rest := array_remove(m.rec_users, uid);
  update public.team_meetings set rec_users = rest,
    rec_by = case when cardinality(rest) = 0 then null when m.rec_by = uid then rest[1] else m.rec_by end,
    status = case when cardinality(rest) = 0 and m.status = 'live' then 'ended' else m.status end
  where id = p_id returning * into m;
  return m;
end $$;

-- Salva appunti e verbale: chi ha creato la riunione, un amministratore o chi è uscito per ultimo (riunione chiusa senza appunti).
create or replace function public.team_meeting_end(p_id text, p_notes jsonb, p_minutes text) returns void
language plpgsql security definer set search_path = ''
as $$
declare m public.team_meetings;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into m from public.team_meetings where id = p_id for update;
  if not found then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  if not (m.created_by = auth.uid() or public.is_team_member(m.team_id, 'admin') or (m.status = 'ended' and m.notes is null and public.can_see_meeting(p_id))) then
    raise exception 'non_autorizzato' using errcode = 'P0001';
  end if;
  update public.team_meetings set status = 'ended', rec_users = '{}', rec_by = null, notes = p_notes, minutes = left(p_minutes, 20000) where id = p_id;
end $$;

revoke all on function public.team_meeting_join(text), public.team_meeting_leave(text) from public, anon;
grant execute on function public.team_meeting_join(text), public.team_meeting_leave(text) to authenticated;

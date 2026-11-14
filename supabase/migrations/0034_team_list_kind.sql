-- L'elenco dei team dice anche di che tipo sono (workspace o gruppo di lavoro), così l'app tiene i gruppi fuori dal Workspace. Solo un campo in più.
create or replace function public.team_list() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'role', m.role, 'kind', t.kind, 'members', (select count(*) from public.team_members x where x.team_id = t.id)) order by t.created_at), '[]'::jsonb)
  from public.team_members m join public.teams t on t.id = m.team_id where m.user_id = auth.uid()
$$;

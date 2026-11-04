-- Workspace Lavoro, punto 3: comunicazione. Canali (generale, annunci, uno per progetto), messaggi con risposte, fissati, assenza con risposta automatica.
-- Solo oggetti nuovi. Ogni permesso lo controlla il server.
create table if not exists public.team_messages (
  id bigint generated always as identity primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  channel text not null check (char_length(channel) between 1 and 80),    -- 'general', 'ann' (annunci) oppure l'id di un progetto
  author uuid not null references auth.users (id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 4000),
  reply_to bigint references public.team_messages (id) on delete set null,
  mentions uuid[] not null default '{}',
  pinned boolean not null default false,
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists team_messages_ch on public.team_messages (team_id, channel, id desc);

create table if not exists public.team_away (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  until date not null,
  message text not null default '' check (char_length(message) <= 500),
  primary key (team_id, user_id)
);

alter table public.team_messages enable row level security;
alter table public.team_away enable row level security;

create policy msg_select on public.team_messages for select to authenticated using (public.is_team_member(team_id) and not deleted);
-- gli annunci li scrivono solo gli amministratori; gli altri canali tutti i membri
create policy msg_insert on public.team_messages for insert to authenticated
  with check (author = auth.uid() and public.is_team_member(team_id) and (channel <> 'ann' or public.is_team_member(team_id, 'admin')) and pinned = false and deleted = false);
create policy msg_update on public.team_messages for update to authenticated
  using (author = auth.uid() or public.is_team_member(team_id, 'admin')) with check (public.is_team_member(team_id));
revoke update on public.team_messages from authenticated;
grant update (deleted) on public.team_messages to authenticated;       -- cancellare il proprio (o, da amministratore, un messaggio)

-- Fissa o stacca un messaggio (solo amministratori).
create or replace function public.team_message_pin(p_id bigint, p_on boolean) returns void
language plpgsql security definer set search_path = ''
as $$
declare m public.team_messages;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = 'PT401'; end if;
  select * into m from public.team_messages where id = p_id;
  if not found or not public.is_team_member(m.team_id, 'admin') then raise exception 'non_autorizzato' using errcode = 'P0001'; end if;
  update public.team_messages set pinned = p_on where id = p_id;
end $$;
revoke all on function public.team_message_pin(bigint, boolean) from public, anon;
grant execute on function public.team_message_pin(bigint, boolean) to authenticated;

-- Le menzioni devono essere membri del team.
create or replace function public._messages_check() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from unnest(new.mentions) a where not exists (select 1 from public.team_members m where m.team_id = new.team_id and m.user_id = a)) then
    raise exception 'invitato_non_nel_team' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger team_messages_check before insert on public.team_messages for each row execute function public._messages_check();
revoke all on function public._messages_check() from public, anon, authenticated;

-- Assenza: la vedono i membri del team (serve alla risposta automatica), la imposta ognuno per sé.
create policy away_select on public.team_away for select to authenticated using (public.is_team_member(team_id));
create policy away_insert on public.team_away for insert to authenticated with check (user_id = auth.uid() and public.is_team_member(team_id));
create policy away_update on public.team_away for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy away_delete on public.team_away for delete to authenticated using (user_id = auth.uid());

alter publication supabase_realtime add table public.team_messages;
alter publication supabase_realtime add table public.team_away;

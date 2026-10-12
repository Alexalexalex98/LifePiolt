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

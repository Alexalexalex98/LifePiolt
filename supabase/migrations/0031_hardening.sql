-- Rinforzo (da applicare quando il database torna raggiungibile). Non cambia i dati.
-- team_page_save: la funzione rifiuta già chi non ha fatto l'accesso, ma non c'è motivo che gli anonimi possano chiamarla.
revoke all on function public.team_page_save(jsonb) from public, anon;
grant execute on function public.team_page_save(jsonb) to authenticated;

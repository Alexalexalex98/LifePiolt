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

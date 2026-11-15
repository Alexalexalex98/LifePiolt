-- Età minima: 16 anni per l'account e per il social. Sotto i 16 si usa il resto dell'app (senza account).
create or replace function public.min_age_years() returns int language sql immutable as $$ select 16 $$;

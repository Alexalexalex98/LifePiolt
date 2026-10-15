# Server gratuito (Supabase) — guida passo-passo

Costo: **0**. Nessuna carta di credito richiesta per il piano Free (verifica i limiti aggiornati su https://supabase.com/pricing prima di lanciare).
Limiti indicativi del piano Free: circa 500 MB di database, 1 GB di file, 50.000 utenti attivi al mese. Un progetto Free **va in pausa dopo ~7 giorni senza richieste**: i dati restano, si riattiva dalla dashboard (con utenti reali non succede).

## 1. Crea il progetto (5 minuti)
1. Vai su https://supabase.com e accedi (anche con GitHub).
2. **New project** → nome `lifepilot`, regione **Frankfurt (eu-central-1)** (più vicina all'Italia/Svizzera), scegli una password del database e **salvala**.
3. Attendi un paio di minuti.

## 2. Crea le tabelle e le funzioni
1. Nella dashboard apri **SQL Editor** → **New query**.
2. Incolla il contenuto di `supabase/migrations/0001_init.sql` ed esegui (**Run**). Poi lo stesso con `0002_sync_functions.sql` e `0003_storage_maintenance.sql`, **in quest'ordine**.
3. Sono idempotenti: se sbagli puoi rieseguirli.

## 3. Accesso con email e codice
1. **Authentication → Sign In / Providers → Email**: attiva *Enable Email provider*; lascia attivo *Confirm email*.
2. **Authentication → Email Templates → Magic Link**: nel testo usa il codice: sostituisci il link con `{{ .Token }}` (es. «Il tuo codice LifePilot: {{ .Token }}»). L'app chiede il codice a 6 cifre.
3. Il piano Free invia poche email all'ora con il mittente di Supabase: va bene per provare. Per il lancio si collega un SMTP gratuito (es. Resend/Brevo, piani free) in **Authentication → SMTP Settings**.

## 4. Copia indirizzo e chiave pubblica
**Project Settings → API**: copia **Project URL** e la chiave **anon / public** (non è un segreto; **mai** la `service_role`).

## 5. Collega l'app
* Telefono/app: **Impostazioni → Sincronizzazione → Server**: incolla indirizzo e chiave, **Collega**, poi in «Il tuo account» scrivi l'email, **Invia il codice**, inserisci il codice, **Accedi**.
* Oppure nella build: crea `.env.local` con
  ```
  EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
  ```
* Poi, per ogni categoria che vuoi sincronizzare, attivala in **Sincronizzazione** (di default tutto resta solo sul telefono).

## Cosa fa e cosa NON fa ancora
* **Fa**: stessi dati (task, note, obiettivi, viaggi, post, ecc. delle categorie attivate) su più dispositivi dello stesso account, con conflitti gestiti sul telefono. Salute clinica, finanze, documenti, carte **non** vanno mai sul server.
* **Non fa ancora**: social tra utenti diversi (feed pubblico, chat tra persone, LifePoints tra utenti) — richiede tabelle condivise e regole di moderazione, è il passo successivo; cifratura end-to-end dei payload (chat restano ferme finché non esiste); sincronizzazione di foto/video/file; chiamate (serve un servizio a parte).
* Il **sito per PC** userà lo stesso server e lo stesso accesso.

## Sicurezza
* Tutte le tabelle hanno RLS: ogni utente vede solo le proprie righe.
* L'app contiene solo la chiave anon. La `service_role` non deve mai stare nell'app né nel repository.

## Verifica fatta
Le tre migrazioni sono state eseguite su un Postgres 16 locale (con le tabelle `auth` simulate): push idempotente (stesso cambio inviato due volte = confermato una volta), pull per cursore e isolamento tra due utenti (l'utente B non vede i dati di A) funzionano. Il collegamento con un vero progetto Supabase non è ancora stato provato: serve il tuo progetto (passo 1-4).

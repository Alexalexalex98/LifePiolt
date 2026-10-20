# Server sociale (stessi post su iPhone e Android)

Il server è lo stesso Supabase già usato per l'accesso e la sincronizzazione privata. Questo livello aggiunge **solo contenuti che l'utente pubblica**
(post, mi piace, commenti, chi segui) e, se l'utente lo sceglie, i comandi che ha insegnato a Theia.
Salute, finanze, chat, documenti e carte **non** passano di qui (vedi `docs/privacy-model.md`).

## Cosa fa oggi
- Un post creato nell'app viene pubblicato (con foto e video, caricati nell'archivio `social-media`).
- Modifica ed eliminazione del post si riflettono sul server.
- I mi piace vanno al server; i cuori si riaccendono su un altro telefono.
- I post degli altri (e i tuoi da un altro telefono) arrivano nel feed all'avvio e quando l'app torna in primo piano.
- Se il server non è collegato o non c'è l'accesso, l'app funziona come prima, solo sul telefono.

## Cosa NON fa ancora
Commenti, chi segui, community e storie restano sul telefono (le tabelle `social_comments` e `social_follows` sono pronte, manca il collegamento).
Nessun aggiornamento in tempo reale: il feed si aggiorna all'avvio e al ritorno in primo piano.

## Come attivarlo (una volta)
1. Supabase > SQL Editor: incolla ed esegui `supabase/migrations/0004_social.sql` (si può rieseguire).
2. Supabase > Storage: deve comparire il bucket `social-media` (lo crea la migrazione).
3. Nell'app: accedi con la tua email (Impostazioni > Sincronizzazione). Serve `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
4. Su Android la build deve avere le stesse variabili (EAS).

## Sicurezza
- Tutti gli utenti connessi leggono; ognuno scrive solo i propri contenuti (RLS).
- Il nome dell'autore lo mette il server dal profilo pubblico: nessuno pubblica a nome di altri.
- Mi piace e commenti sono contati dal server (trigger).
- Moderazione: tabella `social_reports` (le segnalazioni arrivano al server, da gestire nel pannello Supabase).
- Piano gratuito: attenzione a spazio file (1 GB) e traffico; i video grandi li consumano in fretta.

## Comandi di Theia condivisi
Solo con scelta esplicita dell'utente («Condividi con tutti»). Si condivide la frase (numeri sostituiti da {n}) e l'azione, mai altro.
Un comando di altri si usa solo se ha almeno 2 voti favorevoli e passa il controllo di sicurezza sul telefono (`isSafeShared`):
mai su soldi, messaggi, acquisti, cancellazioni o persone.

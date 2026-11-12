# LifePilot: controllo generale, sicurezza e cosa manca per venderla

Data del controllo: 12 novembre 2026 · ramo `claude/app-store-google-play-ncktn6`

## In breve

- L'app compila, il controllo dei tipi è pulito e i 2096 test automatici passano.
- Ho corretto la causa che bloccava la build dell'APK e alcuni problemi di sicurezza nell'app.
- **Non ho potuto controllare il database dal vivo**: Supabase risulta attivo ma in ibernazione e ha rifiutato ogni interrogazione. Il controllo del server è fatto sulle migrazioni del repo, non sul database reale.
- **Non ho provato l'app su un telefono**: tutto quello che riguarda schermate, fotocamera, scanner e trascinamento va provato a mano.
- I punti più seri da chiudere prima di venderla sono tre: i server AI aperti a chiunque, i LifePoints come denaro, i testi legali incompleti.

---

## 1. Cosa ho controllato

| Controllo | Esito |
|---|---|
| Tipi (`tsc`) | Pulito dopo le correzioni (prima 12 errori) |
| Test automatici | 2096 su 2096 passano |
| Lint su tutta l'app | 983 segnalazioni (640 errori, 343 avvisi): vedi punto 3 |
| Dipendenze (`npm ci`) | Era rotto, ora funziona |
| Vulnerabilità delle dipendenze (`npm audit`) | 12 (3 alte, 8 medie, 1 bassa), tutte negli strumenti di build |
| `expo-doctor` | 18 controlli su 20 passati; i 2 falliti richiedevano la rete di Expo, non raggiungibile da qui |
| Segreti nel repo | Nessuna chiave o token trovato |
| Worker Cloudflare | Letto il codice di `lifepilot-ai2` e `lifepilot-api` |
| Database Supabase | Solo dalle migrazioni: il database non rispondeva |
| Prova su telefono | Non fatta |

## 2. Cosa ho corretto

1. **Build dell'APK bloccata.** `package-lock.json` non era allineato con `package.json` (mancava `expo-speech`). EAS usa `npm ci`, che in quel caso si ferma. Ora è allineato.
2. **Errori di tipo.** Due file del gioco di Theia usavano un tipo che la versione attuale di React non espone più. La cartella `video/` (progetto separato) veniva controllata per sbaglio insieme all'app: l'ho esclusa.
3. **Collegamenti esterni.** I link che arrivano da altri utenti (profili, storie, pagine attività), dall'AI e dai messaggi si aprivano con qualsiasi schema. Ora si aprono solo `https`, `http`, `mailto`, `tel`, `sms` e mappe; vengono rifiutati `file:`, `javascript:`, `intent:`, gli schemi di altre app e gli indirizzi ingannevoli del tipo `banca.it@sito-falso.com`.
4. **Chiamate di riunione.** La finestra della chiamata doveva restare su Jitsi, ma la regola accettava anche `jit.si.sito-falso.com`. Ora il dominio è controllato in modo esatto.
5. **Nome di funzione.** Una funzione normale aveva un nome da "hook" di React e il lint la segnalava come errore: rinominata.
6. **Migrazione di rinforzo scritta ma non applicata** (`0031_hardening.sql`): toglie agli utenti anonimi il permesso di chiamare il salvataggio delle pagine di team. La funzione li rifiuta già, è una protezione in più.

## 3. Cosa ho trovato e non ho corretto

**Lint (983 segnalazioni).** Sono quasi tutte regole nuove del compilatore React: accesso a riferimenti durante il disegno (342), funzioni non pure (123), stato cambiato dentro un effetto (78), componenti creati dentro altri componenti (62), più variabili non usate (145) e import doppi (70). Non sono bug che vedi oggi, ma con il compilatore React attivo possono diventarlo. Non le ho toccate: sono centinaia di modifiche in file che non posso provare a schermo, e il rischio di rompere qualcosa era più alto del beneficio. Vanno sistemate a blocchi, una sezione alla volta, provando sul telefono.

**Dipendenze.** Le 12 vulnerabilità sono negli strumenti di build di Expo (`glob`, `minimatch`, `node-forge`) e in `zod`. Non finiscono nell'app installata sul telefono, tranne `zod`, se viene usato per validare dati che arrivano da fuori. La correzione automatica proposta da npm porterebbe Expo dalla versione 58 alla 52, quindi non l'ho applicata: si risolvono aggiornando Expo quando esce la correzione.

---

## 4. Sicurezza: cosa manca per reggere a un attacco dall'esterno

Nessuna app è inattaccabile. Questo è l'elenco in ordine di gravità di ciò che oggi un estraneo potrebbe sfruttare.

### Grave

**4.1 I server AI rispondono a chiunque, senza account.**
Entrambi i Worker accettano richieste anonime. `lifepilot-api` usa la tua chiave Gemini: chiunque conosca l'indirizzo (è scritto nell'app, quindi è pubblico) può consumare la tua quota o farti arrivare un conto. Il freno è di 30 richieste al minuto per indirizzo IP su `lifepilot-api` e 12 su `lifepilot-ai2`, ma è tenuto in memoria per singola istanza del Worker: non è un limite globale e si aggira cambiando IP.
- Da fare: richiedere sempre l'accesso con account su `lifepilot-api`; limite globale con il Rate Limiting di Cloudflare o un contatore su KV / Durable Object; tetto di spesa sulla chiave Gemini; verifica che la richiesta arrivi dall'app vera (App Attest su iPhone, Play Integrity su Android).
- Non l'ho cambiato io: oggi Theia funziona anche senza account per tua scelta, e chiuderlo cambia il prodotto.

**4.2 Parola d'ordine condivisa dentro l'app.**
`EXPO_PUBLIC_AI_TOKEN` è la stessa parola d'ordine del Worker (`APP_TOKEN`). Tutto ciò che inizia con `EXPO_PUBLIC_` finisce in chiaro nell'app e si estrae in pochi minuti. Chi la trova salta anche i limiti per utente.
- Da fare: togliere `APP_TOKEN` dai Worker di produzione e non compilare mai una build pubblica con `EXPO_PUBLIC_AI_TOKEN` impostata.

**4.3 Nessun limite alla grandezza delle richieste AI.**
`lifepilot-ai2` non controlla la dimensione del corpo; `lifepilot-api` guarda solo l'intestazione `content-length`, che si può omettere. Si possono mandare file enormi per far lavorare il server a vuoto.

**4.4 Il database non è stato verificato dal vivo.**
Dalle migrazioni risulta: 64 tabelle, tutte con la sicurezza per riga attiva; 8 tabelle senza regole di accesso diretto perché si usano solo tramite funzioni; 84 funzioni con privilegi elevati, tutte con `search_path` fissato. Ma il database reale può essere diverso dai file (migrazioni applicate a mano, modifiche dal pannello).
- Da fare appena risponde: lanciare gli "advisor" di sicurezza di Supabase e la verifica su tabelle, regole e funzioni; applicare la migrazione 0031.

### Medio

**4.5 Stanze di riunione pubbliche.** Le chiamate usano il Jitsi pubblico (`meet.jit.si`) con un nome di stanza derivato dall'id della riunione. Chi conosce o indovina il nome entra senza controlli. Per uso aziendale serve un Jitsi proprio o un servizio con accesso tramite token.

**4.6 Cartella dei media social pubblica.** Il contenitore `social-media` è leggibile da tutti (è voluto per i post), accetta file fino a 50 MB e nessun limite sul tipo di file. Chi ha un account può caricarci qualsiasi cosa e usarlo come deposito pubblico. Da fare: limitare ai tipi immagine e video, abbassare la dimensione, quota per utente.

**4.7 Dati visibili a tutti gli iscritti.** Profili social, "mi piace" e chi segue chi sono leggibili da qualsiasi utente registrato. È normale per un social, ma va dichiarato nell'informativa e ogni campo del profilo va trattato come pubblico.

**4.8 Dettagli degli errori mostrati all'esterno.** `lifepilot-api` restituisce al chiamante la risposta d'errore completa di Google. Meglio un messaggio generico e il dettaglio solo nei log.

**4.9 Password dei progetti riservati.** Il controllo è sul server ed è solido per le pagine, ma i file allegati alle pagine riservate non sono coperti dalla password.

**4.10 Piano AI aziendale non applicato sul server.** L'app rispetta l'impostazione, il Worker no: chi modifica l'app lo aggira.

### Basso

- **Disconnessione fuori orario**: vale solo per i promemoria locali, non per le notifiche dal server.
- **CORS aperto (`*`) sui Worker**: accettabile per un'app, da restringere se nasce una versione web.
- **Modalità di prova dell'account** (`EXPO_PUBLIC_ACCOUNT_TEST=1`): codice fisso senza email. Non deve mai essere attiva in una build pubblica.
- **Segnalazione degli errori**: c'è un invio anonimo opzionale, ma nessun servizio di monitoraggio dei crash collegato.

### Già a posto

- Nessun segreto nel repository; nell'app c'è solo la chiave pubblica di Supabase.
- Dati sul telefono cifrati (SQLCipher) e token nel portachiavi del sistema.
- Sicurezza per riga su tutte le tabelle delle migrazioni; permessi per ruolo controllati dal server.
- I PDF generati dall'app neutralizzano il testo inserito dagli utenti.
- Invio di foto e documenti all'AI solo con consenso.
- Codici d'invito ai team casuali, monouso, validi 7 giorni.

---

## 5. Cosa manca per un'app vendibile

### Obbligatorio prima di pubblicare

1. **Testi legali.** Mancano i dati del titolare del trattamento (ragione sociale, indirizzo, contatto privacy) e la revisione di un avvocato su informativa e termini, per Italia e Svizzera (GDPR e nLPD).
2. **LifePoints come denaro.** Punti che si ritirano in denaro e pagamenti tra utenti sono moneta elettronica o servizi di pagamento: servono un'autorizzazione o un partner autorizzato, controlli antiriciclaggio e verifica dell'identità. Inoltre Apple e Google impongono i loro sistemi di acquisto per i contenuti digitali. Senza questo la sezione va tolta o resa solo dimostrativa.
3. **Salute.** Questionari PHQ-9 e WHO-5, analisi del corpo, consigli su farmaci e sintomi: gli store chiedono avvertenze chiare e, oltre una certa soglia, l'app rientra tra i dispositivi medici. Vanno fatti rivedere da professionisti anche i numeri di emergenza e le soglie (acqua, digiuno, esercizi).
4. **Finanza e fisco.** Analisi di titoli, previsioni e dichiarazione fiscale: servono avvertenze "non è consulenza" ben visibili e una verifica delle regole fiscali con un commercialista.
5. **Schede degli store.** Account sviluppatore Apple e Google, dichiarazioni sulla privacy (Data Safety, etichette privacy di Apple, manifest della privacy su iOS), classificazione per età, indirizzo pubblico dell'informativa, `ascAppId` ancora da compilare in `eas.json`.
6. **Permessi.** L'app ne chiede molti (posizione, contatti, microfono, fotocamera, calendario, 15 tipi di dati salute, sveglie esatte). Ognuno va giustificato allo store; quelli non indispensabili vanno tolti o chiesti solo al momento dell'uso.
7. **Contenuti degli utenti.** Segnalazione e blocco ci sono; servono un processo reale di moderazione, tempi di risposta e un contatto.
8. **Prova reale.** Build su iPhone e Android e giro completo a mano: molte sezioni recenti (Workspace, Casa, Garanzie) non sono mai state provate su un telefono.

### Importante per la qualità

- **Lingue.** Italiano e inglese completi; le altre lingue sono parziali (per esempio l'arabo ha circa due terzi delle righe dell'inglese).
- **Server.** Il progetto Supabase gratuito va in pausa da solo: per un'app venduta serve un piano che non iberna, copie di sicurezza automatiche e una prova di ripristino.
- **Monitoraggio.** Collegare un servizio per crash ed errori e un pannello d'uso, con consenso.
- **Lint.** Ridurre a zero gli errori, sezione per sezione.
- **Prove automatiche sull'interfaccia.** I test coprono la logica, non le schermate.
- **Prestazioni.** Misurare avvio, memoria e batteria su telefoni di fascia bassa: l'app ha più di 130 schermate.
- **Accessibilità.** Verifica con lettore di schermo e testo grande.
- **Casa su più telefoni.** Oggi la casa vive su un solo telefono.

### Per venderla

- **Piani e prezzi.** Definire cosa è gratuito e cosa a pagamento, e collegare gli acquisti in-app.
- **Costi dell'AI.** Stimare il costo per utente e mettere limiti che lo coprano.
- **Assistenza.** Un indirizzo di supporto, tempi di risposta, una pagina di stato.
- **Ampiezza.** L'app copre moltissimo: per un primo lancio conviene scegliere poche sezioni solide e tenere il resto spento finché non è provato.
- **Materiali.** Icona, schermate per gli store, video, sito con informativa e termini.

---

## 6. Ordine consigliato

1. Riattivare il database e fare la verifica di sicurezza dal vivo; applicare la 0031.
2. Chiudere i server AI: accesso obbligatorio su `lifepilot-api`, limiti globali, tetto di spesa, via la parola d'ordine condivisa.
3. Build su telefono e giro completo a mano; correggere quello che emerge.
4. Decidere sui LifePoints (togliere, dimostrativo o partner autorizzato).
5. Testi legali con un avvocato; revisione dei contenuti di salute e fisco.
6. Schede degli store, permessi, moderazione.
7. Lint a zero, lingue, monitoraggio, piano server a pagamento.

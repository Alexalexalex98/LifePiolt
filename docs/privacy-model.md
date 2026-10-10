# Modello dei dati e della privacy di LifePilot

Questo documento descrive dove vivono i dati, chi li può vedere e cosa promettiamo (e cosa no). È la fonte di verità per la schermata "Cosa condivido" (`src/lib/dataCatalog.ts`, `src/store/sharing.ts`).

## Principio

1. Sui server di LifePilot restano **solo** nome, cognome, email, data di nascita e poche altre informazioni di account (lingua, valuta, elenco dispositivi, impostazioni di sicurezza).
2. **Tutto il resto** (Plan, task, note, obiettivi, umore, salute, finanze, carte, CSV della banca, spostamenti, viaggi, documenti, chat, ricerche, interessi, LifePoints, candidature) vive **solo sul telefono**.
3. L'utente può **condividere** o **non condividere** ogni tipo di dato con persone e servizi (agenda condivisa, chat, LifeNetwork, assistente AI). In ogni momento può vedere cosa è condiviso e cosa no, e cambiarlo.
4. Partono condivise solo le cose meno importanti (nome pubblico, foto, interessi, stato "disponibile", professione sul biglietto). Il resto parte "solo io". I dati critici sono sempre segreti.

## Stato attuale (importante)

**Il server non esiste ancora.** Quindi oggi:

- nulla lascia il telefono, salvo ciò che l'utente invia di sua iniziativa (un messaggio, un file in chat) e le domande all'assistente AI (inviate al servizio AI configurato, con il contesto personale solo se i relativi consensi sono attivi);
- le scelte di "Cosa condivido" hanno **effetto reale** solo dove l'app già condivide qualcosa (colonna "Stato = attivo" qui sotto); le altre voci sono **"predisposte"** e si attivano col server;
- non mostriamo mai etichette del tipo "protetto" per ciò che non lo è: per la cifratura end-to-end l'etichetta è "Cifratura end-to-end: predisposta, si attiva col server".

## Livelli

| Campo | Valori |
|---|---|
| Dove vive | `telefono`, `account su server`, `rete pubblica`, `cifrato end-to-end con l'altra persona` |
| Sensibilità | `critico`, `sensibile`, `normale`, `pubblico` |
| Chi la vede | `nessuno`, `solo io`, `persone scelte`, `tutti`, `assistente AI` |

I **critici** (carte di credito e IBAN, CSV/estratti conto della banca, conti/saldi/movimenti, dati sanitari clinici, documenti fiscali, documenti d'identità e contratti) hanno una sola opzione "Sempre segreta": non c'è interruttore, la validazione (`isValidChoice`, `setChoice`, `normalizeChoices`) rifiuta qualunque valore condiviso, anche se un backup manomesso lo contenesse.

## Collegamento alle impostazioni esistenti (fonte unica)

Le scelte non duplicano ciò che l'app già memorizzava; lo leggono e lo scrivono dalla fonte originale:

| Voce di "Cosa condivido" | Fonte | Effetto oggi |
|---|---|---|
| Memoria per l'assistente AI | `app.privacy['AI Memory']` | attivo (contesto aggiunto alle domande AI, `lib/theia.ts`) |
| Passi, sonno, allenamenti, peso | `app.privacy['Dati salute']` | attivo (idem) |
| Riepilogo delle finanze | `app.privacy['Dati finanziari']` | attivo (idem) |
| Posizione | `app.privacy['Posizione']` | predisposto (la posizione parte in chat solo quando la invii) |
| Profilo LifeNetwork pubblico/privato | `app.privacy['Profilo privato']` (invertito) | predisposto (flag letto dall'assistente) |
| Professione/residenza, telefono, email, anno di nascita sul biglietto | `net.myCard.show*` | attivo (biglietto da visita e contatto inviato in chat) |
| Impegni e agenda (Plan) | `store/sharing` (`plan_agenda`) | attivo: limita le modalità del foglio "Condividi la tua agenda" e il comando dell'assistente |
| Tutte le altre | `store/sharing` | predisposte |

Perciò **nessuna scelta precedente è stata persa**: il vecchio record `privacy` è la sorgente dei suoi interruttori e il pannello Impostazioni > Privacy continua a funzionare (e resta coerente).

L'agenda ha un livello massimo (solo slot liberi / occupato-libero / con dettagli). Default: **solo slot liberi**. Chi prima poteva inviare l'agenda con i titoli deve ora alzare il livello in "Cosa condivido": è una scelta voluta (i titoli degli impegni sono dati sensibili).

## LifeNetwork

Quasi tutto è pubblico per scelta (post, idee, commenti, annunci, follower). Fanno eccezione seminari, corsi, sedute/servizi 1-a-1, i loro messaggi privati e i documenti scambiati: devono viaggiare con crittografia end-to-end (vedi `docs/e2e-plan.md`, `src/lib/e2eModel.ts`). Oggi: **predisposta, si attiva col server**.

## Cosa promettiamo

- Il server (quando esisterà) conserva solo i dati di account e, per i contenuti E2E, testo cifrato + metadati minimi.
- Nessun dato critico ha un canale di condivisione.
- Puoi vedere e cambiare in ogni momento cosa è condiviso; "Rendi tutto privato" e "Ripristina i valori predefiniti" sono sempre disponibili (con conferma e annulla).
- Eliminare i tuoi dati dal telefono li elimina davvero (Impostazioni > Elimina tutti i miei dati).

## Cosa NON promettiamo

- **Backup del telefono**: iCloud / Google Backup possono salvare i dati dell'app (inclusi quelli critici) fuori dal telefono, secondo le impostazioni del sistema. Non li controlliamo.
- **Backup di LifePilot**: il file esportato è un JSON **non cifrato** e contiene tutto, anche i dati critici. Va conservato con cura. (Cifratura con password: pianificata, vedi `docs/e2e-plan.md`.)
- **Assistente AI**: se attivi i consensi, un riassunto dei dati viene inviato al servizio AI per rispondere. Disattivali per evitarlo.
- **Metadati** con il server attivo: chi parla con chi, quando, quanto.
- Telefono sbloccato, malware, screenshot o inoltri dell'altra persona.
- Cifratura end-to-end: oggi **non è attiva**.

## Cosa resta da fare per il server

1. Account: registrazione/login con soli nome, cognome, email, data di nascita (+ info di account); nessun endpoint per gli altri dati.
2. Canali di condivisione: consegna di agenda/biglietto/profilo/stato ai destinatari scelti, applicando le scelte di `store/sharing` (la sorgente di verità resta il telefono; il server riceve solo ciò che la scelta consente).
3. E2E per seminari/corsi/sedute (docs/e2e-plan.md).
4. Collegare le voci "predisposte" (task, note, obiettivi, umore, interessi, stato, follower, LifePoints, candidature...) ai rispettivi canali, rimuovendo la dicitura "predisposta" voce per voce (campo `status` del catalogo).
5. Cancellazione dell'account lato server (diritto all'oblio) e esportazione dei dati di account.

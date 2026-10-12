# Backend locale: dominio, privacy gate, background, osservabilita'

Obiettivo: rafforzare il backend LOCALE prima di collegare un server. Quattro pezzi, tutti senza dipendenze native nuove salvo `expo-background-task` / `expo-task-manager`.

## 1. Event bus e operazioni transazionali (`src/domain`)

| File | Ruolo |
|---|---|
| `events.ts` (puro) | bus sincrono tipizzato: `on(evento, modulo, handler, {order})`, `emit`, `registerModule`, sink degli errori |
| `operation.ts` (puro) | `runOperation(nome, passi, {key, events})`: snapshot degli store toccati, rollback, idempotenza, eventi dopo il commit |
| `stores.ts` | registra gli store (`fin`, `life`, `net`, `jobs`, `club`, `chat`) per lo snapshot |
| `operations.ts` | flussi dell'app: `payBill`, `undoPayBill`, `enrollSeminarOp`, `bookServiceOp`, `confirmAttendanceOp`, `cancelEnrollmentOp`, `restoreEnrollmentOp`, `acceptInterviewOp`, `subscribeClubOp` |
| `handlers.ts` | effetti collaterali agganciati agli eventi; caricato da `src/app/_layout.tsx` (`registerDomainHandlers()`) |
| `bridge.ts` | osserva `useLife`/`useHealth` ed emette `task.completed`, `goal.progressed`, `event.added/updated/removed`, `mood.logged` |

Regole del bus: gli handler girano per `order` crescente (10 coerenza, 50 promemoria/notifiche di sistema, 90 notifiche in-app e log) e poi per registrazione; un handler che lancia o la cui promise viene rifiutata NON ferma gli altri (l'errore va al log, categoria `domain`); profondita' massima 8 (loop di riemissione interrotto). Gli store e le operazioni non importano `handlers.ts`: nessun ciclo di import.

Regole delle operazioni: ogni passo dichiara gli store che tocca; prima del primo passo che li tocca se ne salva lo stato; se un passo lancia, gli store toccati tornano come prima (`setState(snapshot, true)`), l'errore (con il nome del passo) va al log e NESSUN evento parte. Con `key` l'operazione e' idempotente: una seconda esecuzione con la stessa chiave non rifa nulla (`skipped`); un fallimento non consuma la chiave. Limiti dichiarati: sono sincrone; il rollback ripristina l'intero stato degli store toccati (se una schermata modifica lo stesso store nello stesso istante, la modifica va persa: nei fatti non succede perche' i passi sono sincroni).

### Eventi

`bill.created|paid|reopened|deleted`, `event.added|updated|removed`, `task.completed`, `goal.progressed`, `booking.confirmed|cancelled|attended`, `interview.accepted`, `club.subscribed`, `mood.logged`, `location.habit.detected` (predisposto), `clock.changed`, `maintenance.due`.

Handler oggi: `bill.*` -> annulla/ricalcola i promemoria bolletta; `event.*`/`booking.*`/`interview.accepted` -> ricalcola i promemoria impegni (debounce 2,5 s); `booking.confirmed` -> notifica in-app silenziosa (categoria Sistema); `interview.accepted` -> impegno nel Plan + avviso all'azienda + registro di uscita; `club.subscribed` -> registro di uscita; `clock.changed` -> segno nel log. Ogni evento lascia una riga di debug (solo nome e campi, mai i valori).

### Cosa e' stato migrato (e cosa no)

Migrato alle operazioni:
- segna bolletta pagata / annulla (`billDetail.tsx`): bolletta + movimento + scadenza dal calendario in blocco; i promemoria li riallinea l'handler di `bill.paid`;
- iscrizione a un seminario, prenotazione di un servizio, annullamento (con undo), conferma di partecipazione (addebito LifePoints + accredito + stato, tutto o niente) in `src/lib/enroll.ts`; `planBooking.checkPlanSlot` controlla solo i conflitti, l'evento nel Plan lo inserisce l'operazione;
- accettazione del colloquio (`interviewActions.acceptInvite`): stato in `jobs` + effetti come handler;
- iscrizione/follow/Premium di un club (`store/clubFlow.ts`): iscrizione + canale chat + messaggio di benvenuto.

NON migrato (e perche'):
- `lib/assistant/env.ts` (aggiunta impegni/task dall'assistente): ogni chiamata e' una sola scrittura su uno store, non c'e' coordinamento da proteggere; gli eventi arrivano dal ponte (`bridge.ts`);
- `lib/bills/calendar.ts` (aggiunta/rimozione scadenza su richiesta): un solo store, con undo proprio;
- `lib/network.ts`, `chatShare.ts`, `chatEvent.ts`, `profile/actions.ts`, `components/network.tsx`: letture o scritture su un solo store; migrarle sposterebbe codice senza aggiungere garanzie;
- `lib/automationRuntime.ts`, `calendarImport.ts`, `notifyOpen.ts`, `weather.ts`, `report.ts`, `analyticsData.ts`: letture (`getState()` per calcolare) o importazioni a un solo store;
- schermate (`taxdecl`, `billReview`, `conversationPage`, `notificationsPage`...): leggono lo stato al momento del tocco; le scritture composte sono nei flussi sopra;
- `PayOpts.record` (movimento) resta dentro `markInvoicePaid` dello store finanze: e' la stessa transazione dello store, l'operazione la rende atomica con il calendario.
Prossimi candidati: pubblicazione/annullamento di un seminario dal lato relatore; iscrizione a una candidatura (`jobs` + `net`); eliminazione di un task con sotto-attivita' e promemoria.

## 2. Privacy gate unico (`src/lib/privacyGate.ts`)

`canShare(dataId, audience, ctx?) -> {allowed, reason, level}` (nessun effetto), `guardedPayload(dataId, audience, payload, ctx?)` (ripulisce e REGISTRA), `logOutflow(dataId, audience, ctx)` (registra senza payload). Il gate non ha regole proprie sui dati: legge `dataCatalog.ts` e le scelte di "Cosa condivido". Fuori dall'app (test) si collega con `bindGate({choices, record})`; nell'app lo fa `privacyGateApp.ts` (i canali importano da li'). Se non e' collegato NEGA tutto (fallisce in modo sicuro).

Audience: `router_ai`, `chat:<id>`, `network_public`, `club`, `employer`, `sync`, `export`. Contesto: `mode` (agenda), `explicit` (gesto esplicito dell'utente), `chosen` (contatti scelti), `log:false`.

| Regola | Effetto |
|---|---|
| dato critico (carte, IBAN, CSV, clinici, fiscali, documenti, conti e movimenti) | negato per OGNI audience, anche con `explicit` |
| `router_ai` | solo voci con destinatario "assistente AI" scelte (memoria, salute, riepilogo finanze); testi redatti (email/IBAN/carte/telefoni) |
| `network_public` | solo voci condivise con "tutti" |
| `chat`, `club`, `employer` | voce condivisa con "persone scelte"/"tutti", oppure `explicit` per dati non critici e senza livelli (task, note, candidatura) |
| agenda (`plan_agenda`) | sempre secondo il livello scelto: liberi < occupato < dettagli; `explicit` non lo supera; `guardedPayload` toglie `items`/`busy` oltre il livello |
| `sync` | solo dati di account e voci cifrate end-to-end condivise |
| `export` | azione dell'utente sui propri dati non critici |
| `contacts` | mai a AI/sync/rete pubblica; solo con `explicit` e solo i contatti in `chosen` |

Canali collegati (comportamento invariato quando permesso): assistente AI (`aiRouter/runtime.ts`: flag del contesto + registro di cio' che e' partito), agenda in chat (`assistant/env.ts`, `ShareSheets.tsx`), biglietto da visita in chat (`Composer.tsx`) e QR (`profile/cardData.ts`), colloquio/candidatura verso l'azienda (`interviewActions`), club (`club.subscribed`). Il futuro `sync` deve chiamare `guardedPayload(id, 'sync', ...)` prima di ogni invio.

Registro di uscita (`lib/privacyLog.ts`, `store/privacyLog.ts`, persistente e incluso nel backup): `{ts, audience, dataId, esito: ok|partial|denied, quantita'}`, MAI il contenuto ne' l'identificativo del destinatario (di `chat:<id>` resta `chat`); tetto 2000 righe. Si consulta in Diagnostica > Privacy con filtri per destinatario ed esito e si elimina con `confirmDelete` (con annulla).

## 3. Lavoro in background (`src/lib/background.ts`, `backgroundPlan.ts`)

SDK 57: `expo-background-task` (WorkManager su Android, BGTaskScheduler su iOS) + `expo-task-manager` (`defineTask`). `expo-background-fetch` e' deprecato in favore di questo. Plugin `expo-background-task` in `app.json` (aggiunge `UIBackgroundModes: processing` e l'identificatore BGTask). Task `lifepilot-maintenance`, intervallo minimo 60 minuti (il sistema decide: Android >= 15 min, iOS spesso di notte). `defineBackgroundTask()` e' chiamato nello scope globale di `_layout.tsx`. Moduli caricati con `require()` solo dove esistono (non web, non Expo Go).

Cosa ricalcola (`decide()` in `backgroundPlan.ts`, puro e testato): promemoria impegni e bollette ogni 6 h, briefing ogni 12 h, pulizia ogni 24 h (cestino a 30 giorni, notifiche in-app lette oltre 60 giorni, tetto 200); subito dopo un cambio di fuso orario o di ora legale; quando non risulta nessuna notifica programmata; al primo avvio. Se il permesso e' negato o su web salta le notifiche e fa solo la pulizia. Gancio abitudini dalla posizione: `setHabitProvider(fn)` (oggi nessun provider; chi lo implementa emette `location.habit.detected`). Esito osservabile in Diagnostica e salvato in `lp-bg-last` (anche per le esecuzioni in background).

### Notifiche locali dopo riavvio, fuso, Doze (verificato leggendo `expo-notifications` 57)

- Android: le notifiche programmate sono salvate in `SharedPreferences`; il servizio le ri-programma su `BOOT_COMPLETED`, `REBOOT`, `QUICKBOOT_POWERON` e `MY_PACKAGE_REPLACED` (aggiornamento app): le notifiche `DATE` sopravvivono al riavvio.
- NON gestito dalla libreria: `TIMEZONE_CHANGED`/`TIME_SET`/ora legale (il manifest non li ascolta). Gli allarmi sono istanti assoluti: dopo un cambio di fuso gli orari "di parete" (briefing DAILY, promemoria) vanno ricalcolati: lo fa `runMaintenance` all'apertura e in background.
- Android 12+: allarmi esatti solo se `SCHEDULE_EXACT_ALARM` e' concesso (altrimenti `setAndAllowWhileIdle`, inesatto: possono slittare di minuti); `USE_EXACT_ALARM` e' dichiarato (su Play Store e' ammesso solo per app di sveglie/calendario: da verificare in fase di pubblicazione). Doze ritarda gli allarmi inesatti; "Arresto forzato" dell'app cancella gli allarmi fino alla riapertura; alcuni produttori (Xiaomi, Huawei, Samsung) li uccidono con il risparmio energetico.
- iOS: tetto di 64 notifiche programmate (si programmano le piu' vicine: `RESERVED_SLOTS`, `MAX_SCHEDULED`; Diagnostica avvisa oltre 56); le notifiche locali sopravvivono al riavvio; il task in background e' a discrezione del sistema e puo' essere disattivato dall'utente (Aggiornamento app in background). Il fuso/ora legale si rileva all'apertura dell'app.
- Non verificabile qui: comportamento di una notifica `DATE` il cui orario e' passato durante lo spegnimento (la libreria non lo documenta: da provare sul telefono).

## 4. Osservabilita' (`src/lib/log.ts`, Diagnostica)

`log.debug|info|warn|error(categoria, messaggio, dati?)`: ring buffer di 500 voci in memoria, ultime 300 (livello >= info) su file `lifepilot-log.json` (web: localStorage) scritte al massimo ogni 3 s tramite `logStorage.ts`. OGNI messaggio passa da `redact()` di `aiRouter/privacy.ts` (email, IBAN, carte, telefoni, indirizzi) e da `scrubExtra` (percorsi utente, token, URL con parametri). `errorLog.logError` (che raccoglie `ErrorUtils.setGlobalHandler` e le promise rifiutate gia' in `ErrorBanner.installGlobalErrors`) scrive anche nel log. `safely()` e `go()` usano il log al posto di `console.warn`; `notify.ts` e `bills/schedule.ts` registrano gli errori di programmazione che prima erano `catch {}` silenziosi.

`ErrorBoundary.tsx` e' la schermata "Qualcosa e' andato storto" (Riprova, Vai alla Home, Esporta diagnostica, Segnala il problema = rapporto redatto negli appunti); `ErrorScreen.tsx` la riesporta come `ErrorBoundary` di expo-router (radice e `(tabs)`).

Pagina `src/app/(tabs)/diagnostics.tsx` (card in Impostazioni): Stato (versione, SDK, build, piattaforma, storage, permessi, notifiche programmate, task in background con "Ricalcola ora"), Log (filtri livello/categoria/testo, "Cancella log" con conferma), Privacy (registro di uscita), "Esporta diagnostica" (file di testo SENZA titoli di notifiche, messaggi, nomi, email, IBAN, carte, telefoni). Strumenti di sviluppo nascosti: toccare 5 volte "Versione app" mostra "Prova il registro di uscita", "Provoca un errore" e "Chiedi al sistema di eseguire il task".

## Test

`tests/domain.test.mjs` (bus, rollback, handler che falliscono, idempotenza), `tests/domainBackground.test.mjs` (pianificazione e pulizia), `tests/privacyGate.test.mjs` (critici sempre negati, livelli, mascheramenti, registro senza contenuto), `tests/log.test.mjs` (log, redazione, persistenza, rapporto). Tutti in `npm test`.

## Checklist sul telefono (non verificabile qui)

1. Dev build / app installata Android: Diagnostica > Stato: "Lavoro in background: registrato = si", stato "disponibile". "Chiedi al sistema di eseguire il task" (dopo 5 tocchi su Versione) poi riaprire: "Ultimo esito" con origine "in background".
2. Programmare un impegno tra 2 minuti: la notifica arriva con schermo spento (Doze) e dopo "Arresto forzato" + riapertura.
3. Riavviare il telefono con un impegno domani: Diagnostica > Notifiche programmate le elenca ancora; aprire l'app: ultimo esito "aprendo l'app".
4. Cambiare il fuso orario (o l'ora manuale): aprire l'app, Ultimo esito mostra "cambio di fuso orario" e i briefing ripartono all'ora locale giusta.
5. Android 12+: Impostazioni > App > LifePilot > Sveglie e promemoria: concesso; poi revocare e verificare che la notifica arrivi comunque (anche se meno puntuale).
6. iPhone: con piu' di 56 notifiche programmate compare l'avviso; Impostazioni > Generali > Aggiornamento app in background attivo; il task parte nei giorni successivi.
7. Microfono: Diagnostica > Stato > Permessi e "Voce" mostrano concesso/negato e se il riconoscimento e' disponibile.
8. Esporta diagnostica: il file si condivide dal foglio di sistema e non contiene dati personali.

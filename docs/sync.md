# Sincronizzazione local-first

Livello che osserva gli store dall'esterno (zustand `subscribe` + snapshot), produce un registro di modifiche (outbox) con ID stabili, orologi logici (HLC), tombstone e una politica di conflitto per collezione, e lo sincronizza con un server tramite l'interfaccia `SyncTransport`. Gli store non sono stati modificati.

Stato: **nessun server collegato**. Esistono il transport `disconnected` (predefinito) e `mock-server` (in memoria, per test e interruttore di sviluppo). Il transport reale (es. Supabase) si registra con `registerTransport(nome, factory)`.

## Mappa dei file

| Area | File |
|---|---|
| Orologio, id, hash | `src/sync/clock.ts` (HLC), `src/sync/ids.ts` (uuidv7, hash53, deepEqual) |
| Diff incrementale | `src/sync/diff.ts`, adattatori `src/sync/adapters.ts` |
| Registro collezioni e privacy | `src/sync/registry.ts` |
| Conflitti | `src/sync/policy.ts` |
| Coda | `src/sync/outbox.ts` |
| Motore | `src/sync/engine.ts` (puro), `src/sync/bindings.ts` (store reali) |
| Server | `src/sync/transport.ts`, `src/sync/mockServer.ts`, `src/sync/devMock.ts` |
| Cifratura | `src/sync/codec.ts` (solo identity, vedi sotto) |
| Contratto zod | `src/schemas/change.ts`, `src/schemas/collections.ts` |
| Stato | `src/store/sync.ts` (`sync`, `syncdata`, stato in memoria) |
| UI | `src/app/(tabs)/syncSettings.tsx`, `src/components/sync/*` |

## Modello

* **Entita'**: ogni collezione e' un insieme di entita' con id stabile. L'adattatore mappa la struttura dello store (array, mappe, liste per giorno, insiemi, voti annidati) in entita'. Dove lo store non ha id (eventi del piano, movimenti LifePoints) l'id e' assegnato dal motore e conservato nella tabella `idMap` dello store `syncdata` (chiave = contenuto, accoppiamento per posizione per riconoscere le modifiche). Gli id delle nuove entita' sono uuidv7.
* **ChangeRecord** `{id, collection, schemaV, entityId, op: create|update|delete, fields, unset, full?, hlc, base, deviceId, seq}`. `fields` contiene solo i campi cambiati (diff a livello di campo). `base` e' l'ultima versione dell'entita' vista dall'autore e serve a riconoscere le modifiche concorrenti.
* **Outbox** persistita con compattazione per entita': create+update=create, update+update=update, update+delete=delete, create+delete=nulla (solo se il server non conosce l'entita'), delete+create=create. Una voce gia' consegnata al transport (anche senza risposta) non si modifica piu': il server la deduplica per `id`.
* **Nessun loop**: le modifiche remote si applicano con `setState` parziale e vengono "assorbite" nello snapshot, quindi non generano record.
* **Cattura**: `subscribe` dello store, confronto dei riferimenti delle radici (se non cambiano, nessuna scansione), debounce 800 ms, poi diff per bucket e per riferimento. Dopo un riavvio si ricostruisce lo snapshot dalle impronte (hash) salvate in `syncdata`, cosi' si ritrovano le modifiche fatte a motore spento.
* **Protezione**: se una scansione trova eliminato almeno il 50% (e almeno 25) delle entita' di una collezione (reset di uno store, ripristino, dati non caricati) le cancellazioni sono trattenute finche' l'utente non le conferma.

## Politiche di conflitto (`registry.ts`)

| Politica | Dove | Comportamento |
|---|---|---|
| `lww` per campo (default) | task, obiettivi, eventi, allenamenti, viaggi, post, club... | per ogni campo vince l'HLC piu' recente; campi diversi si fondono |
| `union` (campo) | reazioni, `starredBy`... dei messaggi | unione degli array: le aggiunte non si perdono |
| `set` | interessi scelti, chi segui | l'elemento e' l'entita'; add/remove con tombstone, aggiunte concorrenti si uniscono |
| `server-wins` | voti, `likes`/`raised` | il valore arrivato dal server prevale; se c'e' una modifica locale in coda si applica l'ordine del registro del server |
| `manual` (campo) | testo delle note | se entrambi i lati hanno cambiato il testo vince l'HLC piu' recente e l'altra versione diventa una **copia in conflitto** (id deterministico `cc_<hash>`, uguale su tutti i dispositivi); mai testo perso. L'utente sceglie in Sincronizzazione |

Cancellazioni: tombstone `{d: hlc}` per entita'. Una scrittura piu' vecchia della tombstone e' ignorata. Modifica concorrente a una cancellazione: nelle note (`fullUpdates`, il record porta anche l'entita' intera) vince la modifica; nelle altre collezioni vince la cancellazione, a meno che l'entita' sia stata ricreata dopo (create piu' recente). Le tombstone si dimenticano dopo il TTL (90 giorni, `tombstoneTtlDays`). Un client offline da piu' del TTL riceve `reset: true`, riparte da zero (il server vince sull'unione) e le entita' che aveva e che nel frattempo erano state eliminate possono ricomparire: limite noto.

## Privacy

* Opt-in per **categoria del catalogo dati** (`src/lib/dataCatalog.ts`). Predefinito: tutto "solo sul telefono".
* Sincronizzabile solo se la categoria esiste, non e' `critico` e non e' una voce bloccata "sempre segreta" (`categoryEligibility`). Esclusi: carte/IBAN, CSV banca, movimenti e conti, bollette e fatture, dati fiscali, dati sanitari clinici, documenti d'identita', automazioni, citta' di casa, ricerche, iscrizioni ai club (vedi `EXCLUDED`). Di LifeDrive si sincronizza solo l'elenco, mai il file ne' l'`uri`.
* Il controllo e' ripetuto a ogni invio: record di collezioni non consentite finiti nella coda vengono scartati prima del transport. Test dedicati.
* Collezioni con `requiresE2E` (chat, iscrizioni, prenotazioni): non partono se il codec attivo non e' cifrato (`codec.e2e`).
* Registro "cosa e' stato inviato": solo tipo, collezione, quantita', data.
* `deviceId`, indirizzo del server e anon key stanno in expo-secure-store (su web localStorage), non in AsyncStorage: non finiscono nel backup. Anche `syncdata` (coda, cursore, metadati) e' escluso dal backup; `sync` (scelte, registri) e' incluso.
* **Cifratura E2E**: l'hook `PayloadCodec {id, e2e, encrypt, decrypt}` e' chiamato su ogni payload. Oggi esiste solo `identity` (nessuna cifratura). Il piano per il codec reale e' descritto in `src/sync/codec.ts` (chiave utente derivata da password/frase di recupero, cifrario AEAD di una libreria verificata, contesto = collezione+entita' come dati associati). Non e' stata scritta alcuna crittografia.

## Contratto con il server

Gli schemi zod in `src/schemas/change.ts` sono la fonte unica; il server li importa cosi' come sono.

**Busta `WireChange`** (v1): `{v:1, id (uuid), collection ("store.nome"), schemaV, entityId, op, hlc, base?, deviceId, seq, codec, payload?, serverSeq?}`. `payload` e' una stringa: JSON `{fields, unset?, full?}` dopo `codec.encrypt` (assente per `delete`). Con `codec: "identity"` il server puo' leggerlo e validarlo con `src/schemas/collections.ts`; con un codec cifrato non puo'.

**Operazioni richieste al transport**
* `push(changes[])` -> `{acked: id[], rejected: [{id, reason, retryable}], serverCursor}`. Idempotente per `id`: un id gia' noto e' confermato senza riapplicarlo. Rifiuti non ritentabili: `invalid`, `too-large`, `forbidden`, `schema`.
* `pull(cursor|null, {limit, collections})` -> `{changes[], nextCursor, hasMore, reset?}`. Il server assegna `serverSeq` crescente (arrivo) e il cursore e' opaco per il client. Le modifiche possono arrivare in qualsiasi ordine e duplicate: il client ordina per HLC e ignora i duplicati. Con cursore piu' vecchio della memoria del server: `reset: true`.
* Opzionali: `devices()` (nome, ultimo accesso), `deleteAllData()`, `auth.signIn/signOut`, `connect(cfg)`.
* Errori: `TransportError(kind: network|auth|rate-limit|server|unavailable, retryAfterMs?)`. `auth` e `unavailable` non fanno ritentare; gli altri ritentano con backoff esponenziale (base 2 s, tetto 5 min, jitter 50-100%).

**Il server deve**: autenticare l'utente e isolare i dati per account (RLS); verificare `deviceId` = dispositivo autenticato; assegnare `serverSeq` e deduplicare per `id`; applicare i limiti; rifiutare HLC con orologio oltre 24 h nel futuro; conservare le tombstone per il TTL e restituire `reset` oltre; non interpretare i payload cifrati. Non deve fare merge: il merge e' deterministico sul client.

**Limiti** (`LIMITS`): payload 64 KiB; push 200 modifiche; pull 500 per pagina; 60 richieste/min per dispositivo (429 con `retryAfter`); tombstone 90 giorni; deriva orologio 24 h.

**Versioni e compatibilita'**: `v` della busta cambia solo per rotture del protocollo; `schemaV` per collezione cambia solo per rotture dei campi. Aggiungere campi non e' una rottura (gli schemi sono `passthrough`): i client vecchi li conservano. Un client che riceve `schemaV` piu' alto del proprio salta quella collezione (la annota in `skippedSchema`) e non perde nulla: dopo l'aggiornamento dell'app la riscarica. Un server deve accettare almeno `schemaV` n e n-1.

## Prestazioni (test con 50.000 entita')

Misure su questa macchina (vedi `tests/syncEngine.test.mjs`): seed + invio di 50.000 entita' circa 1,4 s; una modifica su 50.000 circa 40 ms; aggiunta di un'entita' circa 40 ms; 1000 `setState` su store non correlati circa 1 ms (nessuna scansione); pull e applicazione di 50.000 entita' su un secondo dispositivo circa 2 s. Il costo di una scansione e' lineare nel numero di entita' del bucket cambiato (confronto per riferimento, nessun confronto di campi sulle entita' invariate); i bucket invariati (un giorno del calendario, una chat) si saltano per intero.

## Limiti noti

* Il codec cifrato non esiste ancora: le collezioni `requiresE2E` restano ferme.
* Gli allegati (foto, audio, video, file) non si sincronizzano.
* I campi annidati (es. `courses` di un club, `subtasks` di un task) sono atomici: il conflitto e' per l'intero campo.
* Eventi identici nello stesso giorno (stesso orario e titolo) sono entita' distinte; unendo due dispositivi gli identici si adottano a coppie.
* Le impronte (baseline) e i metadati crescono con il numero di entita' sincronizzate (circa 100 byte per entita').

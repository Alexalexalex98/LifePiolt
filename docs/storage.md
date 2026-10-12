# Archivio dati, cifratura e ricerca

Documento tecnico del backend locale di LifePilot (src/db, src/lib/search, src/lib/backup*.ts, pagina Sicurezza).

## Architettura

```
zustand store (30)  ->  persisted()  ->  KvEngine  ->  KvBackend
                       (src/store/persist.ts)  (src/db/engine.ts)   SqlKvBackend (telefono, expo-sqlite)
                                                                    AsyncKvBackend (web / ripiego)
```

- `persisted(name, creator, partialize?, { version, migrate, schema, sensitive }?)`: firma retrocompatibile, gli store non cambiano. Chiave logica `lp2-<name>`.
- **Selezione per piattaforma**: `src/db/backend.ts` (telefono: SQLite) e `backend.web.ts` (web: localStorage via AsyncStorage). Sul web expo-sqlite richiede WebAssembly + SharedArrayBuffer (COOP/COEP): non praticabile con hosting statico, quindi si usa il formato di sempre. Se SQLite non si apre sul telefono si ripiega su AsyncStorage senza rompere l'app.
- **Lettura**: una sola query all'avvio (`readAll`), ogni store prende il suo valore dalla cache: idratazione in parallelo. Checksum verificato, valore riparato/migrato in lettura.
- **Scrittura**: `set()` di zustand e' sincrona e leggera (nessun JSON.stringify). Un solo write per store ogni 500 ms (100 ms web), al massimo dopo 3 s di modifiche continue; flush immediato quando l'app va in background (verifica completa). Serializzazione al flush, in idle (InteractionManager). Transazioni, WAL, `synchronous=NORMAL`.
- **Store a pezzi** (`src/db/shardPlan.ts`, `SHARDS` in schemas.ts): i campi grandi (chat.messages per chat, life.tasks/notes/events/drive, network.posts/conversazioni, finance.months/invoices, health.series...) sono righe separate della tabella `shard`. Si riscrive solo il pezzo il cui riferimento e' cambiato (gli store sono immutabili). Rete di sicurezza contro mutazioni sul posto: verifica per checksum di tutti i pezzi a ogni flush in background e ogni 25 flush. Il formato logico (JSON dello store) e il backup non cambiano.
  Questa e' la strategia per lo "storico grande" senza toccare le schermate: niente tabelle con paginazione (richiederebbe cambiare store e UI), ma scritture incrementali. La paginazione vera (chat, movimenti) resta un lavoro futuro che richiede di cambiare gli store.

## Formato su disco (SQLite, `PRAGMA user_version = 1`)

| tabella | contenuto |
|---|---|
| `kv(name, value, version, updatedAt, checksum)` | JSON `{state, version}` dello store; per gli store a pezzi e' la "testa" (campi non grandi) |
| `shard(store, field, key, value, checksum, updatedAt)` | pezzi degli store grandi; key `''` = campo intero, `#x` = chiave x di una mappa |
| `kv_bak(name, value, checksum, updatedAt)` | ultima copia valida (valore precedente, al massimo ogni 10 min) |
| `quarantine(id, name, value, reason, at)` | blob scartati/illeggibili per diagnosi (max 5 per store) |
| `meta(k, v)` | stato migrazione legacy, ultimo VACUUM, ultimo controllo di integrita' |

File: `lifepilot-enc.db` (SQLCipher) oppure `lifepilot.db` (SQLite normale). Un `lifepilot.db` non cifrato trovato in una build SQLCipher viene travasato e poi eliminato (dopo verifica).

## Migrazione da AsyncStorage (one-shot)

`src/db/legacyMigration.ts`, fasi in `meta.legacy`: nessuna -> `copied` -> `purged`.
1. Legge le chiavi `lp2-*`, scarta (in quarantena) i non-JSON, inserisce solo i nomi assenti (mai sovrascrive dati piu' recenti), rilegge da SQLite e confronta semanticamente con l'originale.
2. Solo a verifica riuscita scrive il marcatore `copied` e **mantiene la copia vecchia per 14 giorni**; poi la cancella (`purged`).
3. Idempotente e interrompibile: senza marcatore si ripete senza perdere nulla.
**Rollback**: tornando a una versione vecchia dell'app (entro 14 giorni) questa leggerebbe la copia vecchia, che pero' non riceve piu' modifiche (dati "congelati" al giorno della migrazione). Per tornare davvero indietro: esporta un backup dalla versione nuova e importalo nella vecchia.

## Versioni di schema, validazione, recupero

- `src/db/migrations.ts`: registro per store. **Version 1 = stato attuale** (i dati salvati con version 0 restano identici). Per cambiare uno schema: alza `version` e aggiungi `migrations[nuovaVersione]` (funzione pura). Versioni future: lo stato si usa com'e' e si avvisa.
- `src/db/schemaKit.ts` + `schemas.ts`: validazione leggera dei campi di primo livello (life, finance, chat, network, health, club, identity, sharing, jobs; gli altri solo forma base). Niente zod: bastano guardie manuali.
- Recupero (mai crash all'avvio): campi non validi scartati e blob originale in `quarantine`; JSON non valido o checksum errato -> ultima copia interna valida; pezzo illeggibile -> scartato da solo, il resto si salva. Ogni caso mostra un avviso (banner `DbNoticeBanner`, pagina Sicurezza).
- Errori di scrittura (disco pieno, ecc.): i dati restano in memoria, avviso, nuovi tentativi con backoff (2/5/15/60 s).
- DB corrotto: il file viene spostato in `*.corrupt-<ts>`, si riparte da zero e (entro 14 giorni) si riprende la copia AsyncStorage.

## Cifratura a riposo

Scelta: **SQLCipher** (plugin `expo-sqlite` con `useSQLCipher: true` in app.json) con chiave casuale di 32 byte in expo-secure-store (Keychain/Keystore, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, cosi' funziona anche nei task in background). Cifra anche i pezzi, la quarantena e le copie interne.
- **Expo Go**: ha SQLite normale, senza SQLCipher (si rileva con `PRAGMA cipher_version`). Fallback: **cifratura per valore AES-256-GCM** (@noble/ciphers, JS puro, compatibile con Hermes) degli store sensibili (finance, health, identity, chat, sharing, life, jobs), AAD = nome store, chiave nel Keychain. Avviso "La cifratura richiede l'app installata/build". Casualita': expo-crypto (`getRandomBytes`); nessun ripiego su Math.random.
- **Web**: nessuna cifratura (i dati sono nel browser).
- **Cambio chiave**: `PRAGMA rekey`, a prova di crash (nuova chiave scritta prima in uno slot "next", poi ricifratura, poi promozione; in apertura si provano current e next).
- **Elimina tutti i dati**: svuota DB, cancella i file `.db` (e `.corrupt-*`), la chiave, la vecchia copia AsyncStorage, allegati e cache.
- Rischio noto: iCloud/Auto-Backup di Android possono ripristinare il file DB su un altro telefono senza la chiave (non segue): l'archivio risulta illeggibile, viene messo da parte e l'utente deve ripristinare un backup cifrato. Consigliato `android.allowBackup: false` (non modificato qui: fuori dal perimetro di app.json concesso).

## Blocco app

`expo-local-authentication` (Face ID/impronta/PIN di sistema), spento di default, in Sicurezza. Attivabile solo dopo una prova di sblocco riuscita; tempi 0/1/5/15 minuti (`src/db/lockPolicy.ts`). Copertura a schermo intero senza dati (`LockGate`); anteprima app recenti nascosta con `expo-screen-capture` (sfocatura iOS, FLAG_SECURE Android). Mai fuori per sempre: fallback al PIN del telefono; se il telefono non ha piu' un blocco schermo il blocco si disattiva con avviso. Le impostazioni di blocco non finiscono nei backup e non vengono toccate dal ripristino.

## Backup

- Plain: formato LifePilot 1 invariato (`.json`). `validateBackup` ora usa gli stessi schemi dell'idratazione: porta alla versione corrente, scarta i campi non validi (segnalati in anteprima), rifiuta formati e versioni di store futuri.
- Cifrato `.lpbackup` v1: JSON `{magic, v, kdf:{alg:'scrypt',N,r,p,salt}, enc:{alg:'AES-256-GCM',nonce}, data}`, intestazione autenticata (AAD). scrypt N=2^15, r=8, p=1 (~32 MB; i parametri stanno nel file e si possono alzare). Limiti accettati in lettura N in [2^14, 2^20]. Password minima 8 caratteri, mai salvata. Password errata o file alterato -> stesso errore.
  Perche' scrypt: PBKDF2 con molte iterazioni in JS puro e' molto piu' lento su Hermes; `scryptAsync` di @noble/hashes cede il controllo al thread UI.

## Ricerca locale (FTS5)

`src/lib/search`: `searchAll(query, {types, limit})`. Indice FTS5 in un database SQLite **in memoria** (nessun testo in chiaro su disco, si ricostruisce alla prima ricerca), tokenizer `unicode61 remove_diacritics 2` (accenti/maiuscole), prefisso, BM25 con titolo piu' pesante, evidenziazione con marcatori. Reindicizzazione incrementale (diff per hash) con debounce di 4 s dopo che almeno una ricerca e' stata fatta; si sottoscrive agli store dall'esterno (`sync.ts`). Tipi: note, task, obiettivi, file, impegni, chat (max 30.000 messaggi recenti), bollette (emittente/tipo/numero, non IBAN), idee, post. Web/senza FTS5: ricerca in memoria con la stessa API (sottostringa, tutte le parole).

## Spazio e manutenzione

Pagina Sicurezza: dati per categoria (anche pezzi), file piu' grandi, orfani (file in `Documenti/chat` non citati da nessuno store), cache, "Ripulisci" con anteprima e conferma, avviso quando lo spazio libero e' sotto 300 MB o 5%. `PRAGMA optimize` + checkpoint ogni giorno, `VACUUM` al massimo ogni 30 giorni.

## Misure (Node 22, V8; su Hermes aspettarsi tempi maggiori)

Stato sintetico di 5 anni (tests/helpers/synth.mjs, ~47.000 record di chat+...): 15,05 MB totali (chat 9,13, life 2,73, network 2,63); AsyncStorage Android ha un tetto ~6 MB totali e ~2 MB per riga in lettura: il vecchio motore non regge.
- Raffica di 60 modifiche sulla chat da 9 MB: vecchio (stringify intero a ogni set) 2791 ms totali, blocco massimo del thread 98 ms; nuovo 35 ms totali, blocco massimo 3 ms, 1 scrittura, 1 pezzo serializzato.
- Modifica di 1 chat: 2,5 ms (pezzo) contro ~90 ms (stringify+write del blob).
- Idratazione di 6 store in parallelo 387 ms (parse JSON incluso, 96 ms). Scrittura completa iniziale 476 ms. Checksum di 15 MB: 35 ms. Verifica completa in background 142 ms.
- Ricerca: 47.576 documenti, indicizzazione FTS5 ~1,5 s, query ~10 ms (memoria: 93 ms).

## Test

`tests/db.test.mjs`, `dbShard.test.mjs`, `dbCrypto.test.mjs`, `dbSearch.test.mjs`, `dbPerf.test.mjs`: logica pura con SQLite vero via `node:sqlite` (stesso SQL dell'app). **Non provato qui**: expo-sqlite nativo, SQLCipher, rekey, Keychain/Keystore, biometria, expo-screen-capture, InteractionManager, file system nativo, FTS5 su Hermes/telefono.

## Checklist per il telefono reale (build di sviluppo/produzione, non Expo Go)

1. Installa la nuova versione sopra una con dati: all'apertura compare l'avviso "Dati spostati nel nuovo archivio"; task/note/chat/finanze identici; Sicurezza mostra "SQLite (WAL)" e "Database cifrato (SQLCipher)".
2. Expo Go: Sicurezza mostra "Cifratura per sezione"; nessun crash.
3. Uccidi l'app subito dopo una modifica (entro 1 s): al riavvio la modifica c'e' (flush in background) o al piu' manca l'ultima.
4. Modalita' aereo + riempi lo spazio (o simula): compare l'avviso "Spazio esaurito" e dopo aver liberato spazio i dati si salvano.
5. Blocco: attiva (richiede prova), metti in background 1 min, riapri: schermata di blocco, Face ID/impronta, "Usa il PIN", biometria sbagliata piu' volte, rimuovi il PIN del telefono (il blocco deve disattivarsi), anteprima app recenti nascosta (iOS sfocata, Android nera), screenshot bloccato su Android.
6. Backup cifrato: esporta, condividi, reimporta su un altro telefono con password giusta/sbagliata; tempo di derivazione scrypt su un telefono economico (< ~10 s, UI viva).
7. Cambia chiave: dati intatti dopo il riavvio; ripeti uccidendo l'app durante il cambio.
8. Elimina tutti i dati: onboarding pulito, nessun `.db` residuo, nuova chiave al primo salvataggio.
9. Ricerca: note/task/chat con accenti, prefissi, tempo del primo indice con molti dati.
10. Spazio occupato: orfani e cache corretti, "Ripulisci" non tocca allegati ancora usati.
11. Con 5 anni di dati (usa il generatore): scorrevolezza durante la digitazione in chat, tempo di avvio.

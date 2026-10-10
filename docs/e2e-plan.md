# Piano della crittografia end-to-end (E2E)

Stato: **solo modello e piano**. Nell'app l'etichetta è "Cifratura end-to-end: predisposta, si attiva col server" (`src/lib/e2eModel.ts`, `E2E_ACTIVE = false`). Nessun codice crittografico di produzione è stato aggiunto: oggi non c'è alcun server e quindi nulla viaggia in rete.

## 1. Cosa è E2E

Seminari (contenuti riservati ai partecipanti), corsi, sedute e servizi 1-a-1, messaggi privati delle sedute, documenti scambiati. Tutto il resto di LifeNetwork (post, idee, annunci) è pubblico per scelta; le chat normali e i dati personali seguono il modello di `docs/privacy-model.md`.

## 2. Modello di chiavi

- **Chiave di identità per dispositivo**: coppia Ed25519 (firma) + X25519 (accordo di chiave), generata sul telefono alla prima esecuzione. La chiave privata sta nel portachiavi (`expo-secure-store`, già nel mondo Expo), mai sul server né nei backup in chiaro.
- **Il server vede e distribuisce solo chiavi pubbliche** (firmate dalla chiave di identità dell'account). Mai chiavi private, mai testo in chiaro.
- **Sessione per conversazione/seduta**: X25519 tra i due dispositivi -> segreto condiviso -> HKDF-SHA-256 (contesto = id conversazione) -> chiave simmetrica per XChaCha20-Poly1305 (o NaCl secretbox). Una nuova chiave di messaggio per ogni messaggio (ratchet semplice) per limitare i danni se una chiave trapela.
- **Gruppi (seminari/corsi)**: una chiave di gruppo, cifrata separatamente per ogni dispositivo dei partecipanti; si rigenera quando qualcuno esce o viene rimosso.
- **Il server vede**: mittente e destinatario, orario, dimensione, il testo cifrato.
- **Più dispositivi**: ogni dispositivo ha le sue chiavi; i messaggi si cifrano una volta per dispositivo del destinatario e per i tuoi altri dispositivi. Aggiungere un dispositivo richiede l'approvazione da uno già fidato (QR/codice); un dispositivo nuovo non legge la cronologia vecchia. Togliere un dispositivo ruota le chiavi.
- **Recupero**: perdere tutti i dispositivi significa perdere la cronologia cifrata (il server non ha chiavi). Opzioni: chiave di recupero di 24 parole conservata dall'utente, oppure backup cifrato con password. Un nuovo telefono genera nuove chiavi e i contatti vedono "il numero di sicurezza è cambiato".
- **Numero di sicurezza**: 30 cifre calcolate da entrambe le chiavi pubbliche, uguali per le due persone (`safetyNumber()` in `e2eModel.ts`, già testato; SHA-256 puro in TS). Si confronta a voce o con QR per escludere un "uomo in mezzo".
- **Cosa NON è coperto**: metadati; backup di telefono (iCloud/Google); backup JSON di LifePilot (oggi non cifrato); telefono sbloccato/malware; screenshot e inoltri dell'altra persona; contenuti pubblici.

## 3. Libreria consigliata e compatibilità

Verificato nel repo: **nessuna libreria crittografica installata** (né `expo-crypto`, né `tweetnacl`, né `libsodium`); l'ambiente Hermes non offre `crypto.subtle` in modo affidabile.

| Opzione | Pro | Contro | Expo Go | Dev build |
|---|---|---|---|---|
| `tweetnacl` + `tweetnacl-util` (JS puro) | Nessun modulo nativo, funziona in Expo Go e sul web, X25519/Ed25519/secretbox collaudati | Più lento (ok per messaggi di testo, meno per file grandi); serve un RNG sicuro: `expo-crypto` `getRandomValues` (modulo Expo, incluso in Expo Go) | sì | sì |
| `@noble/curves` + `@noble/ciphers` + `@noble/hashes` (JS puro, audit pubblici) | Moderni, tipizzati, XChaCha20-Poly1305 e HKDF inclusi | idem, RNG da `expo-crypto` | sì | sì |
| `react-native-libsodium` (JSI, libsodium nativo) | Veloce, set completo (sealed box, AEAD, KDF) | Modulo nativo: **non funziona in Expo Go**, richiede dev build/EAS e config plugin | no | sì |

**Raccomandazione**: iniziare con `@noble/*` (o `tweetnacl`) + `expo-crypto` per il RNG, in modo che il flusso sia testabile in Expo Go e sul web; migrare a `react-native-libsodium` in dev build solo se le prestazioni sui file grandi lo richiedono (stessa interfaccia dietro un modulo `src/lib/e2e/*`). Aggiungere le dipendenze con `npx expo install` e rileggere la documentazione dell'SDK in uso prima di scrivere codice (AGENTS.md).

Cifratura dei **backup con password** (ora): richiede KDF (scrypt/argon2/PBKDF2) + AEAD; non è disponibile in modo affidabile senza una libreria, quindi **non implementata**. Con `@noble/hashes` (scrypt) + `@noble/ciphers` (XChaCha20-Poly1305) si fa in ~60 righe e con test: primo passo consigliato.

## 4. Passi

1. Scegliere la libreria, aggiungerla, test vettori noti (RFC 7748 X25519, RFC 8032 Ed25519, XChaCha20-Poly1305).
2. `src/lib/e2e/keys.ts`: generazione, salvataggio in `expo-secure-store`, firma della chiave di dispositivo.
3. `src/lib/e2e/session.ts`: accordo X25519, HKDF, cifra/decifra messaggio (puro, testabile).
4. Server: endpoint per chiavi pubbliche e consegna di buste cifrate (sotto).
5. UI: numero di sicurezza (schermata della seduta), avviso "numero cambiato", elenco dispositivi, recupero.
6. Cambiare `E2E_ACTIVE` solo quando 1-5 sono funzionanti e testati con un audit esterno; solo allora l'etichetta passa a "Cifrato end-to-end".
7. Backup cifrato con password (vedi sopra) e opzione per escludere i dati critici dal backup.

## 5. Endpoint server necessari

- `POST /keys/device` (registra chiave pubblica di dispositivo, firmata) · `GET /keys/:user` (chiavi pubbliche dei dispositivi) · `DELETE /keys/device/:id`.
- `POST /e2e/envelopes` (busta cifrata per un dispositivo destinatario + metadati minimi) · `GET /e2e/inbox` (ritiro) · conferma di consegna.
- `POST /e2e/groups/:id/keys` (chiave di gruppo cifrata per dispositivo), rotazione all'uscita di un membro.
- Rate limiting, pulizia delle buste consegnate, nessuna lettura del contenuto.

## 6. Rischi

- Implementare crittografia propria: usare solo primitive di libreria; niente protocolli inventati senza revisione.
- RNG debole su RN: usare sempre `expo-crypto`.
- Etichette ottimistiche: finché `E2E_ACTIVE = false`, nessun testo dice "protetto".
- Perdita chiavi = perdita dati: spiegarlo prima, offrire il recupero.
- Metadati e backup di sistema fuori dal modello: dichiararli (fatto in `NOT_COVERED` e in `docs/privacy-model.md`).
- Moderazione/segnalazioni su contenuti cifrati: l'utente segnala inoltrando il messaggio in chiaro; il server non può leggerlo.

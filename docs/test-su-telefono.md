# Provare LifePilot sul telefono, funzione per funzione

Guida per chi prova l'app senza essere tecnico. Servono circa 20-30 minuti. Alla fine mi mandi **solo le voci che non vanno**, con le informazioni indicate.

## 1. Installare la build

**Android**
1. Apri sul telefono il link della build che ti ho mandato (file `.apk`, oppure il codice QR di EAS).
2. Se Android chiede "Installare app da questa fonte?", tocca **Impostazioni**, attiva **Consenti da questa fonte**, torna indietro e tocca **Installa**.
3. Apri **LifePilot**. Alla prima apertura vedrai la schermata "Il tuo nome": scrivi il tuo nome e scegli **Esplora con dati demo** (cosi non rischi i tuoi dati veri).
4. Compare una guida a schermo intero: tocca **Salta il tour**.

**iPhone**: apri il link TestFlight / di installazione interna che ti ho mandato e installa. Le voci "solo Android" qui sotto non ti riguardano.

> Importante: se aggiorni la build, **non disinstallare** l'app prima di aver fatto un backup (vedi la sezione 10, Backup cifrato). Disinstallando si perdono i dati.

## 2. Attivare la Diagnostica (una volta sola, prima di tutto)

La Diagnostica e il modo piu rapido per dirmi cosa e successo.

1. Apri **Impostazioni** (icona ingranaggio nel menu).
2. Scorri fino alla scheda **Diagnostica** e tocca **Apri la diagnostica**.
3. Controlla che la pagina mostri lo stato del telefono, i permessi e le notifiche programmate. Tocca **Aggiorna lo stato** per ricaricare.
4. Per mandarmi tutto: tocca **Esporta diagnostica**. Si apre il menu di condivisione: scegli WhatsApp, e-mail o salva il file e allegalo al messaggio.

**Fai l'esportazione subito dopo un problema**, non il giorno dopo: il registro e piu utile quando e fresco. In ogni caso, dopo la prova di ogni funzione che non va, esporta la diagnostica.

## 3. Cosa scrivermi sempre (per ogni problema)

* Il numero della voce della checklist (es. "4.2": sono quelli della prima colonna).
* Modello del telefono e versione di Android/iOS (Impostazioni del telefono > Informazioni sul telefono).
* Che tastiera usi (Gboard, Samsung, SwiftKey...).
* Cosa hai toccato, cosa ti aspettavi, cosa e successo (anche "non e successo niente").
* Uno **screenshot** o una breve registrazione schermo.
* Il file della **diagnostica esportata**.

## Checklist

Segna ogni voce: **OK** oppure **NO** (e poi mi mandi le info). Ordine consigliato: dall'alto in basso.

### 4 - Tastiera e barra di scrittura (Theia)

| # | Cosa fai | Cosa dovresti vedere | Se non va, mandami |
|---|---|---|---|
| 4.1 | Apri **Theia** (l'assistente) e tocca il campo in basso "Scrivi un comando o una domanda..." | La tastiera si apre e la **barra di scrittura sale sopra la tastiera**: si vedono il campo, il pulsante **Allega**, il microfono e il pulsante **Invia** | Screenshot con la tastiera aperta + modello telefono + tastiera |
| 4.2 | Scrivi una frase lunga (3-4 righe) | Il campo cresce fino a 5 righe; **Invia** resta sempre visibile e non finisce sotto la tastiera | Screenshot |
| 4.3 | Tocca **Invia** | Il messaggio parte, il campo si svuota, la tastiera resta aperta o si chiude senza saltare | Registrazione schermo |
| 4.4 | Ruota il telefono in orizzontale e di nuovo in verticale con la tastiera aperta | La barra resta visibile | Screenshot di entrambe |
| 4.5 | Apri la tastiera in altre schermate (nuovo impegno, nota, ricerca) | Il campo che stai scrivendo non e coperto | Quale schermata + screenshot |

### 5 - Microfono

| # | Cosa fai | Cosa dovresti vedere | Se non va, mandami |
|---|---|---|---|
| 5.1 | In Theia tocca il **microfono** (prima volta) | Il telefono chiede il permesso per il microfono: tocca **Consenti / Mentre usi l'app** | Screenshot del dialogo (o del messaggio d'errore) |
| 5.2 | Parla: "aggiungi riunione domani alle 15" | In alto compare l'onda del microfono e il testo che dici. Poi il testo va nel campo (o parte da solo, secondo l'impostazione) | Cosa e comparso + Esporta diagnostica |
| 5.3 | Se **non** funziona | Deve comparire **sempre un messaggio chiaro** (mai silenzio) con i pulsanti **Riprova**, **Diagnostica voce**, **Copia** | Tocca **Diagnostica voce**, poi **Copia** e incollamelo nel messaggio |
| 5.4 | Su Android: **Diagnostica voce** > **Servizio vocale di Google** | Si apre la pagina per installare/aggiornare il servizio vocale | Se non si apre, screenshot |
| 5.5 | Tocca il microfono e metti l'app in secondo piano (tasto Home) | L'ascolto si ferma da solo | Cosa succede |
| 5.6 | Cambia lingua del microfono (pulsante con il nome della lingua sopra la barra) e riprova | Riconosce nella lingua scelta | Lingua scelta + risultato |

### 6 - Notifiche

| # | Cosa fai | Cosa dovresti vedere | Se non va, mandami |
|---|---|---|---|
| 6.1 | **Impostazioni > Notifiche sul telefono** | Stato: **Non ancora richieste** (prima volta) | Screenshot |
| 6.2 | Tocca **Attiva le notifiche** | Compare la scheda "Vuoi ricevere gli avvisi?" con **Attiva** e **Non ora** | Screenshot |
| 6.3 | Tocca **Attiva** | Il telefono mostra il suo avviso di sistema: tocca **Consenti** | Screenshot se manca |
| 6.4 | Torna a Impostazioni > Notifiche | Stato: **Attive** | Screenshot + Esporta diagnostica |
| 6.5 | Crea un impegno per fra 5 minuti con il promemoria **Inizia ora** acceso, esci dall'app | Alla scadenza arriva la notifica, anche con lo schermo spento | Orario previsto, se e arrivata e quanto in ritardo |
| 6.6 | Tocca la notifica | L'app si apre sulla pagina giusta (l'impegno) | Dove ti ha portato |
| 6.7 | Se arrivano in ritardo (Android) | In Impostazioni > Notifiche tocca **Sveglie e promemoria** e consenti | Modello del telefono (alcuni lo bloccano) |
| 6.8 | Se hai rifiutato il permesso: tocca **Apri impostazioni di sistema** | Si apre la pagina delle notifiche dell'app nel telefono | Screenshot |

### 7 - Allegati

| # | Cosa fai | Cosa dovresti vedere | Se non va, mandami |
|---|---|---|---|
| 7.1 | In Theia tocca **Allega** | Foglio con **nove voci**: Scatta una foto, Galleria, Scegli un file, Incolla testo, Posizione, Contatto, Nota, Da LifeDrive, Impegno | Screenshot del foglio |
| 7.2 | **Scatta una foto** | Chiede il permesso fotocamera, scatti, compare l'anteprima nel campo | Dove si ferma |
| 7.3 | **Galleria** | Scegli una foto: compare l'anteprima | Cosa succede |
| 7.4 | **Scegli un file** (un PDF) | Compare il nome del file come allegato | Tipo di file |
| 7.5 | **Incolla testo** | Si apre "Incolla un testo": scrivi o **Incolla dagli appunti**, **Allega il testo** | Screenshot |
| 7.6 | **Contatto** | Chiede il permesso ai contatti e allega il contatto scelto | Dove si ferma |
| 7.7 | **Nota**, **Da LifeDrive**, **Impegno** | Elenco di tue cose da scegliere; la voce scelta compare come allegato | Quale non va |
| 7.8 | Allega 7 cose (il limite e 6) | Dopo la sesta il foglio dice che hai gia 6 allegati e le voci si spengono | Screenshot |

### 8 - Posizione

| # | Cosa fai | Cosa dovresti vedere | Se non va, mandami |
|---|---|---|---|
| 8.1 | Allega > **Posizione** | Chiede il permesso: scegli **Mentre usi l'app**; la posizione compare come allegato | Screenshot |
| 8.2 | Rifiuta il permesso, riprova | Un messaggio dice come riattivarlo (non resta muto) | Il messaggio |
| 8.3 | Nuovo impegno con **Luogo** (es. "Via Roma 1, Milano") | L'impegno mostra il luogo; se e oggi compare il consiglio su quando partire | Screenshot |

### 9 - Blocco dell'app

| # | Cosa fai | Cosa dovresti vedere | Se non va, mandami |
|---|---|---|---|
| 9.1 | **Impostazioni > Sicurezza e archivio > Blocco dell'app** | Interruttore **Blocca l'app**. Se il telefono non ha un blocco schermo, dice che serve | Screenshot |
| 9.2 | Attivalo e conferma con impronta/volto/PIN | Resta attivo | Dove si ferma |
| 9.3 | Chiudi l'app del tutto e riaprila | Compare la schermata con **Sblocca** e l'app non si vede dietro | Screenshot |
| 9.4 | Tocca **Sblocca** e conferma | Si apre l'app | Messaggio d'errore |
| 9.5 | Vai in secondo piano per un minuto e torna | Chiede di nuovo lo sblocco (secondo il tempo scelto) | Quanto sei stato fuori |
| 9.6 | Ruota/rientra durante lo sblocco | Non resta bloccata in un ciclo | Cosa succede |

### 10 - Backup cifrato

> Fallo con **dati demo**, non con quelli veri, la prima volta.

| # | Cosa fai | Cosa dovresti vedere | Se non va, mandami |
|---|---|---|---|
| 10.1 | **Sicurezza e archivio > Backup cifrato > Esporta backup cifrato** | Chiede **Password** e **Ripeti la password** | Screenshot |
| 10.2 | Scegli una password che ricordi (es. `Prova-2026`) e **Continua** | Si apre il menu di condivisione/salvataggio: salva il file `.lpbackup` (es. su Drive o File) | Dove si ferma |
| 10.3 | Aggiungi un task nuovo, poi **Importa backup (anche cifrato)** e scegli il file | Chiede la password; con quella giusta mostra un'anteprima ("Continua" / "Sovrascrivi") | Screenshot dell'anteprima |
| 10.4 | Prova con la **password sbagliata** | Messaggio chiaro, nessun dato cambiato | Il messaggio |
| 10.5 | Conferma il ripristino | Il task aggiunto dopo il backup sparisce; il resto torna come prima | Cosa manca |
| 10.6 | Prova un file che non e un backup (una foto) | "Backup non valido" con **Chiudi**, nessun danno | Il messaggio |

### 11 - Dopo ogni sessione

* Chiudi completamente l'app (scorrila via dal multitasking) e riaprila: **i dati ci sono ancora**?
* Metti il telefono in modalita aereo e usa l'app: compare un banner "offline" ma funziona?
* Se qualcosa ti sembra lento (piu di 2-3 secondi): dimmi in quale schermata.

## Come mandarmi i risultati

1. Un messaggio con l'elenco delle voci **NO** (es. "4.1, 6.5, 9.3").
2. Per ognuna: le informazioni della sezione 3.
3. La diagnostica esportata (sezione 2, **Esporta diagnostica**) e gli screenshot.
4. Se l'app si chiude da sola: apri **Impostazioni > Problemi riscontrati > Apri** e fai uno screenshot dell'elenco.

Grazie! Piu sei preciso, meno giri servono.

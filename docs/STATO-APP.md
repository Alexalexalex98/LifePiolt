# LifePilot
> Come leggere: [x] = verificato (visto a schermo o confermato da te). [ ] con «(solo test)» = il codice c'è e i test automatici passano, ma non l'ho visto sul telefono. [ ] con «(da fare)» = manca. Importa questo file da Progetti → Importa da file: ogni sezione diventa una task con le sue sotto-task e la percentuale si calcola da sola. Aggiornato il 23 ottobre 2026.

## 1. Account e accesso
- [x] Creare un account con email e codice di conferma (il codice arriva e funziona)
- [x] Via, CAP, data di nascita (minimo 16 anni) e consensi obbligatori nel modulo
- [ ] Salvare i dati anagrafici sul server (da riprovare dopo la migrazione 0008: esci, accedi, completa i dati)
- [ ] Accedere da un altro telefono con la stessa email (da provare)
- [x] Esplorare l'app con i dati demo, senza account né documento
- [ ] Cancellare l'account dal server insieme ai dati (solo test)
- [ ] Invio email dai nostri indirizzi (serve un dominio e Resend verificato)
- [ ] Un account per persona con il documento
  - [x] Impronta del documento sul server, senza numero né foto (provata su database locale)
  - [ ] Scegliere il fornitore di verifica (Veriff, Stripe Identity, IDnow, Persona…) (da fare)
  - [ ] Funzione server che riceve l'esito dal fornitore (da fare)
  - [ ] Collegare la verifica nell'app (da fare)

## 2. Server Supabase
- [x] Progetto creato (Lifepiolt2, Zurigo)
- [x] Migrazioni 0001-0007 eseguite (tabelle, post, account, identità, amici, messaggi)
- [ ] Eseguire la migrazione 0008 (account completo solo con nome e data di nascita)
- [ ] Mittente email con dominio proprio e SMTP (da fare)
- [ ] Piano a pagamento prima di far entrare utenti veri (da fare)
- [ ] Funzioni server per l'AI e per esportare i dati (da fare)

## 3. Social
### 3.1 Post
- [ ] Pubblicare un post vero e vederlo sul server (da provare: Impostazioni → Account → Prova il collegamento social)
- [ ] Foto e video nei post
- [ ] Mi piace online
- [ ] Commenti online (da fare: non collegati)
- [ ] Segui e follower online (da fare: non collegati)
- [ ] Storie e community online (da fare: non collegate)
### 3.2 Amici e messaggi
- [ ] Il mio codice amico (da provare con due account)
- [ ] Richiedere, accettare, rifiutare e bloccare un amico (solo test)
- [ ] Messaggi di testo in tempo reale tra due persone (solo test)
- [ ] Foto, vocali e allegati nei messaggi online (da fare)
- [ ] Notifiche push a app chiusa (da fare)
- [ ] Conferme di lettura (da fare)
- [ ] Cifratura da un capo all'altro (da fare)
- [ ] Segnalare un utente e pannello di moderazione (da fare)

## 4. Theia, il gioco
- [x] Schermata riordinata: indietro, bisogni in una riga, pulsanti puliti
- [x] Scegliere cosa dare da mangiare e da bere, con cibi freschi e sfizi
- [x] Energia e salute che salgono o scendono secondo le scelte, senza punizioni
- [x] Grafica del cibo e animazione di quando mangia
- [ ] Alimenti presi dal tuo frigo e dai tuoi pasti (solo test)
- [ ] Provare animazioni e tocco sul telefono (da fare)
- [ ] Casa: stanze, mobili, usura, traslochi (solo test)
- [ ] Mobili con grafica più realistica
  - [x] Sette sprite creati con Canva e collegati alle stanze (3 divani, letto, tavolo, scrivania, panchina)
  - [ ] Creare gli altri mobili: tappeto, pianta, lampada, quadro, mensola, armadio e le versioni più belle (da fare: crediti Canva finiti)
- [ ] Traguardi e stelline senza rivelare i valori (solo test)
- [ ] Amici nel gioco: visite e sfide con persone vere (da fare: ora sono dati finti)
- [ ] Inviti gentili al benessere (segnali, esercizi CBT) (solo test)
- [ ] Scrivere il progetto «Tamagotchi del benessere» (da fare)

## 5. Theia, l'assistente
- [ ] Azioni proposte da Theia e confermate da te (solo test)
- [ ] Conversare liberamente come Gemini (da collegare: serve il worker con la chiave)
- [ ] Imparare dai messaggi e dalle interazioni (solo test)
- [ ] Analisi di immagini (da collegare)
- [ ] Piano del mese: spese, risparmi, rate, stipendi (solo test)
- [ ] Correggere a mano ciò che Theia ha letto

## 6. LifeFitness e cibo
- [x] Acqua: scegliere il giorno, a che punto sei, cosa succede se poca o troppa
- [x] Frigo e spesa: cambiare nomi e quantità prima di salvare (visto a schermo, da riprovare con una foto)
- [ ] Leggere scontrino e foto del frigo (da fare: serve il server AI)
- [ ] Foto vere degli esercizi (da fare: script sul tuo computer)
- [ ] Altre ricette (da fare)
- [ ] Allenamenti, programmi, pasti e calorie (solo test)

## 7. LifeFinance e LifePoints
- [ ] Conto, spese, budget e obiettivi (solo test)
- [ ] Bollette e QR (solo test)
- [ ] Investimenti e titoli (solo test)
- [ ] LifePoints tra utenti (da fare: serve il server)
- [ ] Conti, pagamenti e licenze (da fare: società e consulente)

## 8. LifeHealth e benessere
- [ ] Umore, sonno, movimento (solo test)
- [ ] Apple Health e Apple Watch (da provare su iPhone con build vera)

## 9. Dashboard, Plan e organizzazione
- [ ] Dashboard a widget e sfondi (da rifinire)
- [ ] Plan e agenda con conflitti (solo test)
- [ ] LifeNotes (solo test)
- [ ] LifeTask classico (solo test)
- [ ] Progetti ad albero
  - [ ] Importare un file e creare padre e figli (solo test)
  - [ ] Percentuale e padre completato dai figli (solo test)
  - [ ] Caricare un file in una task e vederlo in LifeDrive (da provare)
  - [ ] Condividere un progetto in chat (da provare)
  - [ ] Progetti condivisi che si aggiornano da soli tra più persone (da fare: serve il server)
- [ ] LifeDrive con cartelle e anteprime (solo test)
- [ ] LifeTravel (solo test)

## 10. LifeNetwork
- [ ] Profilo, biglietto da visita e recensioni (solo test)
- [ ] Servizi, seminari, LifeClub (solo test)
- [ ] Lavoro e candidature (solo test)
- [ ] Idee e contributi (solo test)
- [ ] Chat in stile WhatsApp e call di gruppo (solo test)

## 11. Privacy e documenti legali
- [x] Informativa e Termini scritti e dentro l'app (italiano e inglese)
- [x] Centro Privacy: consenso per categoria
- [ ] Dati del titolare, indirizzo e contatto privacy (da fare)
- [ ] Revisione di un avvocato (da fare)
- [ ] Controllare i numeri di emergenza prima del lancio (da fare)
- [ ] Far rivedere da un professionista le soglie sull'acqua (da fare)

## 12. Lingue
- [x] Italiano e inglese completi
- [ ] Le altre 10 lingue: mancano circa 5.500 frasi per lingua (da fare)

## 13. Pubblicazione sugli store
- [ ] Build di prova su iPhone e Android (da fare)
- [ ] Account sviluppatore Apple e Google (da fare)
- [ ] Schede e dichiarazioni sulla privacy per gli store (da fare)
- [ ] Icona, schermate e testi degli store (da fare)

## 14. Video di presentazione
- [ ] Progetto video con l'app reale (messo in pausa)

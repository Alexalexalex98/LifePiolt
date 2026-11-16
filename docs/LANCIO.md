# Lancio: beta 1 gennaio (10-20 persone) e day one 1 febbraio

## Sezioni del day one
LifeChat (`messagesPage`), Dashboard (`index`), Plan (`plan`), LifeHealth, LifeFitness, LifeFinance, LifeNotes, LifeDrive, LifeTask.
Le schermate ci sono tutte. **Non ancora verificato sul telefono**: ognuna va percorsa a mano prima della beta (vedi lista sotto).

## Cosa è gratis e cosa usa l'AI
Tutto ciò che non usa l'AI è gratuito e sempre disponibile (inserimento a mano, calcoli, grafici, calendario, note, file, chat tra persone).
L'AI (Theia, lettura di foto/documenti) ha limiti decisi **sul server** (`ai_take`, `ai_take_doc`), non sull'app, quindi non si aggirano:

| Piano | Messaggi AI al giorno | Tetto oltre cui si ferma | Foto/documenti al giorno |
|---|---|---|---|
| Gratis | 10 (poi risposte brevi) | 30 | 3 |
| Prova (14 giorni) | 60 | 150 | 15 |
| Premium | 100 | 250 | 30 |
| Pro | 400 | 800 | 100 |

Senza AI collegata l'app resta usabile: i messaggi dicono «compila a mano».
Premium **non è acquistabile**: nessun pagamento è collegato (serve un fornitore e un tuo account). Si assegna a mano dal pannello.

## Prova di 14 giorni (migrazione 0043)
- Parte al primo accesso con l'account ed è legata all'email (cambiare telefono non la azzera).
- Durante la prova il server tratta la persona come «prova»: AI piena entro i tetti qui sopra.
- Il Worker, solo in prova, aggiunge a Theia l'istruzione di fare **una** domanda breve per volta per conoscere la persona (obiettivi, routine, sonno, soldi, allenamento). Lo decide il piano sul server: l'app non può attivarlo da sola. **Il Worker va ripubblicato da te** (`worker/ai.js`).
- Theia fa il punto nei giorni 1, 3, 7, 10, 12, 14 («Apri i tuoi 14 giorni», già presente).
- Finita la prova: limiti del piano gratuito, dati al loro posto.

## Beta 1 gennaio (10-20 persone)
- Distribuzione: TestFlight (iPhone) e test interno di Google Play (Android). Servono i tuoi account sviluppatore e una build firmata: **non posso crearli io**.
- Costo massimo teorico dell'AI in prova: 20 persone x 150 chiamate al giorno x 14 giorni (in pratica molto meno). Il budget lo controlli tu sul Worker/Cloudflare.
- Prima dell'invio: accesso Google/Apple attivo sul server, mittente email con dominio, piano Supabase a pagamento (vedi `STATO-APP.md`).

## Da percorrere a mano su telefono vero (ognuna con un account nuovo)
Creare account → prova parte → Dashboard → Plan (evento, promemoria) → LifeTask (obiettivo) → LifeNotes → LifeDrive (carica file) → LifeHealth (umore, sonno) → LifeFitness (pasto, acqua) → LifeFinance (movimento, scadenza) → LifeChat (messaggio a una seconda persona) → Theia (una domanda, controllare il contatore) → arrivo al tetto gratuito (messaggio chiaro).

## Da decidere / non fatto
- Nascondere le sezioni fuori dal day one (social, LifeClub, lavoro...): oggi sono presenti. Dimmi se per il 1 febbraio vanno nascoste con un interruttore.
- Pagamenti Premium (fornitore, prezzi, acquisti in-app Apple/Google).
- Testi legali e privacy da far rivedere.

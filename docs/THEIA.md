# Theia, l'assistente di LifePilot

Il nome si cambia da Impostazioni → Account → "Nome dell'assistente AI".

## Come si usa
- **Pulsante ✦ (a destra, su ogni pagina)**: tocca → screenshot della schermata; **tieni premuto** → usa il testo che hai copiato.
- **Chat**: tieni premuto un messaggio → "Chiedi a Theia" (anche su più messaggi selezionati, con foto incluse).
- **Note**: seleziona un pezzo di testo → "Chiedi a Theia sul testo selezionato".
- **Home → "Theia per te"**: suggerimenti su ciò che ti serve adesso, con il pulsante "Perché?".

## Cosa fa senza server (oggi)
Regole sul telefono: riassunto, task, date/orari, importi, bozza di risposta, risposte su agenda/task/obiettivi/punteggi.
Non è un modello linguistico e **non può leggere gli screenshot**. L'app lo dice nella finestra.
I suggerimenti proattivi usano abitudini d'uso per ora del giorno, calendario, task, obiettivi, messaggi e segnali della Dashboard.

## Con un server (AI vera)
1. `ANTHROPIC_API_KEY=... node server/theia-server.mjs` (esempio; aggiungi login, limiti, HTTPS prima di pubblicare).
2. Nell'app: variabile `EXPO_PUBLIC_API_URL=http://<IP-del-computer>:8787`, poi riavvia Expo.
3. Theia invia al server domanda, testo/immagine e un riassunto del tuo contesto.

Privacy: al server vanno i dati di salute/finanza **solo** se li consenti in Impostazioni → Privacy ("Dati salute", "Dati finanziari"), e il contesto solo con "AI Memory" attivo. Le chiavi API non vanno mai messe nell'app.

## Limite noto
Il menu nativo di selezione testo (Copia/Incolla) di iOS non si può estendere con voci personalizzate in Expo: per questo
l'azione sta nei menu dei messaggi, nelle note e nel pulsante ✦ + testo copiato.

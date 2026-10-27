# Server IA di LifePilot (`worker/ai.js`)
Cloudflare Worker con **modelli aperti su Workers AI** (niente Google). Pubblicato come `lifepilot-ai2` (indirizzo: `https://lifepilot-ai2.alex-stefanovic1998.workers.dev`).
- Percorsi: `/chat`, `/vision`, `/analyze`, `/translate` (stesse risposte `{reply}` del vecchio `lifepilot-api`).
- Accesso: il token dell'utente su Supabase (verificato con `/auth/v1/user`); per le prove anche `APP_TOKEN` (segreto, mai nel repository).
- Variabili: `SUPABASE_URL`, `SUPABASE_KEY` (chiave pubblica), binding `AI`.
- Modelli (da `SMART` e `VISION` in `ai.js`): gpt-oss-120b, Nemotron 3 120B, Llama 3.3 70B, Qwen 3.8 27B; foto con Mistral Small 3.1 24B (veloce, <1 s) e, se non risponde, Llama 4 Scout (10-30 s); PDF con `AI.toMarkdown`.
- Sul piano gratuito di Cloudflare NON sono disponibili GLM 5.3, DeepSeek V4 Pro e Kimi K2.6 (provato: «not available on the Workers Free»). Con un piano a pagamento si aggiungono in cima a `SMART`.
- Quota finita → risposta 429 con `code: 'quota'`, l'app mostra un messaggio chiaro.
- Non registra mai il contenuto delle richieste.
- Test: `tests/aiWorker.test.mjs`. Pubblicazione: via connettore Cloudflare (non c'è un comando automatico nel repository).

## Limiti per piano e risposta garantita (migrazione 0010)
- Ogni richiesta `/chat`, `/vision`, `/analyze` conta sul tuo account (`ai_take()` su Supabase, con il tuo token). Messaggi "completi" al giorno: **free 100, plus 400, pro 2000** (migrazione 0011, valori di prova) (si cambiano in `0010_ai_limits.sql`). Il piano si legge da `entitlements` (lo scrive solo il service_role).
- Finiti i messaggi completi Theia **risponde comunque**, con modelli piu' leggeri (`LITE`) e risposte piu' brevi (450 token). Freno al minuto: free 15, plus 30, pro 60.
- Senza account (o con accesso scaduto) tutto funziona lo stesso, anche foto e documenti: modalita' leggera e freno per dispositivo (12 al minuto per IP). Le chiavi restano solo sul server; l'app non ne contiene.
- Ogni risposta riporta `plan`, `lite`, `left`, `limit`. Se il conteggio non risponde nessuno viene bloccato.

## Ricerca sul web
- Per `/chat` l'app manda anche `q` (la sola domanda) e `web` (attivo di base, si spegne in Intelligenza di Theia). Un primo passaggio leggero decide se serve cercare e produce una frase GENERICA (niente nomi, importi, salute); poi si cerca su DuckDuckGo (pagina semplice) e, se non risponde, su Wikipedia (it, poi en). I risultati (titolo + frase) vanno al modello, che risponde con «Fonti: sito, sito».
- Non si aprono le pagine dei risultati (la CPU dei Worker gratuiti e' limitata). Non provato dal vivo dal mio ambiente: serve un controllo dal telefono. Se DuckDuckGo blocca l'indirizzo del Worker, resta Wikipedia.

## Ricerca sul web (stile motore di risposte)

Theia pianifica fino a 3 ricerche generiche e anonime, le esegue in parallelo (Google News, Bing News, DuckDuckGo, Wikipedia), classifica le fonti per affidabilita' (agenzie, enti, enciclopedie in alto; social, forum, blog in basso) e freschezza, legge il testo delle pagine migliori tramite il lettore pubblico r.jina.ai e risponde citando [1][2]. Se le fonti si contraddicono o sono poco affidabili lo dice. Nessuna chiave richiesta.

## Esperti per campo (worker/domains.js)

20 campi (salute, mente, alimentazione, fitness, finanza, fisco, diritto, lavoro, casa, viaggi, famiglia, auto, animali, studio, tecnologia, business, scienza e attualita', pratiche, sicurezza, ambiente). Per ogni domanda il worker riconosce il campo, aggiunge le istruzioni dell'esperto, cerca anche sulle fonti ufficiali del campo (site:) e le classifica per prime. «Approfondisci» (o «nel dettaglio») attiva la modalita' lunga: piu' ricerche, 5 pagine lette, risposta in piu' messaggi. La risposta include `domain` e l'app mostra il pulsante «Approfondisci».

## Google Gemini (solo se lo chiedi tu)
- Le foto vanno ai modelli aperti di Cloudflare. A Google Gemini vanno SOLO se l'app manda `google: true` su `/vision` o `/analyze`, cioè quando tocchi «Rifai con Google» (oggi dopo la lettura di frigo e scontrino, e solo se la lettura sembra incompleta: `googleMayBeBetter` in `pantry.ts`).
- Serve il segreto `GEMINI_API_KEY` sul Worker (`wrangler secret put GEMINI_API_KEY`); senza, risponde 501 `google_not_configured`. Modello: `GEMINI_MODEL` in `ai.js`.
- Ogni invio a Google mostra un avviso («Sto inviando la foto a Google Gemini») e compare in Impostazioni → «Cosa è stato inviato» con fornitore «Google Gemini».

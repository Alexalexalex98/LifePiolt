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

# Server IA di LifePilot (`worker/ai.js`)
Cloudflare Worker con **modelli aperti su Workers AI** (niente Google). Pubblicato come `lifepilot-ai2` (indirizzo: `https://lifepilot-ai2.alex-stefanovic1998.workers.dev`).
- Percorsi: `/chat`, `/vision`, `/analyze`, `/translate` (stesse risposte `{reply}` del vecchio `lifepilot-api`).
- Accesso: il token dell'utente su Supabase (verificato con `/auth/v1/user`); per le prove anche `APP_TOKEN` (segreto, mai nel repository).
- Variabili: `SUPABASE_URL`, `SUPABASE_KEY` (chiave pubblica), binding `AI`.
- Modelli (da `SMART` e `VISION` in `ai.js`): gpt-oss-120b, Nemotron 3 120B, Llama 3.3 70B, Qwen 3.8 27B; foto con Llama 4 Scout; PDF con `AI.toMarkdown`.
- Sul piano gratuito di Cloudflare NON sono disponibili GLM 5.3, DeepSeek V4 Pro e Kimi K2.6 (provato: «not available on the Workers Free»). Con un piano a pagamento si aggiungono in cima a `SMART`.
- Quota finita → risposta 429 con `code: 'quota'`, l'app mostra un messaggio chiaro.
- Non registra mai il contenuto delle richieste.
- Test: `tests/aiWorker.test.mjs`. Pubblicazione: via connettore Cloudflare (non c'è un comando automatico nel repository).

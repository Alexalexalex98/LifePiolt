# Server AI (Cloudflare Worker): non fermarsi quando il modello è sovraccarico

Il Worker non è in questo repository: questo è il pezzo da incollare. Quando Gemini risponde 429, 500, 502, 503 o 504
(«This model is currently experiencing high demand»), il Worker riprova una volta sullo stesso modello e poi passa al modello di riserva.
Il telefono non cambia: continua a chiamare `/chat`, `/vision` e `/analyze`.

## 1. Variabili del Worker (Settings > Variables)
- `MODELS` = elenco dei modelli in ordine di preferenza, separati da virgola. Mettici i nomi che vedi nella tua console Google AI Studio
  (il primo è quello di oggi; poi uno più leggero o più disponibile). Esempio di forma: `modello-principale,modello-di-riserva`.

## 2. Funzione da usare al posto della chiamata diretta
```js
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Prova i modelli nell'ordine di env.MODELS; su errori temporanei riprova una volta e poi passa al successivo. */
export async function callGemini(env, body, path = 'generateContent') {
  const models = String(env.MODELS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!models.length) throw new Error('MODELS non configurato');
  let last = null;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify(body),
      });
      if (res.ok) return { res, model };
      last = res;
      if (!RETRYABLE.has(res.status)) return { res, model }; // errore vero (richiesta sbagliata, chiave): inutile riprovare
      await sleep(attempt === 0 ? 700 : 0);
    }
  }
  return { res: last, model: models[models.length - 1] };
}
```
Usala dove oggi fai `fetch(.../models/<nome>:generateContent ...)` e, se `res.ok` è falso, rispondi al telefono con il testo dell'errore
(l'app lo traduce in italiano e propone «Riprova»).

## 3. Cosa succede nell'app
Con il modello di riserva l'utente non vede più l'errore nella maggior parte dei casi. Se anche quello è sovraccarico,
compare «Il servizio AI è molto richiesto…» con il pulsante Riprova.

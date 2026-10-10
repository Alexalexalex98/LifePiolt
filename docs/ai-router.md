# Intelligenza di Theia: il router AI

Principio: **Theia non "pensa", delega.** Tutto ciò che si fa con algoritmi locali (impegni, task, note, obiettivi, umore, spese, pianificazione, priorità, analisi, correlazioni, insight, interessi, briefing, ricerca nei propri dati, report) resta sul telefono, offline, senza AI terze. Si delega solo ciò che serve davvero a un altro modello, scegliendo il migliore per quel compito, con limiti, privacy e consenso.

Oggi **nessun fornitore è collegato**: il router restituisce `not_connected` con un messaggio onesto che mostra il fornitore che userebbe, il testo riscritto e cosa uscirebbe dal telefono. Le AI si collegano col server.

## Codice

`src/lib/aiRouter/` è puro (nessun alias `@/`, testabile con node) tranne `runtime.ts`, che lo collega agli store.

| File | Compito |
|---|---|
| `index.ts` | Contratto con l'assistente: `routeRequest(req): Promise<RouteResult>` |
| `localFirst.ts` | Capacità locali (elenco mostrato all'utente) e `localVerdict()` |
| `classify.ts` + `keywords.ts` | Compito da testo/immagini, parole chiave in 12 lingue, confidenza, richiesta di conferma se ambiguo |
| `registry.ts` + `pricing.json` | Fornitori, capacità con punteggio 0-10, latenza, regioni, prezzi (stime) |
| `select.ts` | Punteggio qualità/costo/latenza/privacy, vincoli duri, preferenze, fallback, spiegazione |
| `rewrite.ts` | Prompt di riscrittura, `checkFidelity`, pulizia locale |
| `privacy.ts` | `redact`, `buildContext`, anteprima di cosa esce, consenso, cronologia degli invii |
| `quota.ts` + `plans.json` | Limiti per compito a finestre, budget, stima token |
| `postprocess.ts` | Semplificazione del testo, allegati salvabili in LifeDrive |
| `adapters/` | `ServerProxyClient` (non collegato / HTTP), mock per i test |
| `pipeline.ts` | `planRequest` (nessun effetto) e `routeDetailed` (esegue) |
| `runtime.ts` | Store, client, consenso (alert), simulatore |

Pipeline: classify → **locale?** (resta qui) → **ambiguo?** (chiarimento con 2-3 opzioni, zero spesa) → **Solo sul telefono?** (mai delega) → select → limiti → contesto minimo + redaction → riscrittura fedele → consenso → proxy → postprocess → `RouteResult`. Senza limiti verificati e consenso non si spende mai.

### Risultati speciali di `routeRequest`
- `kind: 'local'`, `status: 'answered'`: lo gestisce l'assistente sul telefono (di norma non arriva qui).
- `kind: 'clarify'`, `status: 'answered'`: `message` è la domanda, `text` contiene le opzioni, una per riga. Nessuna spesa.
- `status: 'not_connected'`: nessun fornitore collegato **oppure** modalità «Solo sul telefono» attiva (messaggio «Questa richiesta richiede un'AI esterna: attivala in Intelligenza di Theia»).
- `status: 'limit'`: limite raggiunto, `message` dice quando si azzera.

## Il server (proxy): contratto

L'app **non** chiama mai i fornitori e non contiene chiavi API. Chiama il nostro server con il token dell'utente; le chiavi stanno solo lì.

```
POST {BASE}/v1/ai/route
Authorization: Bearer <token utente>
{
  "kind": "chat|reasoning|vision_read|image_generate|image_edit|music_generate|speech_to_text|text_to_speech|document_create|agent_task|web_search|translate|summarize|rewrite",
  "provider": "gpt_image",               // id del registro
  "prompt": "…",                         // gia' ripulito (redaction) e, se serve, riscritto
  "attachments": [{ "id": "img0", "kind": "image", "mime": "image/jpeg" }],   // riferimenti; il binario va caricato a parte
  "constraints": { "lang": "it", "euOnly": false, "noImages": false, "docFormat": "pdf", "maxCost": 0.5 },
  "context": [{ "key": "lang", "value": "it" }]   // solo il minimo consentito
}
→ 200 { "ok": true, "text": "…", "assets": [{ "kind": "image|audio|document", "url": "…", "mime": "…", "title": "…" }],
        "usage": { "tokensIn": 0, "tokensOut": 0, "units": 1, "cost": 0.04 } }
→ 4xx/5xx { "ok": false, "error": { "code": "rate_limited|provider_down|content_blocked|unauthorized|quota|bad_request", "message": "…" } }
```
`rate_limited` e `provider_down` fanno passare al fornitore successivo del ranking; gli altri errori si fermano. Il server deve applicare **anche lui** limiti e budget (l'app è solo un primo controllo) e non registrare il contenuto. Configurazione app: `EXPO_PUBLIC_AI_BASE_URL` (vuoto = non collegato) e token utente (da definire con l'autenticazione).

## Riscrittura fedele

La riscrittura vera la fa un modello sul server (chiamata `kind: "rewrite"`, solo con un fornitore di testo a cui l'utente ha dato il consenso «sempre»). System prompt: `REWRITE_SYSTEM_PROMPT` in `rewrite.ts` (regole: stesso comando, niente di inventato, niente stile non richiesto, conservare numeri/nomi/quantità/colori/vincoli, segnalare le ambiguità senza risolverle, output JSON `{prompt, language, ambiguities}`).

`checkFidelity(original, rewritten)` verifica in modo deterministico: numeri (anche scritti a parole), nomi propri (con toponimi tradotti), testi tra virgolette, colori e oggetti noti in 12 lingue; rifiuta se manca qualcosa, se compare un numero/colore/oggetto/virgolettato nuovo, se si aggiungono parole di stile («photorealistic», «4k»...) non presenti nell'originale, o se la lunghezza è sproporzionata. Se fallisce si usa il testo dell'utente con la sola pulizia degli spazi e lo si segnala. Offline: `cleanLocal` (spazi, riempitivi, ripetizioni, punteggiatura).

Limiti noti: i dizionari di colori/oggetti sono parziali (un oggetto fuori lista non è controllato); i nomi propri non vengono controllati in tedesco.

## Semplificazione dell'output

Localmente (`simplifyText`): toglie il markdown, accorcia secondo lo stile (breve / diretto / discorsivo, da `usePrefs`), mette le azioni in elenco. Quando ci sarà un modello, `SIMPLIFY_SYSTEM_PROMPT` (in `postprocess.ts`) fa lo stesso senza cambiare fatti.

## Privacy

- Contesto minimo per compito: immagini, musica, voce, traduzioni, visione e ricerca web non ricevono **nessun** dato personale; il testo riceve lingua e stile; task/obiettivi/note/salute/finanze solo se la richiesta li cita **e** l'utente li condivide con l'assistente in «Cosa condivido» (`ai_memory`, `health_activity`, `fin_summary`).
- Mai: carte e IBAN, conti e movimenti, dati clinici, documenti fiscali e d'identità, posizione, contatti.
- Redaction euristica di carte (Luhn), IBAN, email, telefoni, indirizzi prima dell'invio (disattivabile).
- Consenso prima del primo invio a un fornitore e ogni volta che ci sono immagini o dati sensibili: Consenti una volta / sempre / Annulla.
- «Cosa è stato inviato»: registro locale con tipo, fornitore, data, dimensione. Mai il contenuto.

## Limiti e costi

`plans.json`: Gratis / Plus / Pro, **valori d'esempio da decidere**. Finestre: giorno locale (mezzanotte del fuso del telefono) e finestra mobile (es. 30.000 token stimati ogni 5 ore; un uso di esattamente 5 ore fa è già fuori), più budget di costo giornaliero e mensile. `canSpend` restituisce `{ok}` oppure `{limit, used, max, resetAt, reason}`. I token sono una **stima** dalla lunghezza del testo (CJK e alfabeti non latini pesano diversamente).

## Da verificare prima dell'uso reale

- Tutti i prezzi in `pricing.json` (stime, data e fonte vuote): vanno verificati sui listini ufficiali.
- Punteggi di qualità e latenze in `registry.ts`: giudizi di partenza da confrontare con prove reali.
- Regioni di elaborazione e politica di addestramento dei fornitori: dichiarate «da verificare» e lette dai contratti API.
- Esistenza di API ufficiali per Suno e Midjourney.
- Piani e limiti: esempio, da decidere insieme al prezzo.

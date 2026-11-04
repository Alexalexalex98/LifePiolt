# Server vocale open source per LifePilot

Legge qualunque testo a schermo con voci di qualità, **una femminile e una maschile per ogni lingua**.
Modelli (tutti con licenza libera, uso commerciale consentito):

| Lingue | Modello | Licenza |
|---|---|---|
| italiano, inglese, spagnolo, francese, tedesco, portoghese, russo, cinese, giapponese | Qwen3-TTS (1.7B) | Apache 2.0 |
| arabo, hindi | Chatterbox Multilingual | MIT |
| indonesiano | nessun modello open source abbastanza buono: l'app usa la voce del telefono | — |

Le voci nascono da una descrizione («donna calma e rassicurante…», «uomo caldo…») con la funzione *Voice Design* di Qwen3-TTS: **non clonano nessuna persona reale**. La prima volta si creano, poi restano identiche per sempre (file in `data/voices`).

> **Non l'ho potuto provare**: dal mio ambiente non ho accesso a una GPU né ai pesi dei modelli. Il codice segue le API ufficiali, ma il primo avvio può richiedere qualche aggiustamento. Provalo prima con `/demo` e dimmi cosa non va.

## Cosa serve
- Una **GPU NVIDIA con almeno 12 GB** di memoria (RTX 3060 12 GB o migliore), Docker con il supporto NVIDIA, circa 25 GB di disco per i modelli.
- Nessun costo di licenza. L'hardware è tuo (il tuo PC) oppure lo noleggi: **la scelta e la spesa sono tue**, io non ne attivo.

## Avvio (sul tuo PC con GPU)
```bash
cd server/tts
cp .env.example .env        # scrivi in TTS_API_KEY una chiave lunga e casuale
docker compose up --build   # la prima volta scarica i modelli e crea le 22 voci (alcuni minuti)
```
Apri `http://IL-TUO-PC:8000/demo`: scegli la lingua e premi **Donna** o **Uomo · Ascolta**. Così senti tutte le voci prima di metterle nell'app.

Per ascoltarle senza il server web: `docker compose run --rm tts python3.11 samples.py` crea i file in `samples/`.

## Collegarlo all'app
1. Rendi il server raggiungibile da internet con HTTPS, ad esempio con un tunnel gratuito di Cloudflare (`cloudflared tunnel --url http://localhost:8000`).
2. Nell'app: **Benessere mentale › Voce › Il mio server vocale**. Inserisci l'indirizzo e la chiave (la chiave la scrivi solo lì, mai in chat).
3. Per ogni lingua premi **Donna** o **Uomo**: l'app userà `f-it`, `m-de`, ecc. e **Prova** fa sentire la voce.
4. Offline o se il server non risponde l'app ripiega da sola sulla voce del telefono.

## Voci
`GET /v1/voices` elenca gli id: `f-it`, `m-it`, `f-en`, `m-en`, `f-es`, `m-es`, `f-fr`, `m-fr`, `f-de`, `m-de`, `f-pt`, `m-pt`, `f-ru`, `m-ru`, `f-zh`, `m-zh`, `f-ja`, `m-ja`, `f-ar`, `m-ar`, `f-hi`, `m-hi`.
Per cambiare una voce cancella i suoi file in `data/voices` (`f-it.wav` e `f-it.txt`): verrà ricreata. Oppure sostituiscili con un tuo audio (e il suo testo) per usare una voce che hai registrato tu o che hai il permesso di usare.

## Sicurezza
- Il server risponde solo con la chiave (`TTS_API_KEY`). Non pubblicarlo senza chiave.
- Il testo letto viene inviato al tuo server: è tuo, non di terzi. L'audio già generato resta in `data/cache`.

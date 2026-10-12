# Qualita e test di LifePilot

Questa pagina spiega **cosa controlla cosa**, dove gira e come lanciarlo. Per provare a mano le funzioni native sul telefono vedi `docs/test-su-telefono.md`.

## Perche serve

Fino a ieri testavamo quasi solo la versione web (Playwright). I problemi segnalati sono quasi tutti **nativi**: tastiera Android che copre la barra di scrittura, microfono, permessi, notifiche, archivio. Il web non li vede. La rete di sicurezza ora ha tre livelli oltre al web: test di logica, test di migrazione dei dati e flussi Maestro su emulatore Android.

## La piramide

| Livello | Cosa prova | Dove | Tempo | Comando |
|---|---|---|---|---|
| Tipi | `tsc` pulito | CI + locale | 30 s | `npx tsc --noEmit` |
| Lint | eslint: gli errori bloccano, i warning no | CI + locale | 20 s | `npx eslint src` |
| Logica (unit) | pianificatore, analisi, sync, db, backup, i18n, bollette, colloquio, club... in Node puro | CI + locale | 1-2 min | `npm test` |
| Migrazione dati | stati salvati da versioni passate si aprono col codice attuale | CI + locale (dentro `npm test`) | 1 s | `npm run test:migration` |
| Prestazioni | tempi su 5 anni di dati sintetici, con budget larghi | CI (job `perf`) + locale | 15 s | `npm run bench` |
| Web e2e | schermate e flussi nel browser (Playwright, chromium) | CI (job `web-e2e`) | 5-8 min | `npm run e2e` (serve prima l'export, vedi sotto) |
| **Nativo e2e** | tastiera, permessi, notifiche, allegati, blocco, backup su emulatore Android reale | GitHub Actions `android-e2e` (a mano / su tag) o telefono collegato | 30-60 min | `npm run maestro` |
| Manuale | cio che l'emulatore non sa fare (microfono vero, biometria, Apple Health, notifiche a schermo spento) | sul tuo telefono | 20 min | checklist in `docs/test-su-telefono.md` |

## Cosa gira dove

* **Ad ogni push e pull request** (`.github/workflows/ci.yml`): job `check` (tipi, lint, `npm test` su Node 22 e 24, controllo statico dei flussi Maestro), `perf` (benchmark), `web-e2e` (export web + Playwright), `doctor` (`expo-doctor`, non bloccante, serve rete) e `i18n` (controllo traduzioni, non bloccante). Nuovi push sullo stesso ramo annullano le esecuzioni in corso.
* **A mano o su tag `v*` / `e2e-*`** (`.github/workflows/android-e2e.yml`): costruisce l'APK (o ne scarica uno da URL), avvia un emulatore Android 14, esegue i flussi Maestro con tag `smoke,native` e carica report JUnit, screenshot e video come artifact.
* **`.github/workflows/i18n.yml`** e di un altro lavoro (traduzioni automatiche): non toccarlo da qui.

## Come eseguire in locale

```bash
npm ci --legacy-peer-deps      # il repo usa legacy-peer-deps (c'e' un .npmrc)
npx tsc --noEmit
npx eslint src
npm test                       # tutta la logica + migrazione
npm run bench                  # benchmark; BENCH_FACTOR=3 su macchine lente
```

Web e2e:

```bash
npx expo export --platform web --output-dir dist
node scripts/ci/serve-static.mjs dist 8142 &      # server statico con ripiego SPA
node tests/e2e/smoke.mjs http://127.0.0.1:8142    # servono playwright e chromium (PLAYWRIGHT_PATH / CHROMIUM_PATH)
```

Maestro su telefono o emulatore (serve `adb` e [Maestro](https://maestro.mobile.dev) installato):

```bash
npm run maestro:check                                  # controllo statico, senza dispositivo
adb install -r lifepilot.apk                           # APK "preview" o release, NON il dev client
maestro test .maestro --include-tags=smoke             # solo gli smoke
maestro test .maestro/02-barra-scrittura-tastiera.yaml # un flusso
# oppure, con report/video per flusso come in CI:
APK=lifepilot.apk INCLUDE_TAGS=smoke,native bash scripts/ci/android-e2e-run.sh
```

I flussi cercano i testi **in italiano**: il telefono/emulatore deve essere in italiano (lo script di CI lo imposta). Con altra lingua l'app parte in quella lingua e i testi non coincidono.

## Cosa copre Maestro (`.maestro/`)

Ogni flusso ha un tag e salva screenshot (`takeScreenshot`). Tag: `smoke` (rapido, deve passare sempre), `native` (usa permessi/sistema), `slow`, `fragile` (dipende dal dispositivo: non fa fallire la pipeline).

| File | Tag | Verifica |
|---|---|---|
| `01-avvio-onboarding` | smoke | avvio pulito, nome, dati demo, guida chiusa, Home |
| `02-barra-scrittura-tastiera` | smoke, native | con tastiera aperta il campo e i pulsanti "Invia" e "Allega" restano visibili |
| `03-permesso-notifiche` | native | messaggio preliminare, dialog di sistema "Consenti", stato "Attive" |
| `04-notifica-di-prova-5s` | native, slow, fragile | notifica di prova dopo 5 s nella tendina |
| `05-impegno-con-luogo` | smoke | crea un impegno con luogo |
| `06-allegati` | smoke, native | foglio "Allega" con le nove voci, Incolla testo, Posizione |
| `07-microfono` | native | permesso e messaggio chiaro (mai silenzio) |
| `08-blocco-app` | native, slow | attiva il blocco e riapre l'app: compare "Sblocca" |
| `09-backup-cifrato` | native, slow | crea il backup cifrato con password (selettore file: fragile) |
| `10-cambio-lingua` | smoke | italiano, inglese, arabo (RTL), ritorno |
| `11-bollette` | smoke | incolla testo, revisione, conferma, piano |
| `12-lifeclub` | smoke | iscrizione gratuita e domanda ancorata |
| `13-colloquio` | smoke | invito e accettazione |

I sotto-flussi condivisi stanno in `.maestro/subflows/` (avvio pulito, onboarding demo, chiudi guida, apri pagina con collegamento `lifepilot:///<route>`, consenti permesso).

### Limiti noti

* **Mai eseguiti in questo ambiente** (nessun emulatore): i selettori sono ricavati dai testi nel codice e vanno confermati alla prima esecuzione reale. Aspettati qualche aggiustamento.
* L'APK deve essere una build **release/preview** (JS incluso). Il dev client apre il launcher di sviluppo e rompe `clearState`.
* Il microfono vero e la biometria non esistono sull'emulatore: il flusso verifica solo il permesso e il messaggio di errore, non la trascrizione.
* Le notifiche a schermo spento, il risparmio energetico e i produttori che chiudono le app in background (Xiaomi, Samsung...) si provano solo su telefono reale.
* Il selettore file del backup e la tendina notifiche cambiano da versione a versione di Android.
* I giorni del calendario, le card dei club e simili non hanno identificatori stabili: vedi sotto.

### Identificatori da aggiungere nell'app per renderli stabili (non fatto: l'app non si tocca da qui)

Oggi nell'app c'e solo qualche `testID` sparso. Maestro li legge con `id:`. Proposti:

| Dove | testID | Serve a |
|---|---|---|
| `Composer.tsx` campo di testo | `composer-input` | tocco/scrittura indipendenti dal segnaposto (che cambia con sezione e lingua) |
| `Composer.tsx` pulsante invio / allega / microfono | `composer-send`, `composer-attach`, `composer-mic` | oggi si usano le accessibilityLabel "Invia", "Allega", "Parla a Theia (...)" (tradotte: cambiano con la lingua) |
| `Composer.tsx` contenitore | `composer-bar` | controllare che la barra intera resti sopra la tastiera |
| `plan.tsx` giorno del calendario | `day-YYYY-MM-DD` | aprire un giorno preciso |
| `plan.tsx` campi nuovo impegno | `event-time`, `event-title`, `event-place`, `event-add` | oggi si usa il segnaposto |
| `NotifSettings.tsx` stato permesso | `notif-status` | leggere "Attive" senza testo |
| card club / lezione / "Chiedi qui" | `club-card-<id>`, `ask-here` | scegliere un club preciso |
| `ErrorBoundary` | `error-boundary` (gia presente) | fallire il flusso se compare la schermata d'errore |

Etichette di accessibilita **gia presenti** usate dai flussi (`Composer.tsx`): "Allega", "Invia" (con stato disabilitato), "Parla a Theia (<lingua>)" / "Ferma l'ascolto", "Lingua di questo messaggio: <lingua>". Nel foglio allegati ogni voce e un pulsante con la sua etichetta ("Scatta una foto", "Galleria", "Scegli un file", "Incolla testo", "Posizione", "Contatto", "Nota", "Da LifeDrive", "Impegno").

## Test di migrazione dei dati (`tests/migration/`)

* `tests/fixtures/state-v0.json`: stato **congelato** nel formato AsyncStorage di prima dell'engine SQLite (17 store, un anno di dati sintetici piu store scritti a mano). `backup-v1.json`: backup nel formato 1 costruito da quello stato. **Non vanno rigenerati**: servono a garantire che chi aggiorna l'app non perda i dati. Il generatore e `tests/fixtures/make-state-v0.mjs` (usarlo solo per aggiungere store nuovi).
* `migration.test.mjs` controlla: nessuna perdita di campi, tipi corretti, versione corrente dopo la migrazione, idempotenza, rifiuto di versioni future (backup e store), riparazione di campi con tipo sbagliato o elementi non validi, quarantena dei blob non JSON senza bloccare gli altri store, percorso completo AsyncStorage -> SQLite (`runLegacyMigration` + `KvEngine`).
* Quando alzi `CURRENT_SCHEMA_VERSION` o cambi uno schema: aggiungi **una nuova fixture** (`state-v1.json` ...) e un test che la apre; lascia quelle vecchie.

## Benchmark (`tests/perf/bench.mjs`)

17 misure su 5 anni di dati sintetici (15 MB): idratazione e scrittura dello storage, backup, ricerca (memoria e FTS5), analisi e previsioni, pianificatore, diff di sincronizzazione. Ogni misura e la mediana di 5 esecuzioni; il test fallisce solo se supera un budget **10-50 volte** il tempo tipico (cattura regressioni di ordine di grandezza, non rumore). Variabili: `BENCH_FACTOR` (moltiplica i budget), `BENCH_RUNS`, `BENCH_ONLY=<parte del nome>`. Il report e `tests/perf/report.json` (ignorato da git, caricato come artifact in CI). I moduli assenti vengono saltati con un avviso (oggi `habits` non ha ancora un benchmark: aggiungilo in fondo a `bench.mjs`).

## Costi e tempi della CI

| Workflow | Minuti runner tipici | Note |
|---|---|---|
| `ci.yml` (5 job) | circa 25-30 minuti totali per push (in parallelo, ~10 di attesa) | la cache npm riduce l'installazione; `cancel-in-progress` evita sprechi |
| `android-e2e.yml` build locale | 25-45 min (Gradle a freddo) | solo x86_64; con cache Gradle ~15-25 min |
| `android-e2e.yml` emulatore + 13 flussi | 20-40 min | KVM abilitato; l'emulatore parte in 2-4 min |

Un giro completo di `android-e2e` costa quindi circa 45-90 minuti-runner (su repo privato i runner Linux contano 1x). Per risparmiare: passa `apk_url` con una build EAS gia fatta (`eas build --platform android --profile preview`), oppure lancia solo `smoke`.

Ottimizzazioni future: cache dello snapshot AVD (`actions/cache` sul percorso `~/.android/avd`), build EAS `preview` come artifact del tag invece della build locale, esecuzione dei flussi in parallelo su piu emulatori.

## Cosa resta manuale

Microfono e riconoscimento vocale reali, biometria (impronta/volto), notifiche con schermo spento e app chiusa, risparmio energetico dei produttori, posizione GPS reale, Apple Health/Watch, foto e galleria reali, aspetto con tastiere di terze parti (Gboard, SwiftKey, Samsung), schermi pieghevoli, TalkBack. Usa la checklist di `docs/test-su-telefono.md`.

## Quando aggiungere un test

* Bug trovato sul telefono: prima un test di logica (se la causa e nella logica pura) o un flusso Maestro (se e nativo), poi la correzione.
* Nuovo store o campo persistito: aggiorna `tests/fixtures` (nuova fixture) e `tests/migration`.
* Nuova schermata importante: una voce in `tests/e2e/smoke.mjs` (web) e, se usa funzioni native, un flusso in `.maestro/`.

# Audit: app generica per chiunque

Obiettivo: un nuovo utente (studente, impiegato, genitore, pensionato, freelance, operaio...) non deve leggere nulla che suoni fatto solo per imprenditori o investitori. Le funzioni per chi investe o fa impresa restano, ma come funzioni opzionali e non come linguaggio di default.

Legenda decisione: CAMBIA = testo/dato riscritto in forma generica; TIENE = resta, motivato; DIETRO OPZIONE = resta ma non è proposto di default.

## 1. Dati demo (profilo "Alex")

| Dove | Trovato | Decisione |
|---|---|---|
| `src/data/seed.ts` obiettivi | LifePilot MVP, Tedesco C1, Fitness 4x | CAMBIA: Correre 10 km, Imparare lo spagnolo, Risparmiare per le vacanze, Leggere 12 libri |
| `seed.ts` task | Architettura prodotto, Review dashboard | CAMBIA: Fare la spesa, Prenotare il dentista, Rinnovare l'assicurazione auto, Preparare la riunione di lunedì |
| `seed.ts` task completati | Chiamata con il fornitore, Aggiornare la roadmap, Pagare le fatture | CAMBIA: nomi quotidiani (bollette, tavolo per sabato, scrivania...) |
| `seed.ts` automazioni | Briefing / Review settimanale | CAMBIA: Riepilogo ogni mattina, Bilancio settimanale |
| `seed.ts` note | AURA, fornitori PCB, investitori, pitch deck, socio hardware, trading, canzone Dæmon, locale Élite Caffè | CAMBIA: ricette, lista spesa, vacanze, spagnolo, assicurazione, programma di corsa, regali, visita medica, libri |
| `seed.ts` file LifeDrive | Pitch deck AURA, Foto locale Élite Caffè, Foto team fiera, Fattura fornitore PCB, pranzo con investitori | CAMBIA: documenti e foto di vita quotidiana; cartella "Business" diventa "Lavoro" |
| `seed.ts` impegni | Colazione con investitore, Call fornitore PCB, Revisione roadmap, Sopralluogo Élite Caffè, Colloquio socio hardware, Deep work AURA | CAMBIA: visita medica, riunione di team, dentista, cena con amici, appuntamento in banca, calcetto... (rimane un impegno alle 10:00 di domani: l'e2e lo usa per provare il conflitto) |
| `seed.ts` finanze | stipendio 6500, affitto, cassa malati, spesa, abbonamenti, bollette | TIENE: già quelli di una persona normale; categorie invariate |
| `src/data/network-seed.json` post | round pre-seed, prototipo AURA, roadmap, prototipo fintech, SAFE/equity, primo ufficio, meetup | CAMBIA: running, ricette, viaggi, libri, famiglia, casa, bollette, lavoro in generale |
| `network-seed.json` community | Founders Svizzera | CAMBIA: Cucina veloce; "Corridori del lunedì" diventa "Corsa a Lugano"; aggiunta "Genitori di Zurigo" |
| `network-seed.json` servizi | Business Coaching (Alex), Business Coach (Luca Ferri), consulente fiscale per freelance | CAMBIA: Allenamento alla corsa, Coach del sonno, consulenza fiscale per privati; aggiunta insegnante di yoga (Laura Neri) |
| `network-seed.json` idee | AURA (laser anti-zanzare, raccolta LP, early-bird 199-349 CHF) primo in elenco; "equity simbolica 0.1%" | CAMBIA: "Orto condiviso del quartiere" (idea comunitaria) spostata in fondo all'elenco, non più in evidenza; ricompensa senza equity |
| `network-seed.json` seminari | pricing per startup, pitch investitori, bilancio, fiscale per freelance | CAMBIA: Organizzare il budget familiare in 3 passi, Primo soccorso, Dormire meglio, Dichiarazione fiscale passo per passo |
| `network-seed.json` notifiche/chat/ledger/scheda | AURA, roadmap, "Imprenditore", B2B Sales | CAMBIA: testi neutri; professione "Impiegato" |
| `src/data/marketSeed.ts` | descrizioni di seminari/servizi/community per startup, pitch, freelance | CAMBIA: tutte riscritte per un pubblico generale |
| `src/data/jobsSeed.ts` | Life SA, Addetto vendite B2B (AURA), Skillswap, Fridge Lab, Ferri Coaching | CAMBIA: negozio di articoli sportivi, assistenza clienti, assistente amministrativo, accoglienza in un centro benessere. Le prove di competenze restano (sono la funzione Lavoro) |
| `src/data/moodDemo.ts` | nulla di imprenditoriale | TIENE |
| `src/store/demo.ts` | chat con AURA, investitori, beta tester, prototipo, fornitore sensori, "Founder di Life SA" | CAMBIA: running, gita, trasloco, weekend, team d'ufficio (agenda condivisa, sondaggi, task, note, orari, posizione, contatti e inviti restano tutti). Gruppo "Team AURA" (`g:demo-aura`) diventa "Team ufficio" (`g:demo-team`), e2e aggiornato |

## 2. Guida, tour, onboarding, funzione del giorno, Theia

| Dove | Trovato | Decisione |
|---|---|---|
| `src/data/features.ts` | "Soldi chiari, tasse comprese"; "Azioni e portafoglio"; "Previsioni e fondo emergenza" | CAMBIA: tagline "Spese, bollette e risparmi sotto controllo"; le due funzioni da investitore passano a "Se investi: ..." e sono marcate `niche` |
| funzione del giorno | poteva proporre Stock/Portafoglio | DIETRO OPZIONE: le funzioni `niche` non sono proposte come funzione del giorno se l'utente non ha scelto "Investire e fare impresa"; chi sceglie delle aree le vede a giorni alterni, le altre ruotano comunque |
| `src/lib/tour.ts` livello 4 | "Movimenti, budget e previsioni" | CAMBIA: spese, bollette, risparmi e budget; "Se investi: più avanti trovi anche Previsioni, Stock e Portafoglio" |
| tour benvenuto | già generico | CAMBIA: apertura "Organizza giornate, salute, soldi, viaggi e persone in un posto solo" |
| `src/app/onboarding.tsx` | frase d'apertura | CAMBIA + NUOVO: domanda facoltativa "Cosa ti interessa di più?" con 8 scelte generiche, salvata in `useInterests.areas` (retrocompatibile, inclusa in backup e cancellazione dati) |
| `src/components/Discover.tsx` | guida in ordine fisso | CAMBIA (logica minima): gruppi ordinati con le aree scelte per prime (`orderedGroups`), funzione del giorno che le preferisce. Nulla viene nascosto |
| `src/components/FinTabs.tsx` | "Stock" era la prima scheda delle Finanze | CAMBIA: Stock in fondo, "Finanza personale" per prima |
| chip di Theia (`ai.tsx`, `TheiaHost.tsx`) e `localFirst.ts` | già quotidiani (riunione, task, finanze) | TIENE |
| `src/lib/assistant/engine.ts` esempi nella guida/aiuto | "segna il business plan come urgente", "chiamata investitori", "idee per AURA" | CAMBIA: relazione, visita dal dentista, idee per il weekend |
| `src/lib/ai.ts` | agente Business "su Life/AURA", "Tedesco C1" | CAMBIA: testi generici (lavoro o progetto, obiettivo di studio) |

## 3. Placeholder, categorie e tag

| Dove | Decisione |
|---|---|
| `plan.tsx` "Es. Creare il business plan per Life" | CAMBIA: "Es. Preparare la presentazione per lunedì" |
| `(tabs)/plan.tsx` "Es. Tedesco C1" | CAMBIA: "Es. Imparare lo spagnolo" |
| `chat/ShareSheets.tsx` "Es. Call su AURA" | CAMBIA: "Es. Caffè con Marco" |
| `NetSheets.tsx` idea: "problema, mercato", "equity" | CAMBIA: "di cosa si tratta, a chi serve"; ricompensa "un ringraziamento, un prodotto, uno sconto, un invito"; "come nel registro di commercio" tolto (anche in `lifenetwork.tsx`) |
| tag dei post / argomenti community (`network.ts topicList`) | CAMBIA: "Business" non è più il primo; ordine Fitness, Cucina, Viaggi, Lingue, Mind, Genitori, Libri, Musica, Casa, Soldi, Lavoro, Tech |
| cartelle LifeDrive | CAMBIA: "Business" diventa "Lavoro" (rilevamento automatico: lavoro, stipendio, busta paga, ufficio, colloquio) |
| categoria assistente "Business" (`lib/ai.ts`) | TIENE il nome interno; l'interfaccia la mostra già come "Lavoro" |

## 4. Store

`docs/store/scheda-store.md` e `app.json` (description): già privi di riferimenti a investitori; aggiunta la frase "pensata per chiunque" e la sezione Finanze riscritta su spese, bollette e budget, con il simulatore di investimenti come funzione "se ti interessa".

## 5. Cosa resta (giustificato)

- Funzioni opzionali: Stock, Portafoglio, Previsioni (pagine `stocks`, `portfolio`, `lifeforecast`), Idee con raccolta LifePoints, Lavoro con test di competenze, LifeClub. Restano nel prodotto, dietro il percorso graduale (livelli 4 e 6) e con descrizioni "Se investi: ...".
- Vocabolari di riconoscimento (non visibili): `priority.ts`, `taskDecompose.ts`, `nlp.ts`, `knowledge.ts` contengono parole come "business plan", "pitch", "investitori", "startup" per capire cosa scrive l'utente. Sono liste di parole chiave, non testo mostrato.
- Test (`tests/*.test.mjs`): usano "business plan", "chiamata investitori", "AURA" come input di esempio per il parser; non sono dati demo.
- Spiegazione del punteggio di un'idea (`NetSheets.tsx`): cita "problema, mercato, ricavi, concorrenza, team" perché descrive i criteri reali del calcolo (`lib/network.ts`). Funzione opzionale delle Idee.
- Etichetta "Titolare" nelle idee e "Titolare/Coniuge" nella dichiarazione fiscale: termini generici, non imprenditoriali.
- Catalogo traduzioni (`src/i18n/locales/*`): contiene ancora i vecchi testi come chiavi orfane; non toccato.
- Dati già salvati sul telefono da versioni precedenti (file con cartella "Business", tag "Business") restano visibili come prima; solo i nuovi dati usano "Lavoro".

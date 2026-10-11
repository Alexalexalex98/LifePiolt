# LifeClub

Il LifeClub e' la zona di ogni creatore (persona o attivita') dove scrive con i suoi follower. Ha tre sezioni:

1. **Free** - corsi, lezioni e annunci gratuiti per chi segue o si iscrive.
2. **Premium** - contenuti a pagamento con quota mensile (prova gratuita e sconto annuale facoltativi). Una lezione premium puo' avere una "anteprima gratuita".
3. **Chat** - il canale del club, che compare nelle chat degli iscritti (silenziabile, si esce quando si vuole). Il creatore sceglie chi scrive: solo lui, tutti gli iscritti, solo i Premium, persone scelte, nessuno. Modalita' lenta, domande evidenziate, messaggio fissato.

Il punto di forza rispetto ai corsi online classici: **commenti e domande ancorati al minuto** del video (o alla pagina/paragrafo) e instradati **anche nella chat del club**, dove il creatore risponde e gli studenti ricevono la notifica. Ogni risposta e' votabile ("botta e risposta") e il voto alimenta la reputazione di chi risponde.

## Cosa e' locale oggi (onesta')

Non esiste ancora un server. Oggi:

- tutti i dati (club, corsi, iscrizioni, commenti, voti) stanno sul telefono (store `club`, incluso nel backup);
- i file caricati (video, audio, PDF, immagini, file) vengono copiati nella memoria dell'app, nessun upload; limiti: video 200 MB, audio 60 MB, PDF/file 50 MB, immagini 10 MB (`src/lib/club/limits.ts`). Su web restano validi finche' la pagina e' aperta;
- **nessun pagamento reale**: la conferma Premium e' una simulazione, i rinnovi e i guadagni sono dimostrativi, la UI lo dice;
- i club di esempio (modalita' demo) hanno iscritti fittizi e video/audio/PDF senza file: il lettore usa un cronometro dimostrativo; in demo il creatore "risponde" da solo dopo qualche secondo;
- le notifiche sono locali (stessa pipeline delle altre, con `ref` `club:<id>` e `clubcontent:<id>:<lezione>[:<secondi>]`) e rispettano il silenziamento.

## Modello dati (`src/lib/club/types.ts`)

| Entita' | Campi principali |
|---|---|
| `Club` | id, owner, name, tagline, description, cover {c1,c2,uri?}, categories, published, `pricing`, `chat`, courses[], posts[] |
| `Pricing` | monthly, currency, trialDays (0-30), yearlyDiscountPct (0-50) |
| `ChatConfig` | write: creator / members / premium / chosen / none, chosen[], slowSec, commentsWhenReadOnly |
| `Course` | title, description, level, sections[], lessons[], published |
| `Lesson` | kind video/audio/pdf/testo/file/link, tier free/premium, preview, uri/fileName/size/mime, durationSec, pages, text, url |
| `Membership` | user, clubId, tier follower/free/premium, status attiva/in_pausa/annullata, renews, plan, nextChargeAt, endsAt, trialEndsAt, mutedByOwner, mutedUntil, everJoined |
| `ClubComment` | lessonId, author, text, anchor {time sec / page / para}, parentId, isQuestion, resolved, chatMsgId, likes[], saved[] |
| `AnswerVote` | answerId, questionId, asker, voter, answerer, stars 1-5, note |

Chat: `Chat.type = 'club'`, id `club:<clubId>`; i messaggi hanno `club` (kind question/answer/announce/content, lessonId, label, sec/page/para, commentId) e `pinned`.

## Regole (funzioni pure, testate in `tests/club*.test.mjs`)

- **Accesso** (`tier.ts`): il creatore vede tutto; le bozze sono private; anteprima gratuita per chiunque; contenuti free per follower/iscritti; premium solo per chi ha accesso Premium attivo.
- **Abbonamento** (`subscription.ts`): free = disiscrizione immediata; Premium annullato = rinnovo fermo e accesso fino a fine periodo pagato (si puo' riprendere); la prova non si ripete.
- **Chat** (`chatPerms.ts`): permessi, modalita' lenta (il creatore e' esente), un utente silenziato dal creatore non scrive. Se la chat e' in sola lettura le domande restano nei commenti della lezione (se il creatore li abilita).
- **Reputazione** (`reputation.ts`): `qaRating` = media smorzata `(somma + 3,5*5)/(n + 5)`; `qaScore` combina voto di chi ha chiesto (peso 1), altri iscritti (0,5), mi piace (0,15), salvataggi (0,3), LifePoint donati (0,5, max 3); i segnali impliciti non superano il 40% del peso. Anti-abuso: un voto per scambio, non si vota se stessi, solo dopo l'iscrizione, max 10 voti in 24 h.
- **Valutazione del club**: solo chi si e' iscritto almeno una volta (anche se poi annulla).

## Contratto server proposto

Tutti gli endpoint richiedono autenticazione; l'accesso ai file e' sempre verificato lato server.

```
POST   /clubs                       crea club (verifica identita' creatore)
GET    /clubs/:id                   pagina pubblica (solo parti free + metadati premium)
PATCH  /clubs/:id                   modifica (solo owner)
POST   /clubs/:id/courses | /lessons        gestione contenuti
POST   /uploads                     URL di upload firmato -> trascodifica video (HLS) + antivirus
GET    /lessons/:id/stream          URL firmato a scadenza breve, solo se entitlement valido
POST   /clubs/:id/membership        {tier: follower|free|premium, plan}   (premium: crea sessione di pagamento del provider)
DELETE /clubs/:id/membership        disiscrizione (premium: cancel_at_period_end)
POST   /webhooks/payments           eventi del provider (rinnovo, fallimento, rimborso, chargeback) -> aggiorna entitlement
GET    /lessons/:id/comments        ?after=cursor
POST   /lessons/:id/comments        {text, anchor, parentId, isQuestion}  -> crea anche il messaggio nella chat del club
POST   /answers/:id/vote            {stars, note}   (limiti e controlli anti-abuso lato server)
WS     /clubs/:id/chat              messaggi in tempo reale, permessi di scrittura e modalita' lenta applicati dal server
POST   /clubs/:id/members/:user/mute | DELETE ...   moderazione
POST   /reports                     segnalazioni
```

Provider di pagamento: Stripe (web/Android) e acquisti in-app Apple/Google dove le regole degli store lo richiedono; l'app non vede mai dati di carta. L'entitlement Premium e' deciso solo dal server.

## Moderazione

Segnalazione di club, contenuti e commenti; il creatore puo' rimuovere commenti, silenziare o rimuovere un iscritto; la piattaforma puo' sospendere un club. Filtri su contenuti illeciti e malware nei file caricati. I nomi dei creatori collegati a una persona restano sempre visibili.

## Punti legali da chiarire prima del lancio

- **Contenuti digitali a pagamento**: informazioni chiare su prezzo, rinnovo automatico e come annullare; diritto di recesso (UE: 14 giorni, con rinuncia espressa e consapevole all'avvio immediato del contenuto digitale); rimborsi.
- **IVA** sui servizi digitali (luogo del consumatore, OSS), fatturazione e ricevute; commissioni della piattaforma e degli store.
- **Identita' e requisiti del creatore** (KYC, antiriciclaggio del provider), contenuti protetti da copyright, responsabilita' dei contenuti caricati.
- **Dati personali**: le iscrizioni e le domande sono dati dell'utente (vedi `src/lib/dataCatalog.ts`, voci `club_*`); minori; conservazione e cancellazione.
- **Contenuti sensibili** (salute, finanza, legale): nessuna consulenza; avvisi del creatore.

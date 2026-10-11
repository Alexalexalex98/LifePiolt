# LifeNetwork Lavoro: assunzioni per competenze, senza CV

Idea: **niente curriculum**. Chi cerca lavoro lo trova in base a ciò che sa fare davvero, misurato con un test creato ad hoc per quel lavoro;
chi assume non vede nulla tranne il **nome**. Solo se vuole, invita a un colloquio in videochiamata; il **contatto si sblocca solo quando il candidato risponde alla chiamata**.

## Il flusso
1. **Offerta con test** (azienda): competenze, importanza, soglie, domande della banca o proprie (scelta multipla, numero, aperta, file, grafici), prova pratica a tempo. Nessun campo per CV, scuole, foto, età.
2. **Candidatura alla cieca** (candidato): prima del test vede cosa vedrà l'azienda e acconsente. L'azienda vede: nome, punteggi per competenza, adeguatezza, risposte aperte/pratiche. Ordine per adeguatezza.
3. **Invito al colloquio** (azienda): 1-3 fasce orarie (data, ora, durata), fuso e lingua, messaggio breve. Nessun dato del candidato viene rivelato. Il candidato riceve una notifica (categoria Lavoro) e la schermata "La mia candidatura".
4. **Risposta** (candidato): Accetta (sceglie la fascia e quali contatti sbloccare: di base nessuno oltre al canale della videochiamata) / Propone un'altra fascia / Rifiuta (motivo facoltativo, nessuna conseguenza) / Non risponde (l'invito scade dopo 72 h o all'ultima fascia). L'accettazione aggiunge il colloquio al Plan di entrambi (ref `job:<id>`, con promemoria).
5. **Chiamata** (azienda): da 10 minuti prima fino alla fine della fascia l'azienda ha "Chiama il candidato"; chiama sempre l'azienda, mai il candidato. Il candidato vede "Chiamata in arrivo" (Rispondi / Rifiuta, squilla 45 s). Stanza 1-a-1 esistente in modalità colloquio, con etichetta "Anteprima".
6. **Sblocco**: SOLO quando il candidato risponde si sblocca ciò che ha scelto (nome completo, email, telefono). L'azienda vede "Contatto sbloccato il … durante il colloquio". Se rifiuta o non risponde: nessuno sblocco; l'azienda può riprovare per 15 minuti, poi "Colloquio non avvenuto" e può riproporre.
7. **Esito**: avanti / non avanti con motivi brevi e una riga di feedback. Il contatto resta visibile solo se il candidato sceglie "Mantieni il mio contatto per questa azienda" (revocabile in ogni momento); altrimenti torna nascosto.
8. **Ulteriori verifiche** (in ogni momento): test aggiuntivo (banca + domande proprie), prova pratica a tempo, verifica dal vivo (domande da porre; annotazioni private che il candidato non vede). Il candidato vede cosa viene valutato e il tempo e può rifiutare (nessuna penalità; l'azienda la vede come "verifica non effettuata"). I risultati si sommano alle competenze di quella candidatura. Non esiste un campo per chiedere documenti personali; il testo libero con richieste di CV/foto/documenti viene rifiutato.
9. **Per il candidato** ("Il mio profilo competenze" → "Le mie candidature"): stato chiaro (in valutazione / invitato / colloquio fissato / contatto condiviso / concluso), cronologia "Cosa ha visto l'azienda e quando", ritiro della candidatura in ogni momento (conferma + annulla), revoca del consenso.

## Identità mostrata: solo il nome
Forma minimale: **nome + iniziale del cognome** ("Alex Stefanovic" diventa "Alex S."). Mai foto, contatti, città, profilo pubblico di LifeNetwork, voti o LifePoints.
L'indice di affidabilità basato su segnali di rete non è più mostrato all'azienda: resta solo l'**atteggiamento nel test** (risposte a scenari, coerenza), un indicatore e non una prova.

## Chi vede cosa, per stato
| Stato | Nome | Punteggi e risposte | Contatto (nome completo/email/telefono) |
|---|---|---|---|
| Candidatura inviata / preferiti | si (Alex S.) | si | no |
| Invito al colloquio (inviato) | si | si | no |
| Proposta di altra fascia | si | si | no |
| Colloquio fissato (accettato) | si | si | no |
| Chiamata in corso | si | si | no |
| Chiamata rifiutata / senza risposta | si | si | no |
| Colloquio non avvenuto, rifiutato, scaduto | si | si | no |
| Connesso (colloquio in corso) | si (completo se scelto) | si | solo ciò che il candidato ha scelto, finché il consenso non è revocato |
| Concluso | si | si | solo se "Mantieni il mio contatto" = si |
| Revoca del consenso | si | si | no (torna nascosto) |

Le regole sono nel modulo puro `src/lib/interview.ts` (macchina a stati e `contactVisible`) e verificate in `tests/interview.test.mjs`.

## Limiti e cautele (leggere prima di pubblicare)
- **Non misura la personalità né la sincerità.** I tratti vengono da risposte a scenari (auto-dichiarate).
- **Decide sempre una persona.** I punteggi aiutano a leggere le candidature. In UE/Svizzera gli strumenti di selezione del personale sono regolati (GDPR/nLPD; AI Act: sistemi di selezione = alto rischio). Servono: informativa, consenso (già nel flusso), possibilità di contestare e di ritirarsi, test di equità sui dati, valutazione d'impatto.
- **Le domande della banca sono di esempio** e non validate scientificamente: vanno riviste da uno psicologo del lavoro e verificate per bias (genere, lingua madre, età).
- **Senza server** offerte, candidature, inviti e chiamate funzionano solo tra utenti demo su questo telefono; le schede "Anteprima" simulano l'altra parte. La videochiamata è un'anteprima: la trasmissione reale si attiva col server.

## Cosa serve dal server
- Account verificati e **verifica dell'identità** (senza mostrarla all'azienda).
- **Anti-frode del test** (un test si può fare con aiuto esterno: tempi e coerenza sono segnali parziali; serve proctoring leggero, domande randomizzate, limiti di tentativi).
- **Consegna di inviti e notifiche push** tra dispositivi (oggi le notifiche sono locali).
- **Videochiamata reale** (LiveKit o simile) con token a tempo emessi dal server solo ad accettazione avvenuta e nella finestra dell'orario.
- **Sblocco del contatto lato server**: il contatto resta cifrato sul server e viene consegnato all'azienda con un token a tempo solo alla risposta del candidato; revoca e cancellazione al termine del processo; registro dell'accesso consultabile dal candidato.

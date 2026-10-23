# Una persona, un account (verifica del documento)

**Stato: la parte server c'è (migrazione 0006), la verifica del documento NO: manca il fornitore.**

## Perché serve un fornitore
Una regola "un numero di documento = un account" funziona solo se il numero è **letto da un controllo vero** (foto del documento, lettura automatica, riconoscimento che il documento non sia falso, selfie che corrisponde). Se l'utente scrive il numero a mano può inventarlo, o scrivere quello di un altro e bloccargli l'account. Lo stesso vale per la nostra schermata «documento» attuale: è un'anteprima, non verifica niente.

## Cosa si salva (e cosa no)
- **Sul server**: solo l'**impronta** del documento, `HMAC-SHA256(segreto, paese|tipo|numero normalizzato)`, in `identity_claims`, più paese, tipo, fornitore e data. Il segreto vive nella funzione server (variabile d'ambiente), mai nel database né nell'app: senza il segreto l'impronta non si può rifare provando tutti i numeri possibili.
- **Non si salva mai**: il numero, le foto, il selfie. Restano al fornitore (che li cancella secondo il contratto) e, se l'utente vuole, sul suo telefono nei dati privati.
- L'impronta resta dato personale (pseudonimo): va scritta nell'informativa, con base giuridica (prevenzione degli abusi / contratto) e tempi. Cancellando l'account sparisce anche l'impronta: la stessa persona potrà crearne uno nuovo.
- Con o senza la parte social il profilo è lo stesso: l'impronta è legata all'account, non alle funzioni.

## Flusso previsto
1. L'app apre la verifica del fornitore (SDK o pagina web) per l'utente loggato.
2. Il fornitore chiama una **funzione server** (webhook) con l'esito e il numero letto.
3. La funzione controlla la firma del fornitore, calcola l'HMAC, chiama `identity_claim(hash, user, provider, paese, tipo)` con la chiave `service_role` (che sta solo lì).
4. `documento_gia_usato` → la verifica è rifiutata; `ok` → l'account risulta verificato (`identity_status()` → `{verified:true}`).

## Fornitori da valutare (verifica prezzi e requisiti aggiornati)
Veriff, Stripe Identity, IDnow, Onfido/Entrust, Persona; in Svizzera anche soluzioni locali. Criteri: dati trattati in UE/Svizzera, contratto di trattamento (art. 28 GDPR), costo per verifica (di solito 1-3 € circa), copertura dei documenti italiani e svizzeri, SDK per Expo.

## Limiti da sapere
- Una persona con due documenti diversi (carta d'identità e passaporto) può ottenere due impronte: il controllo vale per lo **stesso** documento. Per bloccarlo davvero serve il fornitore con confronto del volto, o legare tutto a un solo tipo di documento.
- L'email resta una per account (la garantisce il server), ma alias come `nome+1@gmail.com` sono email diverse: il documento è ciò che ferma i doppioni.

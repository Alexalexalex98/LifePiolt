# Bollette e fatture (LifeFinance > Bollette)

Principio: i dati finanziari restano SOLO sul telefono. L'analisi e' locale; nulla va a servizi esterni senza consenso esplicito.

## Cosa e' locale
- Lettura del testo (it, de, fr, en): fornitore, tipo, importo totale, valuta, date (emissione, scadenza, periodo), numero documento, IBAN (mod-97), QR-IBAN, riferimento QRR (modulo 10 ricorsivo) e SCOR (ISO 11649), contenuto del QR svizzero (SPC), codice avviso PagoPA, P.IVA/UID, penali, interessi di mora, solleciti (livello 1-3). Ogni campo ha confidenza (alta/media/bassa), riga di origine evidenziata e segnalazione delle ambiguita' (gg/mm o mm/gg, piu' importi "totale").
- Nulla viene salvato senza la conferma dell'utente nella schermata di revisione (billReview).
- Piano di pagamento (plan.ts): "paga entro" = scadenza meno giorni lavorativi di margine (festivita' CH/IT), liquidita' prevista da saldo, entrate stimate e spese fisse stimate, avvisi e suggerimenti (non decide), rate, ricorrenze, costo del ritardo.
- Promemoria (reminders.ts, schedule.ts): notifiche locali `lp-bill-<id>-<tipo>` a 7 gg, 3 gg, 1 gg, mattina della scadenza (ora configurabile) e, se scaduta, giorno dopo + ogni 3 giorni (3 volte). Max `RESERVED_SLOTS - 2` slot; gli altri si programmano quando se ne liberano (`refreshBillReminders`, all'avvio, al ritorno in primo piano e a ogni modifica).
- Il file originale e' copiato nella memoria dell'app e in LifeDrive (cartella "Bollette e fatture"), mai in rete.

## Formati
- Testo incollato, .txt/.csv, PDF CON livello di testo (estrazione propria: Flate + operatori di testo + ToUnicode, nessuna dipendenza).
- Immagini e PDF scansionati: nessun OCR offline. L'app lo dice, mostra il documento accanto a un modulo da compilare a mano e offre "Leggi con un'AI esterna".

## Cosa richiede AI/server
- Leggere immagini/scansioni: `routeRequest` (vision_read) SOLO se l'utente tocca "Leggi con un'AI esterna" dopo aver visto cosa verrebbe inviato. Oggi nessun fornitore e' collegato: risposta `not_connected` mostrata onestamente. Quando sara' collegato, `applyAiExtraction(draft, {text|fields})` (src/lib/bills/index.ts) riempie i campi mancanti con confidenza media, sempre da confermare.

## Limiti
- PDF cifrati, font senza ToUnicode o impaginazioni complesse: testo incompleto (segnalato come "incerta") o assente.
- Le entrate e le spese fisse del piano sono stime dai movimenti e dai costi ricorrenti.
- Le notifiche funzionano solo sull'app installata (non web, non Expo Go Android).

## Privacy
Nessun dato lascia il telefono. Le notifiche contengono fornitore e importo e sono create dal sistema operativo locale.

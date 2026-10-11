# Profilo LifeNetwork

## Layout
Intestazione (avatar, nome, badge identità, ruolo) -> barra alta **Follower · Seguiti · Voto complessivo** (tocco sul voto: scomposizione) -> Segui/Messaggio/Vota (o Modifica profilo/Biglietto) -> **LifePoints** (ricevuti in tutto, donati oggi + donatori) -> **pillole** con conteggio -> Competenze -> Biglietto da visita -> Attività -> LifeClub.
Il conteggio dei post non è in alto. Le pillole (Post · Idee · Servizi e seminari [se offerti] · Contributi [solo proprio, per ultimo]) aprono `profileContent`, un elenco a carte (non griglia). "Cose in vendita": nel marketplace esistono solo servizi e seminari, quindi la pillola è unica; si separerà se nascono annunci di oggetti.
Interpretazione della richiesta (contraddittoria sui "seguiti"): in alto restano Follower, Seguiti, Voto; sotto, le pillole di contenuto.

## Voto complessivo (`src/lib/profile/reputation.ts`)
Media bayesiana (prior 3,5, K=5) di: voti al profilo (peso 1; votano gli iscritti almeno una volta a un seminario, servizio o LifeClub, uno per iscrizione), voti alle risposte (peso 0,5 x anzianità del votante: <7 gg 0,4, <30 gg 0,7, altrimenti 1, ignota 0,6; solo chi ha fatto la domanda; "non utile" limita a 2 stelle), interazioni (mi piace, salvataggi, donatori distinti di LifePoint: tetti 200/50/20, peso massimo 4 voti equivalenti con saturazione). Anti-abuso: niente autovoti, un voto per scambio e persona, 10 voti/24 h per votante. Si mostra sempre "basato su N voti" e l'affidabilità. Senza server queste regole valgono solo sul telefono.

## Identità (`identity.ts`, schermata `identityVerify`)
Documento (carta d'identità/passaporto/permesso), fronte/retro, selfie facoltativo. La verifica reale richiede server e fornitore KYC (Onfido, Stripe Identity, Veriff...) e conformità GDPR/nLPD. Oggi: richiesta "in attesa" sul telefono; esito simulato **solo in demo**, etichettato "Anteprima". Foto e selfie restano in memoria temporanea nella schermata e sono cancellati (anche la copia temporanea) all'invio o alla chiusura; non vengono caricati né salvati.
Stati: non verificato / in attesa / verificato / respinto (con motivo).
Sblocchi: nessuna verifica: solo chat private (LifeNetwork chiuso); in attesa: guardare, like, commenti, seguire, post; verificato: in più votare, vendere, offrire servizi/seminari, LifeClub, creare attività, ricevere LifePoint. Piano, task, salute, finanze non dipendono mai dall'identità. L'enforcement è applicato oggi a: accesso LifeNetwork (flag `net.identity.verified`, aperto all'invio), voto, creazione attività; gli altri sono dichiarati in `UNLOCKS` per i moduli che li useranno.

## Attività (`businessCreate`, `businessPage`)
Una persona può creare più attività (tipo, descrizione, logo/colore, contatti pubblici scelti). La pagina mostra sempre "di <Nome Cognome>" con badge: non oscurabile (`OWNER_HIDEABLE=false`). Sul profilo l'attività si può togliere (esiste ancora). Le offerte di lavoro con lo stesso nome azienda dello stesso titolare mostrano l'attività e il titolare.

## Biglietto da visita (`cardEditor`, `businessCard`)
Card 85x55 con ombra, fronte/retro (animazione di rotazione, istantanea con "riduci animazioni"). Editor: 6 modelli, colori e sfumature, foto/logo, forme, disegno a mano libera (annulla/ripristina, cancella), testi con 4 font di sistema (nessun pacchetto font installato), trascinamento con PanResponder, QR opzionale (generatore puro, link `lifepilot://userProfile?name=...`: funziona solo per chi ha l'app; un link web richiede il server), salvataggio (JSON nello store) e condivisione come immagine (react-native-view-shot + expo-sharing; fallback testo). Contenuto: solo nome, ruolo, attività, max 5 competenze dichiarate, email/telefono se attivati in "Cosa condivido". Campi legacy (scuole, esperienza, residenza, anno di nascita...) restano nei dati ma sono ignorati; il "CV completo" è diventato "Competenze".

## Competenze (`skills.ts`, `skillVerify`)
Stati: dichiarata, in verifica, verificata da test, verificata dal vivo, non verificata. Soglia 50/100 (`CONFIRM_MIN`): sotto, "non confermata". Rifiutare una verifica lascia la competenza "non verificata". Il profilo mostra "N su M competenze verificate". "Richiedi verifica" dal profilo altrui crea una richiesta; il titolare accetta/rifiuta in `skillVerify` e svolge la prova con il test esistente (`jobTest`); per i candidati di un annuncio resta il flusso "ulteriori verifiche" di Lavoro. Testo: "Dichiara solo ciò che sai fare: chi assume può chiedere una verifica su tutto".

## Dal server servono
KYC e storage documenti conformi; validazione lato server dei voti (anzianità, rate limit); recapito delle richieste di verifica e notifiche (kind dedicato in notifyLinks); link profilo web; follower/seguiti reali.

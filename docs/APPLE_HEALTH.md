# Apple Health e Apple Watch in LifePilot

## Come arrivano i dati

L'Apple Watch scrive i suoi dati (passi, battito, HRV, sonno, allenamenti…) nell'app **Salute** dell'iPhone.
LifePilot legge da Salute con HealthKit: non esiste un collegamento diretto all'orologio e non serve
un'app per watchOS. Tutto resta sul telefono.

Dati letti (solo lettura): passi, battito a riposo, HRV (SDNN), peso, energia attiva, minuti di esercizio,
VO₂ max, ossigeno nel sangue, sonno, mindfulness, allenamenti. Lo "stress" è una **stima** calcolata da HRV
e battito a riposo rispetto al tuo solito (non è una misura medica).

## Perché non funziona in Expo Go

HealthKit richiede codice nativo e un permesso (entitlement) dell'app. Expo Go è un'app già fatta da Expo
che non li contiene. In Expo Go il pulsante "Collega Apple Health" mostra un messaggio e il resto dell'app
funziona normalmente. Per i dati veri serve una **build nativa** di LifePilot sul tuo iPhone.

## Costruire e installare sul tuo iPhone (con il Mac)

Requisiti: un Mac con macOS abbastanza recente per l'ultima versione di Xcode, l'iPhone con cavo,
un Apple ID (anche gratuito per le prove: l'app dura 7 giorni, poi va reinstallata).

1. **Xcode**: installalo dall'App Store (pesa decine di GB). Aprilo una volta, accetta la licenza e
   installa i componenti iOS quando li propone.
2. **Apple ID in Xcode**: Xcode → Settings → Accounts → "+" → accedi con il tuo Apple ID.
3. **iPhone**: collegalo al Mac, sblocca, tocca "Autorizza questo computer". Poi su iPhone:
   Impostazioni → Privacy e sicurezza → **Modalità sviluppatore** → attiva e riavvia.
4. **Nel Terminale**, dalla cartella del progetto:
   ```bash
   cd ~/lifepiolt
   git pull
   npm install
   npx expo prebuild --platform ios
   ```
   Crea la cartella `ios/` con il progetto nativo (HealthKit incluso).
5. **Firma**: apri `ios/LifePilot.xcworkspace` con Xcode → seleziona il progetto "LifePilot" →
   scheda *Signing & Capabilities* → *Team*: scegli il tuo Apple ID (Personal Team).
   Se Xcode dice che l'identificatore è già in uso, cambia *Bundle Identifier* in qualcosa di unico
   (es. `com.tuonome.lifepilot`). Verifica che sia presente la capability **HealthKit**.
6. **Installa**:
   ```bash
   npx expo run:ios --device
   ```
   Scegli il tuo iPhone dall'elenco. La prima volta ci mette qualche minuto.
7. **Fiducia nello sviluppatore**: su iPhone, Impostazioni → Generali → VPN e gestione dispositivo →
   tocca il tuo Apple ID → "Autorizza".
8. Apri LifePilot → Salute → **Collega Apple Health** → concedi le categorie → torna alla Dashboard.

Nota: con un Apple ID gratuito non posso garantire che HealthKit sia consentito dal certificato di
prova. Se Xcode rifiuta la capability, serve l'account Apple Developer (99 $/anno), che ti servirà
comunque per pubblicare sull'App Store.

## Se non vedi dati

- Impostazioni → Salute → Accesso ai dati e dispositivi → LifePilot: attiva le categorie.
- iOS non dice alle app se un permesso di lettura è stato negato: semplicemente non arrivano dati.
- Sul Watch il sonno si registra solo se hai attivato il monitoraggio del sonno.

## Cosa non ho potuto verificare da qui

Il codice (`src/lib/healthkit.ts`) passa il controllo dei tipi e la parte di analisi è testata con numeri noti,
ma l'accesso a HealthKit non è provabile senza un iPhone. Al primo test su dispositivo possono servire
piccole correzioni (nomi di unità, notti di sonno a cavallo di mezzanotte, ecc.).

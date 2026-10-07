# LifePilot

App mobile (Expo / React Native, TypeScript) per iOS e Android, portata dal prototipo HTML `prototype/lifepilot-prototype.html`.

## Sviluppo

```bash
npm install
npx expo start --tunnel   # QR da aprire con Expo Go (serve un account gratuito su expo.dev)
npx tsc --noEmit          # typecheck
```

## Cosa c'è (tutti i moduli del prototipo)

Home (Life Score, streak, check-in umore, briefing), Plan (calendario, vacanze, orari di lavoro, task con scomposizione AI,
obiettivi, automazioni), LifeTask, LifeNotes, LifeDrive (file e foto reali), LifeChat per argomenti,
LifeHealth + Mind, LifeFinance (movimenti, budget, bollette, fondo emergenza), Dichiarazione fiscale, Previsioni a 10 anni,
Stock e Portafoglio (simulati), LifeTravel, Settings (barra personalizzabile, 4 lingue, accessibilità, export/elimina dati),
LifeNetwork (post, community, idee con punteggio AI, marketplace servizi/seminari), LifePoints, messaggi e gruppi,
notifiche, ricerca, profili, voti, LifeClub, biglietto da visita.

Al primo avvio si sceglie "Inizia da zero" oppure "Esplora con dati demo" (i dati d'esempio del prototipo).
Tutti i dati restano sul dispositivo (AsyncStorage). Struttura: `src/store` (stato per area), `src/app/(tabs)` (schermate),
`src/components` (UI e schede), `src/lib` (logica), `src/data` (dati demo e traduzioni).

## Prima di pubblicare sugli store

Parti ancora simulate o da completare:

- **Chat AI**: serve un backend che custodisca la chiave API (vedi `src/lib/ai.ts`, variabile `EXPO_PUBLIC_API_URL`).
- **LifePoints**: la ricarica è simulata. Una valuta virtuale venduta nell'app deve usare gli acquisti in-app di Apple/Google.
- **Portafoglio/azioni**: dati e ordini simulati. Un servizio reale richiede un broker partner con licenza. Valuta di toglierlo dalla v1.
- **LifeNetwork**: senza backend i contenuti degli altri utenti esistono solo nei dati demo. Per UGC gli store richiedono
  moderazione, segnalazione e blocco, politica contenuti e cancellazione account (anche lato server).
- **Salute**: il collegamento a Apple Health/Fitbit/Garmin è di prova. Per dati reali servono HealthKit / Health Connect.
- **QR del biglietto**: illustrativo (non scansionabile).
- **Testi legali** (privacy, termini): sono bozze in Settings, serve una privacy policy pubblica su un URL.
- **Icona e splash**: sono ancora quelle di esempio di Expo. Servono un'icona 1024×1024 (senza trasparenza) e uno splash definitivi in `assets/images/`.
- **Identificatori** in `app.json` (`com.lifepilot.app`): scegli quelli definitivi prima della prima pubblicazione.

## Pubblicazione

```bash
npm i -g eas-cli && eas login
eas build:configure
eas build --platform all --profile production
eas submit --platform ios      # richiede Apple Developer (99 $/anno)
eas submit --platform android  # richiede Google Play Console (25 $ una tantum)
```

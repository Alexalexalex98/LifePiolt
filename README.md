# LifePilot

App mobile (Expo / React Native, TypeScript) per iOS e Android.
Il prototipo HTML originale è in `prototype/lifepilot-prototype.html` (solo riferimento).

## Sviluppo

```bash
npm install
npx expo start        # poi scansiona il QR con Expo Go, oppure premi i / a
npx tsc --noEmit      # typecheck
```

## Stato attuale (v0.1)

Funzionanti, con dati salvati sul dispositivo: onboarding, Home con Life Score, Plan (task, obiettivi),
LifeNotes, LifeHealth (sonno, passi, peso, umore), LifeFinance (stipendio, movimenti, categorie),
Impostazioni (tema, notifiche, esporta dati, elimina dati, pagine legali).

Chat AI: l'interfaccia c'è, ma serve un backend che custodisca la chiave API. Vedi `src/lib/ai.ts`.
Imposta `EXPO_PUBLIC_API_URL` in `.env`.

Ancora da portare dal prototipo: Drive, Travel, LifeNetwork (social), LifePoints, Portafoglio/azioni,
dichiarazione fiscale, biglietto da visita, messaggi, automazioni.

## Pubblicazione

1. Account: Apple Developer (99 $/anno) e Google Play Console (25 $ una tantum), più account gratuito su expo.dev.
2. **Prima di tutto cambia gli identificatori in `app.json`** (`ios.bundleIdentifier`, `android.package`,
   ora `com.lifepilot.app`): non si possono più modificare dopo la prima pubblicazione.
3. Sostituisci icona e splash in `assets/images/` (icona 1024×1024, senza trasparenza per iOS).
4. Build e invio:
   ```bash
   npm i -g eas-cli && eas login
   eas build:configure
   eas build --platform all --profile production
   eas submit --platform ios      # App Store Connect / TestFlight
   eas submit --platform android  # Google Play (la prima release va caricata a mano dalla Console)
   ```
5. Schede store: screenshot, descrizione, **URL privacy policy pubblica**, età, dichiarazioni sui dati
   (Apple "App Privacy", Google "Data safety"). I testi in `src/app/legal/[doc].tsx` sono bozze.

## Regole store da non dimenticare

- Vendere LifePoints (valuta virtuale) richiede acquisti in-app (Apple/Google, commissione 30%/15%).
- Portafoglio/azioni richiede un broker partner con licenza e disclaimer: tenere fuori dalla v1.
- LifeNetwork (contenuti utente) richiede moderazione, segnalazione e blocco utenti.
- Cancellazione account obbligatoria (già presente per i dati locali; con un backend va cancellato anche lato server).

# Guida ai comandi EAS

Usa `npx eas-cli@latest` al posto di `eas` se non lo hai installato. Tutto parte da `eas.json` (profili) e `app.json` (identità dell'app).

## Una tantum

```bash
npx eas-cli@latest login            # accedi all'account Expo
npx eas-cli@latest init             # collega il progetto, scrive extra.eas.projectId in app.json
npx eas-cli@latest credentials      # (facoltativo) vedi o gestisci certificati e profili
```

La prima volta che compili per iOS, EAS ti chiede di accedere al tuo account Apple Developer e crea certificati e profili. Per Android genera la chiave di firma.

## Profili in `eas.json`

| Profilo | A cosa serve | Distribuzione |
|---|---|---|
| `development` | Development build con strumenti di sviluppo, per provare moduli nativi (Salute, notifiche) che Expo Go non ha | interna (iOS richiede i dispositivi registrati con `eas device:create`; Android genera un APK) |
| `development-simulator` | Come sopra per il simulatore iOS | simulatore |
| `preview` | Versione quasi finale da far provare ai tester | interna, Android APK |
| `production` | Versione per gli store, numero di build che aumenta da solo | store (Android .aab) |

## Compilare

```bash
npx eas-cli@latest build --platform ios --profile development
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform all --profile production
```

## Inviare agli store

```bash
npx eas-cli@latest submit --platform ios --profile production      # TestFlight / App Store Connect
npx eas-cli@latest submit --platform android --profile production  # Play Console (traccia interna, bozza)
```

Prima compila `submit.production.ios.ascAppId` in `eas.json` con l'ID dell'app in App Store Connect. Per Android serve la chiave dell'account di servizio Google (`serviceAccountKeyPath`, non nel repository) e il primo caricamento a mano.

## Variabili d'ambiente

L'app legge due variabili opzionali. Senza di esse resta tutta locale.

| Variabile | Effetto |
|---|---|
| `EXPO_PUBLIC_API_URL` | Collega l'assistente AI a un tuo server (`POST /chat` e `/theia`). Vedi `src/lib/ai.ts` |
| `EXPO_PUBLIC_ERROR_URL` | Se impostata, ogni errore invia in forma anonima un `POST` con `message`, `appVersion` e `platform` |

Le variabili `EXPO_PUBLIC_*` finiscono dentro l'app e sono leggibili da chiunque: non metterci chiavi segrete. Imposta con:

```bash
npx eas-cli@latest env:create --name EXPO_PUBLIC_API_URL --value https://tuo-server.example --environment production --visibility plaintext
```

## Aggiornamenti senza store (facoltativo)

Per usare `eas update` serve aggiungere il pacchetto `expo-updates` e un `runtimeVersion` in `app.json`; non sono configurati. Decidi se ti servono prima della prima release.

## Verifiche utili

```bash
npx expo-doctor
npx expo config --json                 # mostra la configurazione risolta
npx expo config --type introspect --json   # mostra permessi e Info.plist finali
```

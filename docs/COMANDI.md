# Comandi rapidi: Expo e APK

Dalla cartella del progetto, sul tuo computer (Node 20+ installato).

## Provare l'app (sviluppo)
```bash
npm install
npx expo start            # QR code: sviluppo
npx expo start --web      # nel browser del PC
npx expo start --android  # telefono Android collegato / emulatore
```
> L'app usa moduli nativi (calendario, notifiche, fotocamera, ecc.): per averli tutti serve la **development build** (vedi sotto), non Expo Go.

## Accedere a Expo (EAS)
```bash
npm install -g eas-cli
eas login                 # account gratuito su expo.dev
eas whoami
```
(il progetto è già collegato: `projectId` in `app.json`; se `eas build` lo chiede: `eas init`)

## Creare l'APK (installabile subito su Android)
```bash
eas build --platform android --profile preview
```
Al termine EAS mostra un link/QR per scaricare il file **.apk**: aprilo dal telefono e installa (consenti «installa da fonti sconosciute»). Il piano gratuito di Expo ha un numero mensile limitato di build.

## APK di sviluppo (con tutti i moduli nativi + ricarica live)
```bash
eas build --platform android --profile development
npx expo start --dev-client
```

## Per Google Play (non APK: bundle .aab)
```bash
eas build --platform android --profile production
eas submit --platform android --profile production
```

## Build in locale (senza coda EAS, serve Android Studio/SDK)
```bash
eas build --platform android --profile preview --local
```

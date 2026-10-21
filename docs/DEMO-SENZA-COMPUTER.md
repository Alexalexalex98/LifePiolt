# Far vedere l'app fuori casa senza tenere un computer acceso

Con gli aggiornamenti via internet (EAS Update) il codice dell'app viene pubblicato sui server di Expo. Dal telefono lo apri da qualsiasi posto, anche in 5G,
senza Metro, senza tunnel e senza un computer acceso. Il computer serve solo per pubblicare (una volta, a casa, dal Mac).

## Una volta sola (sul Mac, nella cartella del progetto)
1. `git pull` e `npm install`.
2. Accedi a Expo: `npx eas-cli login`.
3. Salva indirizzo e token del server AI per l'ambiente `preview` (oppure inseriscili poi dentro l'app, in Impostazioni > Intelligenza di Theia):
   ```
   set -a; source .env.local; set +a
   npx eas-cli env:create --name EXPO_PUBLIC_AI_URL --value "$EXPO_PUBLIC_AI_URL" --environment preview --visibility plaintext --non-interactive
   npx eas-cli env:create --name EXPO_PUBLIC_AI_TOKEN --value "$EXPO_PUBLIC_AI_TOKEN" --environment preview --visibility plaintext --non-interactive
   ```

## Ogni volta che vuoi pubblicare la versione da mostrare
```
npx eas-cli update --branch demo --message "demo" --environment preview
```
Il comando stampa un indirizzo del tipo `https://expo.dev/accounts/.../projects/lifepilot/updates/...`.

## Per aprirla sul telefono
1. Apri quell'indirizzo (anche dal telefono) o vai su expo.dev > il tuo progetto > Updates.
2. Apri l'ultimo aggiornamento del ramo `demo` e usa il QR / il pulsante per aprirlo in **Expo Go**.
3. Expo Go scarica la versione pubblicata: serve solo internet sul telefono.

## Cose da sapere
- Cambia solo il codice dell'app (JavaScript). Se si aggiungono librerie native servono una nuova build.
- Non l'ho potuto provare dal mio ambiente (serve il tuo account Expo): se un passaggio non coincide con quello che vedi, mandami lo screenshot.

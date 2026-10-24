This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Principi di prodotto
Leggi docs/PRINCIPI.md prima di aggiungere o cambiare funzioni (scoperta graduale, nessuna colpa, dati dell'utente, numeri veri).

## Regole del proprietario (valgono sempre, anche con i connettori collegati)
- **Mai comprare niente**: né domini, né abbonamenti, né piani a pagamento, né crediti, né upgrade, anche se un connettore (Cloudflare, Stripe, Supabase, Expo, Canva, Resend, ecc.) lo permette. Se serve un acquisto, dillo al proprietario con prezzo e motivo e fai fare a lui.
- **Mai cancellare o disattivare risorse** (progetti, database, tabelle con dati, Worker, domini, account, abbonamenti, file, chiavi) senza che il proprietario lo chieda esplicitamente per quella specifica risorsa. Vale anche per risorse che sembrano vecchie o inutilizzate: segnalale, non toccarle.
- **Mai disdire o cambiare un abbonamento** e mai creare pagamenti, fatture, abbonamenti o addebiti, nemmeno in modalità di prova senza averlo chiesto.
- Le modifiche al database (migrazioni) e ai server si possono fare solo su ciò che il proprietario ha indicato (oggi: progetto Supabase Lifepilot2, account Cloudflare del progetto) e sempre con modifiche non distruttive.
- Mai incollare chiavi o token in chat, nel codice o nel repository.

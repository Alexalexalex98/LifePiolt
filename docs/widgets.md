# Widget, blocco schermo e Live Activity iOS

Stato: **realizzati nel codice con `expo-widgets`** (iOS). Servono una nuova build di sviluppo/EAS (`npx expo prebuild` + build): non girano in Expo Go. Non verificati su dispositivo.

- `src/widgets/now.tsx`: widget «LifePilotNow» (schermata Home piccolo/medio, blocco schermo rettangolare/inline/circolare) e Live Activity del turno in corso.
- `src/lib/lockScreen.ts` (logica pura, testata): cosa mostrare e quando aggiornare. `src/lib/lockSync.ts`: scrive widget e Live Activity; parte da `_layout.tsx`.
- Impostazioni: Settings › Orari e integrazioni › Blocco schermo e widget (scelta di turni, impegni, task, acqua, allenamento; modalità privacy senza nomi).
- App Group: `group.com.lifepilot.app` (da registrare nell'account Apple Developer).
- Android: non attivo (`enableAndroid: false`); l'alternativa prevista è una notifica fissa del turno con `createCustomNotification`.

Di seguito la nota originale (storica).

---

Stato originale: **non realizzati**. Un widget della schermata Home o una scorciatoia Siri/Azione rapida richiedono codice nativo
(un target WidgetKit in Swift) che Expo Go non può eseguire e che non si configura da `app.json` da solo.
Questo documento descrive come farlo in futuro con una build di sviluppo/EAS.

## Approccio consigliato

1. Passare a una **development build** (`eas build --profile development`) o a `expo prebuild` (CNG).
2. Aggiungere un **Widget Extension** (WidgetKit + SwiftUI). Strada più semplice: il config plugin `@bacons/apple-targets`
   (target `widget`), che genera il target in `targets/widget/` senza modificare a mano `ios/`.
3. Condividere i dati tra app e widget con un **App Group** (es. `group.ch.lifepilot.app`) e `UserDefaults(suiteName:)`.
   Dal lato JS serve un piccolo modulo nativo (o `expo-modules`) che scriva in quel `UserDefaults`; AsyncStorage NON è leggibile dal widget.
4. Dopo ogni modifica rilevante (task completato, nuovo impegno) l'app scrive il JSON e chiama
   `WidgetCenter.shared.reloadAllTimelines()`.

## Dati da esporre (JSON minimo, nessun dato sensibile)

```json
{
  "updatedAt": "2026-10-08T09:30:00Z",
  "tasks": { "open": 3, "done": 1, "top": [{ "id": "t12", "title": "Preparare la riunione", "urgent": true }] },
  "next": { "title": "Call con Marco", "start": "2026-10-08T14:00:00+02:00", "place": "Online" }
}
```

- **Task del giorno**: numero di task aperti/completati e i primi 3 per priorità (stessa logica di `src/lib/priority.ts`).
- **Prossimo impegno**: primo evento futuro del Plan (titolo, ora, luogo), da `useLife` / `src/lib/planner.ts`.
- Niente dati di salute, finanze o messaggi nel widget: resta visibile a schermo bloccato.

## Famiglie di widget

| Famiglia | Contenuto |
|---|---|
| `systemSmall` | prossimo impegno + conteggio task aperti |
| `systemMedium` | prossimo impegno + 3 task principali |
| `accessoryRectangular` (Lock Screen) | prossimo impegno con ora |

Il tocco sul widget apre l'app con un deep link (`lifepilot://plan`, `lifepilot://lifetask`), già coerente con le rotte di `src/app/(tabs)`.

## Scorciatoie (App Intents)

Con un target App Intents (iOS 16+): "Aggiungi task" e "Cosa devo fare adesso?" che aprono l'app con
`lifepilot://ai?cmd=...` (il testo è inviato all'assistente a comandi, che funziona anche offline).
Serve registrare lo schema URL in `app.json` (`scheme`) e leggere il parametro in `src/app/(tabs)/ai.tsx`.

## Cosa serve prima di iniziare

- Account Apple Developer e identificatori App Group + Widget configurati in EAS.
- Un modulo nativo di bridge per scrivere nell'App Group.
- Test su dispositivo reale: i widget non girano su web né in Expo Go.

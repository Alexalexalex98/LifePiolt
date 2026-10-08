# Widget e scorciatoie iOS (NON implementati)

Stato: **non realizzati**. Un widget della schermata Home o una scorciatoia Siri/Azione rapida richiedono codice nativo
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

# Dirette: seminari online e videochiamate dei servizi

## Cosa c'e' oggi
- `src/app/(tabs)/liveRoom.tsx`: stanza a tutto schermo (solo video, nessuna barra, rotazione libera). Seminari = un relatore e tanti spettatori; servizi = videochiamata a due.
- `src/lib/liveRoom.ts`: logica pura (stato per orario, commenti, permessi, riepilogo) e l'interfaccia `LiveTransport`.
- Trasporto predefinito: `createSimulatedTransport` (nessuna rete). Il relatore vede la **propria fotocamera vera**; chi guarda vede un video segnaposto e commenti/reazioni di partecipanti **demo**.
- Il video NON viaggia tra telefoni: servono un provider WebRTC/streaming e un backend per i token. L'app lo dice (etichetta "Anteprima: la diretta tra telefoni si attiva collegando il servizio di streaming").

## Quale provider scegliere
| Provider | Pro | Contro |
|---|---|---|
| LiveKit (cloud o self-host) | SDK React Native ufficiale (`@livekit/react-native`), dati/chat integrati (data channel), open source | serve un server token (JWT) |
| Daily | SDK RN, prebuilt, semplice, registrazione | prezzo a minuti |
| Agora | molto diffuso per live a molti spettatori | SDK piu' pesante, token con Agora |
| Jitsi | gratuito/self-host | RN SDK meno curato, UI da costruire |

Consiglio: **LiveKit** (broadcast con molti spettatori + videochiamata 1-a-1 con lo stesso SDK).

## Cosa serve
1. Account del provider (progetto, chiave API e segreto).
2. **Backend per i token** (es. una funzione serverless): riceve l'utente autenticato e l'id stanza (`seminar:12`, `service:Nome`), verifica che sia iscritto/prenotato (o sia il relatore) e restituisce un token a tempo con i permessi giusti (relatore = publish, spettatore = subscribe, chat). Mai mettere il segreto nell'app.
3. **Development build**: WebRTC non funziona in Expo Go. `npx expo install @livekit/react-native @livekit/react-native-webrtc @config-plugins/react-native-webrtc livekit-client`, aggiungere i plugin in `app.json`, poi `eas build --profile development` (o `npx expo run:ios|android`).
4. Permessi: gia' presenti (`expo-camera` plugin con testi in italiano, `CAMERA` e `RECORD_AUDIO` Android). Con un provider reale il microfono viene richiesto (`needMic`).
5. Rotazione: `app.json` ha `orientation: "default"`; l'app blocca il verticale all'avvio (`src/lib/orientation.ts`) e la stanza live lo sblocca.

## Passi di integrazione
1. Crea `src/lib/liveKitTransport.ts` che implementa `LiveTransport`:
   - `connect(room, me)`: chiede il token al backend, `new Room().connect(url, token)`; relatore pubblica camera/microfono, spettatore si sottoscrive.
   - `publishComment` / `publishReaction` / `raiseHand` / `pin` / `muteParticipant` / `removeParticipant`: messaggi sul data channel (`room.localParticipant.publishData`), con verifica lato server per mute/remove.
   - `subscribe(listener)`: traduce gli eventi del provider in `LiveEvent` (commenti, reazioni, spettatori, partecipanti, `ended`).
   - `getState` / `setNetwork`: mappa `ConnectionState` su `NetState`.
   - `realVideo = true`, `provider = 'livekit'`.
2. Passa il trasporto alla stanza: `useLiveRoom({ ..., makeTransport: () => createLiveKitTransport() })` in `liveRoom.tsx`.
3. In `VideoSurface.tsx` sostituisci `ViewerStage` con la traccia video remota (`VideoTrack`) e, per il relatore, pubblica la camera invece del solo `CameraView` (con un provider reale la camera la apre il provider: non usare `CameraView` in parallelo).
4. Togli l'etichetta di anteprima (`PREVIEW_NOTE` in `components/live/Panels.tsx` e in `LiveAccess.tsx`) e i flag `demo: true` dei riepiloghi.
5. Promemoria push "inizia tra X minuti" richiede notifiche programmate (oggi il promemoria e' mostrato solo dentro l'app).

## Limiti noti
- Camera, microfono e rotazione sono nativi: non verificabili sul web/Playwright; da provare su un telefono con Expo Go (SDK 57 include `expo-camera` e `expo-screen-orientation`).
- Il microfono non viene richiesto finche' il trasporto e' simulato (non lo userebbe).

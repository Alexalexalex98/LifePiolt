# Checklist di pubblicazione

Segna cosa serve e chi può farlo. Le voci "Tu" richiedono il tuo account, i tuoi documenti o decisioni tue: nessuno strumento automatico può farle al posto tuo.

## 0. Cosa richiede il tuo account (non automatizzabile)

| Voce | Chi | Note |
|---|---|---|
| Account Apple Developer Program | Tu | 99 USD all'anno. Serve per TestFlight e App Store. Verifica di identità; per un'azienda serve il numero D-U-N-S. |
| Account Expo (EAS) | Tu | Gratuito per iniziare, `eas login`. |
| Account Google Play Console | Tu | Pagamento una tantum (25 USD) e verifica di identità. |
| Creare l'app in App Store Connect | Tu | Nome, bundle id `com.lifepilot.app`, lingua principale italiano. Da qui ottieni l'ID app (`ascAppId`) da mettere in `eas.json`. |
| Creare l'app in Play Console | Tu | Nome pacchetto `com.lifepilot.app`. Il primo caricamento della app bundle deve essere fatto a mano dalla console. |
| Chiave API Google per `eas submit` Android | Tu | Account di servizio con accesso a Play Console, file JSON. Non metterlo nel repository. |
| Privacy policy su un URL pubblico | Tu | Il testo parte da "Privacy e permessi" nell'app. Deve essere accessibile senza accesso. Va fatta rivedere da chi ne risponde legalmente. |
| Pagina di supporto / email | Tu | Obbligatoria sullo store. |
| Nome del venditore, indirizzo, telefono | Tu | Per l'UE (Digital Services Act) Apple e Google chiedono i dati del venditore se pubblichi come professionista. |
| Questionari di classificazione età | Tu | Rispondi tu nelle console. |
| Dichiarazioni Salute (HealthKit) | Tu | In revisione Apple chiede perché usi i dati di Salute. Testo suggerito sotto. |
| Valori `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_ERROR_URL` | Tu | Solo se colleghi un server. Vedi guida EAS. |

## 1. Prima di compilare

- [ ] `npx expo-doctor` senza errori.
- [ ] `npx tsc --noEmit` pulito, `npx eslint src` senza errori, `npm test` verde.
- [ ] Verifica su un telefono reale con una development build: Salute, calendario, notifiche, foto, microfono, contatti, posizione. Questi permessi non si possono provare nel browser.
- [ ] `app.json`: controlla `version` (cambia a mano per ogni release pubblica), `ios.bundleIdentifier`, `android.package`. I numeri di build li gestisce EAS (`appVersionSource: remote`, `autoIncrement`).
- [ ] Esegui `eas init` una volta: scrive `extra.eas.projectId` in `app.json`.
- [ ] Icona 1024x1024 senza trasparenza (`assets/images/icon.png`: verifica dimensioni e assenza di canale alfa per l'iOS).

## 2. TestFlight (iOS)

1. `eas build --platform ios --profile production` (la prima volta EAS ti guida nella creazione di certificati e profili con il tuo account Apple).
2. `eas submit --platform ios --profile production` (carica su App Store Connect).
3. In App Store Connect > TestFlight attendi l'elaborazione (alcuni minuti), compila "Informazioni sul test", aggiungi tester interni (fino a 100, nessuna revisione) o esterni (richiedono una revisione leggera).
4. Controlla sul telefono: onboarding, permessi, notifiche locali, backup e ripristino, eliminazione dei dati.

## 3. Screenshot richiesti

Verifica sempre i requisiti correnti in App Store Connect, perché cambiano con i nuovi modelli di iPhone.

| Store | Dispositivo | Dimensioni (px, verticale) | Quanti |
|---|---|---|---|
| App Store | iPhone 6,9" (obbligatorio) | 1320 x 2868 (oppure 1290 x 2796) | da 1 a 10, consigliati 5-8 |
| App Store | iPhone 6,5" (se non fornisci il 6,9") | 1284 x 2778 oppure 1242 x 2688 | da 1 a 10 |
| App Store | iPad | non necessario: `supportsTablet` è false | |
| Google Play | Telefono | lato minimo 320, massimo 3840, rapporto fino a 2:1 (es. 1080 x 1920 o 1080 x 2400) | da 2 a 8 |
| Google Play | Immagine in evidenza | 1024 x 500 | 1 |
| Google Play | Icona | 512 x 512 | 1 |

Schermate suggerite: Home, Plan con il mese pianificato, assistente che propone di spostare un impegno, LifeHealth, LifeFinance, Backup e privacy nelle Impostazioni. Usa dati demo (Onboarding > "Esplora con dati demo"): sono già nell'app, quindi niente nomi o dati reali. Non mostrare marchi altrui.

Nella cartella `docs/screenshots` ci sono immagini di lavoro, non delle dimensioni dello store.

## 4. App Privacy ("nutrition labels") su App Store Connect

Rispondi in base a ciò che l'app fa davvero. Stato attuale (nessun server collegato, nessuna analisi, nessuna pubblicità, nessun login):

- **Tracciamento**: No. L'app non usa SDK pubblicitari né raccoglie identificatori per tracciare tra app.
- **Dati raccolti dallo sviluppatore**: i dati restano sul telefono e non vengono inviati a te. In questo caso Apple considera "non raccolti": scegli **"Dati non raccolti"** (Data Not Collected).

Se invece pubblichi una versione con server collegato, devi dichiarare:

| Funzione | Categoria Apple | Collegato all'utente? | Scopo |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL`: domande all'assistente AI | Contenuti dell'utente > Altri contenuti dell'utente | Dipende da come il server li conserva. Se li associ a un account o ID, sì. | Funzionalità dell'app |
| Contesto con permesso "Dati salute" (solo se l'utente lo attiva) | Salute e fitness | Come sopra | Funzionalità dell'app |
| Contesto con permesso "Dati finanziari" (solo se l'utente lo attiva) | Informazioni finanziarie > Altre informazioni finanziarie | Come sopra | Funzionalità dell'app |
| `EXPO_PUBLIC_ERROR_URL`: messaggio d'errore, versione app, piattaforma | Diagnostica > Altri dati diagnostici | No (nessun identificatore) | Funzionalità dell'app |

Controlla sempre: se il tuo server conserva i dati o li passa a un fornitore AI, vale anche per te. Non dichiarare "Dati non raccolti" se i dati lasciano il telefono.

**Dati di Salute (HealthKit)**: l'app legge e non scrive. Dati letti: passi, sonno, battito a riposo, HRV, allenamenti, peso. Restano sul telefono. Apple vieta di usarli per pubblicità o di venderli: non farlo. Nelle note di revisione scrivi: "L'app legge i dati di Salute solo per mostrarli all'utente nella sezione LifeHealth e per calcoli locali. Nessun dato esce dal dispositivo."

**Google Play, sezione Sicurezza dei dati**: stesso criterio. Senza server: "Nessun dato raccolto" e "Nessun dato condiviso". Le autorizzazioni (calendario, contatti, posizione, microfono, fotocamera) sono usate solo sul dispositivo. Con server collegato dichiara messaggi/contenuti, salute e dati finanziari se inviati.

## 5. Categoria, età, informazioni di revisione

- **Categoria**: principale Produttività, secondaria Salute e fitness.
- **Età**: compila il questionario Apple con risposte oneste. Indicazioni basate su ciò che l'app contiene: nessun contenuto violento o sessuale, funzioni di messaggistica tra utenti, simulazioni finanziarie, dati di salute. Con la messaggistica tra utenti reali Apple applica le regole sui contenuti generati dagli utenti (segnalazione, blocco, moderazione): oggi le chat dell'app sono simulate e locali; se le colleghi a utenti reali devi aggiungere queste funzioni prima della revisione.
- **Account demo per la revisione**: non serve, l'app non ha login. Nelle note di revisione spiega "Esplora con dati demo".
- **Crittografia**: `ITSAppUsesNonExemptEncryption` è false (solo HTTPS standard). Verifica che sia ancora vero se aggiungi cifratura propria.
- **Medicina e finanza**: nei testi dello store e nell'app è chiarito che l'app non fornisce consulenza medica o finanziaria. Non aggiungere promesse sanitarie o di rendimento.
- **Contenuti di terzi**: l'app non usa marchi o loghi non tuoi negli screenshot.

## 6. Android

1. `eas build --platform android --profile production` (genera un file `.aab`).
2. Primo caricamento a mano in Play Console > Test interni. Poi `eas submit --platform android --profile production` per i successivi.
3. Compila: scheda, Sicurezza dei dati, Classificazione dei contenuti, pubblico di destinazione, dichiarazione sulle autorizzazioni, privacy policy.
4. Le app personali nuove richiedono un periodo di test chiuso prima della produzione (verifica la regola corrente nella console).

## 7. Dopo la pubblicazione

- [ ] Prova a installare dallo store su un telefono pulito e fai il ciclo completo: onboarding, un permesso, backup, eliminazione.
- [ ] Tieni l'ultima versione dei file di backup compatibile: il formato ha il campo `format` per le versioni future.
- [ ] Aggiorna la scheda e la privacy policy ogni volta che cambi cosa viene inviato fuori dal telefono.

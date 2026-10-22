# Video per i social (Remotion) · LifePilot

Serie di video verticali 9:16 (1080×1920, 30 fps) che mostrano l'app **vera** in inglese, con tocchi, zoom, voice over con voce AI e sottotitoli animati.
Tutto si rigenera da testi (`videos/*.json`) e da scenari (`capture/scenarios/*.mjs`): nessuna registrazione manuale.

## Come funziona
1. **Cattura** (`capture/`): Playwright apre la build web dell'app (con dati demo in inglese), esegue lo scenario (tocchi, scrittura, scroll) e registra la schermata in alta risoluzione + i tempi di ogni tocco e zoom.
2. **Voce** (`scripts/tts.mjs`): ogni frase del voice over diventa un file audio con una voce AI. La durata dell'audio decide il ritmo del video.
3. **Montaggio** (`src/`, Remotion): una scena per ogni «fase» dello scenario; la clip dell'app si adatta alla durata della frase; tocchi, zoom, cornice e sottotitoli animati sono calcolati dai dati.

> Remotion non può eseguire direttamente i componenti React Native: per questo si registra la **build web** dell'app (la stessa interfaccia, con i dati demo), poi Remotion monta e anima. Il risultato è l'interfaccia reale, non un disegno.

## Una volta sola
```bash
cd video
npm install
npm run app:build        # esporta l'app web in video/app-web (ci mette 1-2 minuti)
npx remotion browser ensure   # scarica il Chrome usato per il render (solo se non hai CHROME_PATH)
```
Servono `ffmpeg` e `ffprobe` nel PATH (`brew install ffmpeg` / `apt install ffmpeg`).

## Comandi di ogni giorno
| Cosa | Comando |
|---|---|
| Avvia l'app web (lasciala aperta in un terminale) | `npm run app:serve` |
| Registra gli scenari (tutti o uno) | `npm run capture` · `npm run capture -- 03-fitness` |
| Genera le voci | `npm run tts` · `npm run tts -- 03-fitness` |
| **Anteprima** con Remotion Studio | `npm run studio` (si apre su http://localhost:3000, scegli il video a sinistra) |
| **Render MP4 con audio**, tutti | `npm run render` |
| Render di uno solo | `npm run render -- 03-fitness` → `out/03-fitness.mp4` |
| Tutta la serie da zero | `npm run build:all` |

## La voce AI (nessuna registrazione tua)
Scegli un servizio e imposta la chiave nel terminale (non metterla mai nel repository):

* **OpenAI TTS (consigliato)**: `export OPENAI_API_KEY=sk-...` → modello `gpt-4o-mini-tts`, voce `nova` (o `coral`, `alloy`, `sage`…). Il tono si guida a parole nel campo `voice.instructions` di ogni video. Costo indicativo: circa 1 centesimo di dollaro ogni 30 secondi di audio, quindi pochi centesimi per tutta la serie (controlla i prezzi aggiornati su platform.openai.com/pricing). Chiave su platform.openai.com → API keys (serve un credito prepagato di almeno 5 $).
* **ElevenLabs** (voci molto naturali): `export TTS_PROVIDER=elevenlabs ELEVENLABS_API_KEY=...` e, se vuoi, `ELEVENLABS_VOICE_ID`. Il piano gratuito include circa 10.000 caratteri al mese, quello a pagamento parte da circa 5 $/mese (verifica su elevenlabs.io/pricing). In `voice.voice` puoi mettere l'ID della voce.
* **Senza chiavi**: `npm run tts` genera audio muto della giusta durata, utile per provare ritmo e sottotitoli.

Le frasi già generate restano in cache (`public/audio/`): se cambi una sola frase, si rigenera solo quella.

## Modificare un video (template)
Apri `videos/<id>.json`:
* `hook`: titolo in alto · `accent`: colore · `outro`: schermata finale.
* `scenes[]`: `cue` = fase dello scenario, `say` = frase (o elenco di frasi brevi) del voice over. Una frase = un blocco di sottotitoli sincronizzato con l'audio.
* `voice`: voce e tono.

Per cambiare **cosa si vede** modifica lo scenario in `capture/scenarios/` (`a.tap`, `a.type`, `a.scroll`, `a.hold`, `a.focus` per lo zoom, `a.cue` per le fasi) e rilancia `npm run capture -- <id>`.
Per un **nuovo video**: copia uno scenario e il suo json, cambia l'id e lancia capture, tts, render. Si registra da solo.

Durante la registrazione, `[NON INGLESE?]` nel terminale ti avvisa se a schermo compare testo non inglese (frasi che l'app non ha ancora tradotto).

## Schermate e flussi dell'app, in ordine di utilizzo
1. **Primo avvio**: lingua, nome, interessi, dati demo · 2. **Dashboard a widget** (aggiungere, tenere premuto, trascinare, ridimensionare, sfondo) · 3. **Theia** (chat AI, domande sui tuoi dati, avvisi, piano della settimana) · 4. **Plan e agenda** (impegni, task, conflitti, turni di lavoro) · 5. **LifeTask e note** · 6. **LifeFitness** (settimana, programmi, 1000+ esercizi, pasti con foto, acqua, pausa pranzo) · 7. **LifeHealth e umore** · 8. **LifeFinance** (estratto, budget, bollette, risparmio per la vacanza, fisco) · 9. **LifePoints e pagamenti** · 10. **LifeTravel** · 11. **Messaggi** (chat, chiamate, gruppi) · 12. **LifeNetwork** (post, storie, lavoro, servizi, club) · 13. **LifeDrive** (foto, video e documenti in un posto) · 14. **Impostazioni** (lingue, privacy, sicurezza, notifiche).
Video già pronti: `01-dashboard`, `02-theia-week`, `03-fitness`, `04-vacation`.

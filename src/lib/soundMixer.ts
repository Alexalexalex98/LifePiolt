import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { soundById } from './sleepSounds';

/** Mescola fino a 3 suoni in loop, con un timer di spegnimento a dissolvenza. Un solo mixer per tutta l'app. */
type Listener = () => void;
const players = new Map<string, AudioPlayer>();
let timer: ReturnType<typeof setTimeout> | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;
let endsAt = 0;
let level = 0.7;
let pausedByUs = false;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => { try { l(); } catch { /* ascoltatore rotto */ } });

export const mixer = {
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
  active: (): string[] => [...players.keys()],
  endsAt: (): number => endsAt,
  async toggle(id: string): Promise<void> {
    if (players.has(id)) { this.stopOne(id); return; }
    const s = soundById(id); if (!s) return;
    if (players.size >= 3) this.stopOne([...players.keys()][0]!);
    try { await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true } as never); } catch { /* resta l'impostazione attuale */ }
    try {
      const p = createAudioPlayer(s.src);
      p.loop = true; p.volume = level;
      p.play(); players.set(id, p); emit();
    } catch { /* suono non disponibile */ }
  },
  stopOne(id: string) { const p = players.get(id); if (!p) return; try { p.pause(); p.remove(); } catch { /* già fermo */ } players.delete(id); if (!players.size) this.clearTimer(); emit(); },
  stopAll() { [...players.keys()].forEach((k) => this.stopOne(k)); this.clearTimer(); pausedByUs = false; },
  /** livello base dei suoni (0–1); resta anche per i suoni che partono dopo */
  setLevel(v: number) { level = Math.max(0, Math.min(1, v)); this.setVolume(level); },
  resetLevel() { level = 0.7; },
  /** mette in pausa tutti i suoni (senza spegnerli) e li fa ripartire */
  pause() { pausedByUs = true; players.forEach((p) => { try { p.pause(); } catch { /* ignora */ } }); },
  resume() { pausedByUs = false; players.forEach((p) => { try { p.play(); } catch { /* ignora */ } }); },
  isPaused: (): boolean => pausedByUs,
  setVolume(v: number) { players.forEach((p) => { try { p.volume = Math.max(0, Math.min(1, v)); } catch { /* ignora */ } }); },
  clearTimer() { if (timer) clearTimeout(timer); if (fadeTimer) clearInterval(fadeTimer); timer = null; fadeTimer = null; endsAt = 0; emit(); },
  /** si spegne da solo dopo `min` minuti, con dissolvenza negli ultimi 20 secondi */
  setTimer(min: number | null) {
    this.clearTimer();
    if (!min) return;
    endsAt = Date.now() + min * 60000;
    timer = setTimeout(() => {
      let v = level;
      fadeTimer = setInterval(() => { v -= level / 20; this.setVolume(v); if (v <= 0.02) { this.stopAll(); } }, 1000);
    }, Math.max(0, min * 60000 - 20000));
    emit();
  },
};

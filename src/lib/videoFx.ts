/**
 * Montaggio non distruttivo dei video (come in un editor): velocità, taglio di inizio e fine, audio.
 * Il file resta quello girato: chi lo guarda lo vede ritoccato. Modulo PURO.
 */
export type VideoFx = { speed?: number; /** secondi */ trimStart?: number; trimEnd?: number; mute?: boolean };
export const SPEEDS = [0.5, 0.75, 1, 1.5, 2] as const;
const r1 = (n: number) => Math.round(n * 10) / 10;

export function cleanVideoFx(v?: VideoFx | null, durationSec?: number): VideoFx | undefined {
  if (!v) return undefined;
  const out: VideoFx = {};
  if (v.speed && v.speed !== 1 && SPEEDS.includes(v.speed as never)) out.speed = v.speed;
  if (v.mute) out.mute = true;
  const d = durationSec && durationSec > 0 ? durationSec : undefined;
  const s = Math.max(0, v.trimStart ?? 0);
  const e = v.trimEnd && v.trimEnd > 0 ? v.trimEnd : undefined;
  if (s > 0.05 && (!d || s < d - 0.5)) out.trimStart = r1(s);
  if (e !== undefined && (!d || e < d - 0.05) && e - (out.trimStart ?? 0) >= 0.5) out.trimEnd = r1(e);
  return Object.keys(out).length ? out : undefined;
}
/** Quando si arriva alla fine del taglio, si torna all'inizio. Restituisce dove saltare, o null. */
export function loopTarget(current: number, v?: VideoFx | null): number | null {
  if (!v || (v.trimStart === undefined && v.trimEnd === undefined)) return null;
  const start = v.trimStart ?? 0;
  if (current < start - 0.05) return start;
  if (v.trimEnd !== undefined && current >= v.trimEnd) return start;
  return null;
}
/** Durata che si vede dopo taglio e velocità. */
export function playedSeconds(durationSec: number, v?: VideoFx | null): number {
  const end = v?.trimEnd !== undefined ? Math.min(durationSec, v.trimEnd) : durationSec;
  return Math.max(0, (end - (v?.trimStart ?? 0)) / (v?.speed ?? 1));
}

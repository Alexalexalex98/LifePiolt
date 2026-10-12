/**
 * Gancio per il tempo di tragitto APPRESO. Modulo minuscolo e senza dipendenze: reminders.ts e arrival.ts lo importano
 * senza trascinarsi dietro lo store. Se nessun provider e' registrato (abitudini spente, web, test) restituisce sempre null
 * e resta valida la stima della tabella di places.ts.
 */
export type LearnedTravel = { minutes: number; n: number; spreadMin: number; mode: string };
type Provider = (from: string, to: string, when: Date) => LearnedTravel | null;

let provider: Provider | null = null;
export function setLearnedTravelProvider(fn: Provider | null) { provider = fn; }

/** Dettagli del tragitto appreso (minuti, osservazioni, dispersione) o null. Non lancia mai. */
export function learnedTravel(from: string, to: string, when: Date): LearnedTravel | null {
  if (!provider) return null;
  try { return provider(from, to, when); } catch { return null; }
}

/** Minuti di tragitto appresi dagli spostamenti reali tra due luoghi, o null se non ci sono abbastanza osservazioni. */
export function learnedTravelMinutes(from: string, to: string, when: Date): number | null {
  return learnedTravel(from, to, when)?.minutes ?? null;
}

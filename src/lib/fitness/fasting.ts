/** Digiuno intermittente (modulo PURO): finestra in cui si mangia e finestra di digiuno, calcolate dall'ora di inizio. */
export type FastPlan = { id: string; label: string; eatHours: number };
export const PLANS: FastPlan[] = [
  { id: '14:10', label: '14:10', eatHours: 10 }, { id: '16:8', label: '16:8', eatHours: 8 }, { id: '18:6', label: '18:6', eatHours: 6 }, { id: '20:4', label: '20:4', eatHours: 4 },
];
export const hmToMin = (s: string): number => { const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim()); return m ? Math.min(23, +m[1]!) * 60 + Math.min(59, +m[2]!) : 12 * 60; };
export const minToHm = (m: number) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}`;

export type FastStatus = { eating: boolean; /** minuti alla prossima transizione */ minutesLeft: number; /** 0..1 di quanto è passato nella fase attuale */ progress: number; phaseMinutes: number };

/** `startMin` = ora in cui inizia la finestra del cibo (minuti dalla mezzanotte). */
export function fastStatus(nowMin: number, startMin: number, eatHours: number): FastStatus {
  const eatLen = Math.round(eatHours * 60);
  const rel = (((nowMin - startMin) % 1440) + 1440) % 1440;
  if (rel < eatLen) return { eating: true, minutesLeft: eatLen - rel, progress: rel / eatLen, phaseMinutes: eatLen };
  const fastLen = 1440 - eatLen; const into = rel - eatLen;
  return { eating: false, minutesLeft: fastLen - into, progress: into / fastLen, phaseMinutes: fastLen };
}
export const fmtLeft = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}` : `${min} min`);

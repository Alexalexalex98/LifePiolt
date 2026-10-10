/** Logica pura del feed (nessun alias: testata in tests/feedLogic.test.mjs). */

/** Indice della pagina di un carosello dato lo scorrimento orizzontale. */
export function pageIndex(offsetX: number, width: number, count: number): number {
  if (!width || count <= 1) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(offsetX / width)));
}

/** true se due tocchi consecutivi formano un doppio tocco. */
export function isDoubleTap(prev: number, now: number, gapMs = 280): boolean {
  return prev > 0 && now - prev >= 0 && now - prev <= gapMs;
}

/** La didascalia va ridotta (con "altro")? Oltre ~110 caratteri o 3 righe. */
export function captionNeedsMore(text: string, limit = 110): boolean {
  return text.length > limit || text.split('\n').length > 2;
}

/** Percentuale di raccolta limitata a 0..100 (obiettivo assente = 500 come nel resto dell'app). */
export function raisedPct(raised: number, target?: number): number {
  const t = target && target > 0 ? target : 500;
  return Math.max(0, Math.min(100, Math.round((raised / t) * 100)));
}

/** Giorno e indice del mese (0..11) di un timestamp, per il badge data. */
export function dateBadgeParts(ts: number): { day: number; month: number } {
  const d = new Date(ts);
  return { day: d.getDate(), month: d.getMonth() };
}

/** Le righe della griglia 3 colonne: lunghezza delle righe complete + resto. */
export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

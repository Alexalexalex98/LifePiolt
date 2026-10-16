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

export type PostLayout = 'text' | 'classic' | 'overlay' | 'story';
/** Come si presenta un post: solo frase, foto/video con didascalia sotto, didascalia sopra la foto, oppure frase prima e foto dopo. Stesso post = stesso aspetto. */
export function postLayout(p: { author: string; text: string; media?: 'photo' | 'video' | null }, count = 1): PostLayout {
  if (!p.media) return 'text';
  if (count > 1) return 'classic';
  let h = 5;
  const s = p.author + p.text;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const k = Math.abs(h) % 3;
  if (k === 0) return 'classic';
  if (k === 1) return 'overlay';
  return p.media === 'photo' ? 'story' : 'overlay';
}

/**
 * Varietà nel feed: riordina senza cambiare le proporzioni, in modo che due elementi di fila non abbiano la stessa «firma»
 * (per esempio due frasi, tre foto o due servizi uno dopo l'altro), finché è possibile. L'ordine di importanza resta il più possibile quello di partenza.
 */
export function diversify<T>(items: T[], sigOf: (x: T) => string): T[] {
  const left = items.slice();
  const out: T[] = [];
  while (left.length) {
    const last = out.length ? sigOf(out[out.length - 1]) : null;
    const prev = out.length > 1 ? sigOf(out[out.length - 2]) : null;
    let i = left.findIndex((x) => sigOf(x) !== last && (prev === null || sigOf(x) !== prev || last !== prev));
    if (i < 0) i = left.findIndex((x) => sigOf(x) !== last);
    if (i < 0) i = 0;
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}

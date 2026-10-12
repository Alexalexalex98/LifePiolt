/** Recensioni a un singolo corso, seminario o seduta (modulo puro). Quelle dimostrative sono deterministiche: stesso corso, stesse recensioni. */
export type ItemReview = { from: string; stars: number; text?: string; ts: number; demo?: boolean };

const NAMES = ['Giulia M.', 'Marco T.', 'Federica L.', 'Tommaso V.', 'Elena R.', 'Luca B.', 'Sophie K.', 'Nadia P.'];
const TEXTS: [number, string][] = [
  [5, 'Chiaro, concreto e ben organizzato. Lo rifarei.'],
  [5, 'Ho imparato cose che applico già da questa settimana.'],
  [4, 'Molto utile, avrei solo voluto un po\' più di tempo per le domande.'],
  [5, 'Disponibile e preparato: risponde a tutto con calma.'],
  [4, 'Buon rapporto tra contenuto e prezzo.'],
  [3, 'Interessante, ma alcune parti erano troppo veloci.'],
  [5, 'Atmosfera ottima e contenuti di livello.'],
  [4, 'Puntuale e professionale.'],
];
const hash = (s: string) => Math.abs([...s].reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 7));

export function demoItemReviews(ref: string, now: number, n = 4): ItemReview[] {
  const h = hash(ref);
  return Array.from({ length: Math.min(n, NAMES.length) }, (_, i) => {
    const [stars, text] = TEXTS[(h + i * 3) % TEXTS.length];
    return { from: NAMES[(h + i) % NAMES.length], stars, text, ts: now - (i + 1) * 5 * 86400000 - (h % 3) * 86400000, demo: true };
  });
}
/** Unisce recensioni vere e dimostrative: una sola per persona, le più recenti prima. */
export function mergeReviews(real: ItemReview[], demo: ItemReview[]): ItemReview[] {
  const seen = new Set<string>();
  return [...real, ...demo].filter((r) => (seen.has(r.from) ? false : (seen.add(r.from), true))).sort((a, b) => b.ts - a.ts);
}
export const averageOf = (list: { stars: number }[]): number | null => (list.length ? Math.round((list.reduce((a, r) => a + r.stars, 0) / list.length) * 10) / 10 : null);

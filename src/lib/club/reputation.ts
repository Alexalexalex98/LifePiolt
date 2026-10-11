/**
 * Reputazione "Botta e risposta" (qualita' del dialogo). Puro.
 *
 * PUNTEGGIO (0-5) = media smorzata (come in hiring.shrunkRating) dei segnali ricevuti da chi risponde:
 *   (somma(peso x voto) + 3.5 x K) / (somma(pesi) + K)      con K = 5  (pochi voti restano vicini a 3.5)
 *
 * PESI DICHIARATI (modificare qui e in docs/lifeclub.md):
 *   - voto di chi ha fatto la domanda ........ 1.00  (1-5 stelle, il pollice su/giu' vale 5/1)
 *   - voto di un altro iscritto ................ 0.50
 *   - "mi piace" sulla risposta ................ 0.15  (conta come 4.5 stelle)
 *   - risposta salvata ......................... 0.30  (conta come 5 stelle)
 *   - LifePoint donato (max 3 per risposta) .... 0.50 ciascuno (conta come 5 stelle)
 * I segnali impliciti (like/salvataggi/punti) non possono da soli superare il 40% del peso totale:
 * il voto esplicito resta la base.
 *
 * ANTI-ABUSO: un voto per scambio e per persona, non si vota se stessi, si vota solo dopo l'iscrizione
 * (almeno una volta), massimo 10 voti nelle 24 ore.
 */

export const PRIOR = 3.5;
export const K = 5;
export const W_ASKER = 1;
export const W_MEMBER = 0.5;
export const W_LIKE = 0.15, S_LIKE = 4.5;
export const W_SAVE = 0.3, S_SAVE = 5;
export const W_POINT = 0.5, S_POINT = 5, MAX_POINTS_PER_ANSWER = 3;
export const IMPLICIT_CAP = 0.4;
export const DAILY_VOTE_LIMIT = 10;

export type VoteLike = { stars: number; weight?: number };

const clampStars = (n: number) => Math.min(5, Math.max(1, Number.isFinite(n) ? n : 3));

/** Media smorzata di voti semplici (1-5). */
export function qaRating(votes: (number | VoteLike)[]): { rating: number; n: number; confidence: 'nessuna' | 'bassa' | 'media' | 'alta' } {
  let sw = 0, sv = 0, n = 0;
  for (const v of votes) {
    const o = typeof v === 'number' ? { stars: v, weight: 1 } : { stars: v.stars, weight: v.weight ?? 1 };
    if (!(o.weight > 0)) continue;
    sw += o.weight; sv += o.weight * clampStars(o.stars); n++;
  }
  const rating = Math.round(((sv + PRIOR * K) / (sw + K)) * 100) / 100;
  return { rating, n, confidence: n === 0 ? 'nessuna' : n < 5 ? 'bassa' : n < 20 ? 'media' : 'alta' };
}

export type Signals = {
  /** voti espliciti: asker = chi ha fatto la domanda */
  votes: { stars: number; asker: boolean }[];
  likes?: number;
  saves?: number;
  points?: number;
};

/** Combina voti espliciti e segnali impliciti nel punteggio 0-5. */
export function qaScore(s: Signals): { rating: number; n: number; confidence: 'nessuna' | 'bassa' | 'media' | 'alta' } {
  const explicit = s.votes.map((v) => ({ stars: v.stars, weight: v.asker ? W_ASKER : W_MEMBER }));
  const ew = explicit.reduce((a, v) => a + v.weight, 0);
  const imp: VoteLike[] = [];
  const likes = Math.max(0, s.likes ?? 0), saves = Math.max(0, s.saves ?? 0), pts = Math.min(MAX_POINTS_PER_ANSWER, Math.max(0, s.points ?? 0));
  let iw = likes * W_LIKE + saves * W_SAVE + pts * W_POINT;
  // limite al peso dei segnali impliciti rispetto al totale
  const maxIw = ew > 0 ? (ew * IMPLICIT_CAP) / (1 - IMPLICIT_CAP) : 0;
  const scale = iw > maxIw ? (iw === 0 ? 0 : maxIw / iw) : 1;
  if (likes) imp.push({ stars: S_LIKE, weight: likes * W_LIKE * scale });
  if (saves) imp.push({ stars: S_SAVE, weight: saves * W_SAVE * scale });
  if (pts) imp.push({ stars: S_POINT, weight: pts * W_POINT * scale });
  iw = imp.reduce((a, v) => a + (v.weight ?? 0), 0);
  const r = qaRating([...explicit, ...imp]);
  return { ...r, n: explicit.length };
}

export type VoteCheck = { ok: boolean; reason?: string };

export type VoteCtx = {
  voter: string;
  asker: string;
  answerer: string;
  /** il votante e' (stato) iscritto o lo e' stato almeno una volta */
  voterEverJoined: boolean;
  /** voti gia' dati da `voter` per questo scambio */
  alreadyVotedExchange: boolean;
  /** timestamp dei voti dati da `voter` (per il limite giornaliero) */
  voterVoteTimes: number[];
  now?: number;
};

export function canVoteAnswer(c: VoteCtx): VoteCheck {
  const now = c.now ?? Date.now();
  if (!c.voter) return { ok: false, reason: 'Accedi per votare' };
  if (c.voter === c.answerer) return { ok: false, reason: 'Non puoi votare te stesso' };
  if (!c.voterEverJoined) return { ok: false, reason: 'Puoi votare solo dopo esserti iscritto' };
  if (c.alreadyVotedExchange) return { ok: false, reason: 'Hai già votato questa risposta' };
  const recent = c.voterVoteTimes.filter((t) => now - t < 86400000).length;
  if (recent >= DAILY_VOTE_LIMIT) return { ok: false, reason: 'Hai raggiunto il limite di voti di oggi' };
  return { ok: true };
}

/** Voto utile / non utile -> stelle. */
export const thumbToStars = (up: boolean) => (up ? 5 : 1);

/** Un voto puo' essere dato solo a una risposta che ha una domanda e un autore diverso. */
export function isExchange(question: { author: string } | undefined, answer: { author: string } | undefined): boolean {
  return !!question && !!answer && question.author !== answer.author;
}

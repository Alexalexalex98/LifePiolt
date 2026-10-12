/**
 * Voto complessivo di un profilo LifeNetwork (0-5). Modulo PURO (nessun alias '@/'), testato in tests/profileReputation.test.mjs.
 *
 * Tre fonti, mostrate separatamente nel dettaglio (trasparenza):
 *  1. Profilo     voti diretti 1-5 dati da chi si è iscritto almeno una volta a un seminario, servizio o LifeClub della persona
 *                 (un voto per iscrizione). Peso 1 per voto.
 *  2. Risposte    voti ai singoli scambi "botta e risposta" (domanda e risposta nei commenti o nelle chat dei club): lo dà
 *                 SOLO chi ha fatto la domanda. Peso 0.5 per voto, moltiplicato per l'anzianità dell'account votante.
 *  3. Interazioni segnali positivi (mi piace ricevuti, salvataggi, persone diverse che hanno donato un LifePoint). Contano poco
 *                 e saturano: il peso massimo complessivo è 4 "voti equivalenti" e solo con tanti segnali.
 *
 * Media bayesiana (come shrunkRating in hiring.ts): voto = (K*PRIOR + somma(peso*media)) / (K + somma pesi), con PRIOR = 3.5 e K = 5.
 * Con pochi voti il valore resta vicino a 3.5; con tanti si avvicina alla media reale. Il numero "basato su N voti" e il livello di
 * affidabilità (nessuna/bassa/media/alta) vanno sempre mostrati accanto al voto.
 *
 * Anti-abuso:
 *  - non si vota se stessi (voti con from === to scartati);
 *  - un voto per scambio e per persona (stessa coppia from/to/ref: vale il primo);
 *  - rate limit: al massimo RATE_MAX voti ai singoli scambi per votante in 24 ore (gli altri sono scartati);
 *  - ponderazione per anzianità dell'account votante: < 7 giorni 0.4, < 30 giorni 0.7, oltre 1; anzianità ignota 0.6;
 *  - le interazioni contano al massimo per persone diverse (donatori distinti) e hanno tetti per tipo.
 * Nota onesta: senza server queste regole valgono sul telefono; la validità vera dei voti richiede la conferma lato server.
 */

export const PRIOR = 3.5;
export const K = 5;
export const QA_WEIGHT = 0.5;
export const RATE_MAX = 10;
export const RATE_WINDOW_MS = 24 * 3600 * 1000;
export const DAY_MS = 24 * 3600 * 1000;
/** Tetto del peso delle interazioni (voti equivalenti) e semisaturazione in punti. */
export const INTERACTION_MAX_WEIGHT = 4;
export const INTERACTION_HALF = 60;
const CAP_LIKES = 200, CAP_SAVES = 50, CAP_DONORS = 20;

export type QaVote = { from: string; to: string; stars: number; ts: number; /** scambio votato (es. 'standalone:3#2') */ ref?: string; /** "utile / non utile": se false le stelle valgono al massimo 2 */ helpful?: boolean };
export type Interactions = { likes: number; saves: number; /** persone DIVERSE che hanno donato un LifePoint */ lpDonors: number };
export type Confidence = 'nessuna' | 'bassa' | 'media' | 'alta';
export type Part = { id: 'profilo' | 'risposte' | 'interazioni'; label: string; n: number; avg: number | null; weight: number; note: string };
export type Reputation = { score: number | null; votes: number; confidence: Confidence; confidenceLabel: string; parts: Part[]; basedOn: string };

export const effectiveStars = (v: Pick<QaVote, 'stars' | 'helpful'>): number => {
  const s = Math.max(1, Math.min(5, Math.round(v.stars)));
  return v.helpful === false ? Math.min(s, 2) : s;
};

/** Peso per anzianità del votante (giorni dalla creazione dell'account); undefined = ignota. */
export function ageWeight(sinceMs: number | undefined, now: number): number {
  if (sinceMs == null || !isFinite(sinceMs)) return 0.6;
  const days = (now - sinceMs) / DAY_MS;
  return days < 7 ? 0.4 : days < 30 ? 0.7 : 1;
}

/** Motivo per cui `from` non può votare ora lo scambio `ref` di `to` (null = può). */
export function qaBlockReason(from: string, to: string, ref: string, existing: QaVote[], now: number): string | null {
  if (!from || !to) return 'Voto non valido.';
  if (from === to) return 'Non puoi votare te stesso.';
  if (existing.some((v) => v.from === from && v.to === to && (v.ref ?? '') === ref)) return 'Hai già votato questo scambio.';
  const recent = existing.filter((v) => v.from === from && now - v.ts < RATE_WINDOW_MS).length;
  if (recent >= RATE_MAX) return 'Hai raggiunto il limite di voti per oggi: riprova domani.';
  return null;
}

/** Voti validi per `target`: scarta autovoti, doppioni e oltre il rate limit (si tiene il più vecchio). */
export function validQaVotes(target: string, votes: QaVote[], now: number): QaVote[] {
  const sorted = [...votes].filter((v) => v && v.to === target && v.from && v.from !== target && v.ts <= now + 60000).sort((a, b) => a.ts - b.ts);
  const seen = new Set<string>();
  const perVoter = new Map<string, number[]>();
  const out: QaVote[] = [];
  for (const v of sorted) {
    const key = `${v.from}|${v.to}|${v.ref ?? ''}`;
    if (seen.has(key)) continue;
    const times = (perVoter.get(v.from) ?? []).filter((x) => v.ts - x < RATE_WINDOW_MS);
    if (times.length >= RATE_MAX) continue;
    seen.add(key);
    perVoter.set(v.from, [...times, v.ts]);
    out.push(v);
  }
  return out;
}

export function interactionPoints(i: Interactions): number {
  return Math.min(Math.max(0, i.likes), CAP_LIKES) + 2 * Math.min(Math.max(0, i.saves), CAP_SAVES) + 3 * Math.min(Math.max(0, i.lpDonors), CAP_DONORS);
}

export type RepInput = {
  target: string;
  /** istogramma dei voti diretti { 1: n, ... 5: n } (store network, campo votes) */
  direct?: Partial<Record<number, number>>;
  qa?: QaVote[];
  interactions?: Interactions;
  now: number;
  /** data di creazione dell'account del votante (ms), se nota */
  sinceOf?: (name: string) => number | undefined;
};

const r1 = (x: number) => Math.round(x * 10) / 10;

export function confidenceOf(votes: number): Confidence {
  return votes <= 0 ? 'nessuna' : votes < 3 ? 'bassa' : votes < 10 ? 'media' : 'alta';
}
export const CONFIDENCE_LABEL: Record<Confidence, string> = { nessuna: 'Nessun voto', bassa: 'Affidabilità bassa', media: 'Affidabilità media', alta: 'Affidabilità alta' };

export function computeReputation(i: RepInput): Reputation {
  const d = i.direct ?? {};
  let dn = 0, dsum = 0;
  for (const s of [1, 2, 3, 4, 5]) { const n = Math.max(0, Math.floor(d[s] ?? 0)); dn += n; dsum += n * s; }
  const qa = validQaVotes(i.target, i.qa ?? [], i.now);
  let qw = 0, qsum = 0;
  for (const v of qa) { const w = ageWeight(i.sinceOf?.(v.from), i.now) ; qw += w; qsum += w * effectiveStars(v); }
  const pts = interactionPoints(i.interactions ?? { likes: 0, saves: 0, lpDonors: 0 });
  const sat = pts / (pts + INTERACTION_HALF);
  const iw = INTERACTION_MAX_WEIGHT * sat;
  const iAvg = PRIOR + 1.5 * sat;

  const wProfile = dn;
  const wQa = QA_WEIGHT * qw;
  const total = wProfile + wQa + iw;
  const votes = dn + qa.length;
  const score = votes === 0 && pts === 0 ? null : r1((K * PRIOR + dsum + QA_WEIGHT * qsum + iw * iAvg) / (K + total));
  const confidence: Confidence = votes === 0 && pts > 0 ? 'bassa' : confidenceOf(votes);
  const parts: Part[] = [
    { id: 'profilo', label: 'Profilo', n: dn, avg: dn ? r1(dsum / dn) : null, weight: r1(wProfile), note: 'Voti di chi si è iscritto almeno una volta a un tuo seminario, servizio o LifeClub.' },
    { id: 'risposte', label: 'Risposte', n: qa.length, avg: qw ? r1(qsum / qw) : null, weight: r1(wQa), note: 'Voti a singole risposte, dati solo da chi aveva fatto la domanda.' },
    { id: 'interazioni', label: 'Interazioni', n: pts, avg: pts ? r1(iAvg) : null, weight: r1(iw), note: 'Mi piace, salvataggi e LifePoint ricevuti da persone diverse: contano poco e hanno un tetto.' },
  ];
  const basedOn = votes > 0 ? (votes === 1 ? 'Basato su 1 voto' : `Basato su ${votes} voti`) : pts > 0 ? 'Basato solo sulle interazioni' : 'Nessun voto ancora';
  return { score, votes, confidence, confidenceLabel: CONFIDENCE_LABEL[confidence], parts, basedOn };
}

/** Chi può votare il profilo: iscrizione (anche solo iscritto, non rifiutata) a un seminario/servizio/club del titolare, non ancora usata per votare. */
export type Participation = { host: string; status: string; voted?: boolean };
export function canVoteProfile(me: string, target: string, parts: Participation[]): boolean {
  if (!me || !target || me === target) return false;
  return parts.some((p) => p.host === target && p.status !== 'declined' && !p.voted);
}
export function profileVoteBlockReason(me: string, target: string, parts: Participation[]): string | null {
  if (me === target) return 'Non puoi votare te stesso.';
  if (canVoteProfile(me, target, parts)) return null;
  const done = parts.some((p) => p.host === target && p.status !== 'declined' && p.voted);
  return done ? 'Hai già votato con la tua iscrizione a questa persona. Potrai votare di nuovo con una nuova iscrizione.' : 'Puoi votare solo dopo esserti iscritto almeno una volta a un seminario, a un servizio o a un LifeClub di questa persona. Messaggi e interazioni non bastano.';
}

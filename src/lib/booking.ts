/**
 * Regole di prenotazione di seminari, webinar e servizi (modulo PURO, nessun alias '@/').
 * - Si paga SUBITO, al momento della prenotazione: lo slot si occupa solo a pagamento avvenuto.
 * - Si può disdire fino a 24 ore prima dell'inizio (rimborso intero); si può riprogrammare in qualsiasi momento prima dell'inizio, senza ripagare.
 * - I partecipanti e chi ha pagato li vede solo chi ha creato il seminario.
 */
export const CANCEL_HOURS = 24;
const H = 3600000;

export const canCancel = (startsAt: number, now: number): boolean => startsAt - now >= CANCEL_HOURS * H;
/** Ore che mancano all'ultimo momento utile per disdire (negativo = già scaduto). */
export const hoursToCancelDeadline = (startsAt: number, now: number): number => Math.round(((startsAt - CANCEL_HOURS * H - now) / H) * 10) / 10;
export const canReschedule = (e: { status: string; startsAt: number }, now: number): boolean => e.status === 'enrolled' && e.startsAt > now;

export type Participant = { name: string; paid: number; paidAt: number; /** presente / assente dopo la fine (solo informativo per chi organizza) */ attended?: boolean };
export type ParticipantSummary = { count: number; paidCount: number; totalPaid: number; free: number };
export function summarizeParticipants(list: Participant[]): ParticipantSummary {
  const paid = list.filter((p) => p.paid > 0);
  return { count: list.length, paidCount: paid.length, totalPaid: Math.round(paid.reduce((a, p) => a + p.paid, 0) * 100) / 100, free: list.length - paid.length };
}

/** Chi può vedere i partecipanti: solo chi organizza. */
export const canSeeParticipants = (viewer: string, host: string): boolean => !!viewer && viewer === host;

/** Messaggio se non si può prenotare per mancanza di LifePoints (il pagamento viene prima dell'occupazione dello slot). */
export function bookingPayBlock(price: number, balance: number): string | null {
  return price > 0 && balance < price ? 'LifePoints insufficienti: il pagamento va fatto prima di prenotare.' : null;
}

/* ---------- fondi bloccati fino alla fine ---------- */
export type EscrowState = 'bloccato' | 'accreditato' | 'rimborsato' | 'nessuno';
type EscrowLike = { paid?: number; held?: boolean; releasedAt?: number; startsAt: number; durationMin: number };
/** Momento in cui i LifePoints vengono sbloccati e accreditati a chi organizza: la fine dell'evento. */
export const unlockAt = (e: Pick<EscrowLike, 'startsAt' | 'durationMin'>): number => e.startsAt + e.durationMin * 60000;
/** Stato del pagamento: bloccato dalla prenotazione alla fine dell'evento, poi accreditato al relatore. */
export function escrowState(e: EscrowLike, now: number): EscrowState {
  if (!e.paid || e.paid <= 0) return 'nessuno';
  if (e.held === false || e.releasedAt || (e.held && now >= unlockAt(e))) return 'accreditato';
  return e.held ? 'bloccato' : 'accreditato';
}

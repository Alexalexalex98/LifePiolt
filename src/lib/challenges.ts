/**
 * Sfide tra amici (modulo PURO): COOPERATIVE. Due persone lavorano insieme per raggiungere un totale; nessuna classifica, nessun perdente,
 * nessuna penalità se non si arriva. Si basano su cose vere dell'app (acqua, cose fatte, allenamenti), con tetti giornalieri per non barare.
 */
export type ChallengeKind = 'water' | 'snack' | 'fit';
export const KINDS: { id: ChallengeKind; label: string; unit: string; presets: number[]; daily: number }[] = [
  { id: 'water', label: 'Acqua', unit: 'mezzi litri', presets: [14, 28, 42], daily: 4 },
  { id: 'snack', label: 'Cose fatte (task e pasti)', unit: 'cose', presets: [20, 40, 60], daily: 8 },
  { id: 'fit', label: 'Allenamenti', unit: 'allenamenti', presets: [4, 8, 12], daily: 2 },
];
export type Challenge = {
  id: string; withName: string; kind: ChallengeKind; target: number;
  /** primo giorno e numero di giorni */
  startDay: string; days: number;
  /** quanto dice di aver fatto l'amico per giorno (arriva dalla rete o lo indica l'utente) */
  friend: Record<string, number>;
  createdAt: number;
};

const dayAdd = (day: string, n: number) => new Date(Date.parse(day) + n * 86400000).toISOString().slice(0, 10);
export const daysOf = (c: Pick<Challenge, 'startDay' | 'days'>): string[] => Array.from({ length: c.days }, (_, i) => dayAdd(c.startDay, i));
export const endDay = (c: Pick<Challenge, 'startDay' | 'days'>) => dayAdd(c.startDay, c.days - 1);

export type Progress = { mine: number; friend: number; total: number; pct: number; daysLeft: number; state: 'active' | 'reached' | 'ended' };
/** `mineOn(day)` = quanto hai fatto tu in quel giorno (già con il tetto giornaliero della sfida). */
export function progressOf(c: Challenge, today: string, mineOn: (day: string) => number): Progress {
  const k = KINDS.find((x) => x.id === c.kind)!;
  const days = daysOf(c).filter((d) => d <= today);
  const mine = days.reduce((a, d) => a + Math.min(k.daily, mineOn(d)), 0);
  const friend = days.reduce((a, d) => a + Math.min(k.daily, Math.max(0, c.friend[d] ?? 0)), 0);
  const total = mine + friend;
  const left = Math.max(0, Math.round((Date.parse(endDay(c)) - Date.parse(today)) / 86400000));
  const reached = total >= c.target;
  return { mine, friend, total, pct: Math.min(100, Math.round((total / c.target) * 100)), daysLeft: left, state: reached ? 'reached' : today > endDay(c) ? 'ended' : 'active' };
}

/** Messaggio all'amico: sempre gentile, mai di pressione. */
export function inviteText(me: string, c: Pick<Challenge, 'kind' | 'target' | 'days'>): string {
  const k = KINDS.find((x) => x.id === c.kind)!;
  return `${me}: ti va di fare una sfida insieme? Proviamo ad arrivare a ${c.target} ${k.unit} in ${c.days} giorni, sommando quello che facciamo noi due. Nessuna gara e nessun obbligo: se non ci riusciamo, riproviamo con calma.`;
}
export function progressText(me: string, c: Challenge, p: Progress): string {
  const k = KINDS.find((x) => x.id === c.kind)!;
  return `${me}: finora ho fatto ${p.mine} ${k.unit} per la nostra sfida (insieme siamo a ${p.total} su ${c.target}).`;
}

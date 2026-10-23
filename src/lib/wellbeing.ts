/**
 * Segnali (modulo PURO): l'app NON parte come autoaiuto. Solo se nei dati che già ci sono sul telefono compare qualcosa di diverso dal solito,
 * la creatura propone, con garbo, un'attività da fare insieme. Sono indizi deboli, non diagnosi: si descrivono i FATTI («hai scritto meno del solito»),
 * mai l'interpretazione («sei depresso»). Tutto resta sul telefono. L'utente può dire «non adesso», «non mostrarmelo più» o spegnere tutto.
 * Non si osservano volto, voce o postura di nessuno.
 */
export type Pt = { d: string; v: number };
export type WbInput = {
  today: string;
  sleep: Pt[]; mood: Pt[]; tasksDone: Pt[];
  /** giorni (AAAA-MM-GG) con un allenamento */
  workoutDays: string[];
  /** giorni dei messaggi scritti dall'utente nelle chat con persone */
  sentDays: string[];
  /** inviti rifiutati negli ultimi 14 giorni (seminari, eventi) */
  declined: number;
  overdueTasks: number;
  /** pasti segnati: giorni, uno per pasto */
  mealDays: string[];
  /** messaggi scritti dall'utente a Theia: giorno e testo */
  texts: { d: string; text: string }[];
};
export type Signal = { id: string; weight: 1 | 2 | 3; fact: string; exercises: string[]; human?: boolean };

const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * 86400000).toISOString().slice(0, 10);
const inRange = (d: string, from: string, to: string) => d >= from && d <= to;
const count = (days: string[], from: string, to: string) => days.filter((d) => inRange(d, from, to)).length;
const NORM = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’`]/g, ' ').replace(/\s+/g, ' ');

const PESSIMISM = /\b(tanto andra male|non ne faccio una giusta|nessuno mi capisce|non valgo (niente|nulla)|sono un fallimento|e tutta colpa mia|non cambiera mai|non ce la faccio piu|e inutile|e tutto inutile|faccio schifo|sono un disastro|va sempre male|andra a finire male)\b/;
const AVOID = /\b(evito|non esco piu|non voglio vedere nessuno|ho paura di uscire|non riesco ad uscire|rimando sempre|scappo da|non vado piu)\b/;
const BODY = /\b(tachicardia|cuore (che )?batte (forte|veloce)|battito (accelerato|forte)|attacco di panico|fiato corto|respiro corto|non riesco a respirare|mi manca l aria|panico)\b/;
const CATASTROPHE = /\b(sara una catastrofe|va a finire malissimo|andra tutto storto|e la fine|mi licenzieranno|sara un disastro)\b/;

export function signalsOf(i: WbInput): Signal[] {
  const out: Signal[] = [];
  const d = (n: number) => addDays(i.today, n);
  const last = (a: Pt[], from: number, to = 0) => a.filter((p) => inRange(p.d, d(from), d(to)));
  const mean = (a: Pt[]) => (a.length ? a.reduce((s, p) => s + p.v, 0) / a.length : 0);

  const sl = last(i.sleep, -6);
  if (sl.length >= 5 && mean(sl) < 6) out.push({ id: 'sleep', weight: 1, fact: 'nelle ultime notti hai dormito meno di 6 ore in media', exercises: ['breath', 'senses'] });

  const md = last(i.mood, -13);
  if (md.length >= 6 && md.filter((p) => p.v <= 2).length / md.length >= 0.7) out.push({ id: 'mood', weight: 2, fact: 'da due settimane segni quasi sempre giornate pesanti', exercises: ['name', 'good', 'schedule'] });

  const wRecent = count(i.workoutDays, d(-13), d(0)), wBefore = count(i.workoutDays, d(-41), d(-14));
  if (wRecent === 0 && wBefore >= 5) out.push({ id: 'moves', weight: 1, fact: 'da due settimane non ti alleni, mentre prima lo facevi spesso', exercises: ['schedule', 'step'] });

  const tRecent = last(i.tasksDone, -13).reduce((s, p) => s + p.v, 0), tBefore = last(i.tasksDone, -27, -14).reduce((s, p) => s + p.v, 0);
  if ((tBefore >= 6 && tRecent < tBefore * 0.5) || i.overdueTasks >= 5) out.push({ id: 'tasks', weight: 1, fact: i.overdueTasks >= 5 ? 'hai diversi task scaduti' : 'completi meno task del solito', exercises: ['schedule', 'loop'] });

  const sRecent = count(i.sentDays, d(-13), d(0)), sBefore = count(i.sentDays, d(-41), d(-14));
  if ((sBefore >= 20 && sRecent <= (sBefore / 2) * 0.25) || i.declined >= 3) out.push({ id: 'social', weight: 2, fact: i.declined >= 3 ? 'hai rifiutato diversi inviti di recente' : 'negli ultimi giorni hai scritto molto meno del solito', exercises: ['step', 'name'] });

  const mealsRecent = count(i.mealDays, d(-6), d(0)), mealsBefore = count(i.mealDays, d(-27), d(-7));
  if (mealsBefore >= 12 && mealsRecent <= (mealsBefore / 3) * 0.3) out.push({ id: 'meals', weight: 2, fact: 'questa settimana hai segnato molti meno pasti del solito', exercises: ['name'], human: true });

  const recentTexts = i.texts.filter((t) => inRange(t.d, d(-13), d(0))).map((t) => NORM(t.text));
  const pess = recentTexts.filter((t) => PESSIMISM.test(t));
  if (pess.length >= 3 && new Set(i.texts.filter((t) => PESSIMISM.test(NORM(t.text))).map((t) => t.d)).size >= 2) out.push({ id: 'pessimism', weight: 2, fact: 'in più messaggi hai scritto frasi molto dure su di te o sul futuro', exercises: ['evidence', 'thought', 'abc'] });
  if (recentTexts.filter((t) => CATASTROPHE.test(t)).length >= 2) out.push({ id: 'catastrophe', weight: 1, fact: 'più volte hai scritto di aspettarti il peggio', exercises: ['abc', 'evidence'] });
  if (recentTexts.filter((t) => AVOID.test(t)).length >= 2) out.push({ id: 'avoid', weight: 2, fact: 'hai scritto più volte di evitare delle situazioni', exercises: ['ladder', 'step'] });
  const bodyNow = i.texts.filter((t) => inRange(t.d, d(-2), d(0)) && BODY.test(NORM(t.text)));
  if (bodyNow.length >= 1) out.push({ id: 'body', weight: 2, fact: 'hai scritto di sentire il corpo molto agitato', exercises: ['senses', 'breath'] });
  return out.sort((a, b) => b.weight - a.weight);
}

/** Stato delle proposte: cosa è già stato mostrato, rimandato o silenziato. */
export type InviteState = { on: boolean; lastAny: number; last: Record<string, number>; muted: string[]; firstSeen: Record<string, string> };
export const newInviteState = (): InviteState => ({ on: true, lastAny: 0, last: {}, muted: [], firstSeen: {} });
const DAY = 86400000;

/** La proposta da mostrare ora, se ce n'è una: al massimo una ogni 3 giorni, la stessa non prima di 7, mai se silenziata o spenta. */
export function nextInvite(sig: Signal[], st: InviteState, now: number): Signal | null {
  if (!st.on) return null;
  if (now - st.lastAny < 3 * DAY) return null;
  const ok = sig.filter((s) => !st.muted.includes(s.id) && now - (st.last[s.id] ?? 0) >= 7 * DAY);
  const strong = ok.find((s) => s.weight >= 2) ?? (sig.length >= 2 ? ok[0] : undefined);
  return strong ?? null;
}

/** Quando i segnali durano da settimane e sono più d'uno, la cosa più utile è parlarne con una persona: lo si dice con garbo, non si diagnostica. */
export function suggestHuman(sig: Signal[], st: InviteState, today: string): boolean {
  const old = sig.filter((s) => { const f = st.firstSeen[s.id]; return f && (Date.parse(today) - Date.parse(f)) / DAY >= 14; });
  return old.length >= 2 || sig.some((s) => s.human && st.firstSeen[s.id] && (Date.parse(today) - Date.parse(st.firstSeen[s.id]!)) / DAY >= 7);
}

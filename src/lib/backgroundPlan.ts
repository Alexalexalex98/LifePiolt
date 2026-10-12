/**
 * Pianificazione PURA della manutenzione periodica: cosa ricalcolare e quando.
 * Nessun import di react-native o alias '@/': testabile con node. L'esecuzione vera (expo-background-task, notifiche) sta in background.ts.
 *
 * Perche' serve: le notifiche locali DATE restano nel sistema (Android le ripristina dopo il riavvio, iOS le conserva), ma
 *  - i promemoria coprono solo i prossimi 14 giorni (WINDOW_DAYS): vanno ricalcolati man mano che passano i giorni;
 *  - i testi dei briefing (mattino/sera) sono calcolati al momento della programmazione: vanno rinfrescati ogni giorno;
 *  - le notifiche DAILY/WEEKLY e gli orari "di parete" cambiano con fuso orario e ora legale: vanno riprogrammate;
 *  - iOS ha un tetto di 64 notifiche programmate, quindi si programmano solo le piu' vicine e si completano alle riprese successive.
 */

export type TaskId = 'reminders' | 'bills' | 'briefings' | 'cleanup' | 'habits';
export const TASK_IDS: TaskId[] = ['reminders', 'bills', 'briefings', 'cleanup', 'habits'];
export type Source = 'foreground' | 'background' | 'boot';

export const HOUR = 3600000;
/** Ogni quanto ricalcolare, per compito (ms). */
export const INTERVAL: Record<TaskId, number> = {
  reminders: 6 * HOUR,
  bills: 6 * HOUR,
  briefings: 12 * HOUR,
  cleanup: 24 * HOUR,
  habits: 15 * 60000,
};
/** Intervallo minimo chiesto al sistema per il task in background (minuti; il sistema decide, Android >= 15). */
export const BACKGROUND_MIN_INTERVAL_MIN = 60;
export const TRASH_DAYS = 30;
export const NOTIF_MAX_AGE_DAYS = 60;
export const NOTIF_MAX = 200;
/** iOS: oltre questa soglia le notifiche programmate sono vicine al tetto di 64. */
export const IOS_WARN = 56;

export type MaintState = { lastRun: Partial<Record<TaskId, number>>; tz: string | null; offsetMin: number | null };
export const emptyState = (): MaintState => ({ lastRun: {}, tz: null, offsetMin: null });

export type MaintInput = {
  now: number;
  state: MaintState;
  tz: string;
  /** Date.getTimezoneOffset() dell'istante `now` (minuti, positivo a ovest di UTC) */
  offsetMin: number;
  /** notifiche attualmente programmate (null = non leggibile) */
  scheduledCount: number | null;
  /** permesso notifiche concesso (null = sconosciuto) */
  permission: boolean | null;
  source: Source;
  platform: 'ios' | 'android' | 'web';
  habitsEnabled?: boolean;
};

export type ClockChange = 'timezone' | 'dst' | null;
export type MaintDecision = { run: TaskId[]; reasons: Partial<Record<TaskId, string>>; clock: ClockChange; notes: string[]; next: MaintState };

/** Cambio di fuso (nome diverso) o di ora legale (stesso fuso, scarto diverso). Il primo avvio non e' un cambio. */
export function detectClockChange(prev: { tz: string | null; offsetMin: number | null }, cur: { tz: string; offsetMin: number }): ClockChange {
  if (prev.tz === null || prev.offsetMin === null) return null;
  if (prev.tz !== cur.tz) return 'timezone';
  if (prev.offsetMin !== cur.offsetMin) return 'dst';
  return null;
}

export function decide(i: MaintInput): MaintDecision {
  const { now, state } = i;
  const run: TaskId[] = [];
  const reasons: Partial<Record<TaskId, string>> = {};
  const notes: string[] = [];
  const clock = detectClockChange(state, i);
  const age = (t: TaskId) => (state.lastRun[t] === undefined ? Infinity : now - (state.lastRun[t] as number));
  const add = (t: TaskId, why: string) => { if (!run.includes(t)) { run.push(t); reasons[t] = why; } };

  const notifTasks: TaskId[] = ['reminders', 'bills', 'briefings'];
  if (i.platform === 'web') {
    notes.push('Web: nessuna notifica programmabile.');
  } else if (i.permission === false) {
    notes.push('Permesso notifiche negato: niente da programmare.');
  } else {
    for (const t of notifTasks) {
      if (clock) add(t, clock === 'timezone' ? 'cambio di fuso orario' : 'cambio ora legale');
      else if (state.lastRun[t] === undefined) add(t, 'mai eseguito');
      else if (i.source === 'boot') add(t, 'riavvio del telefono');
      else if (age(t) >= INTERVAL[t]) add(t, 'dati piu\' vecchi di ' + Math.round(INTERVAL[t] / HOUR) + ' ore');
    }
    // nessuna notifica programmata ma i promemoria erano stati calcolati da un po': il sistema potrebbe averle perse
    if (i.scheduledCount === 0 && age('reminders') >= 30 * 60000) add('reminders', 'nessuna notifica programmata');
    if (i.platform === 'ios' && (i.scheduledCount ?? 0) >= IOS_WARN) notes.push(`iOS: ${i.scheduledCount} notifiche programmate su 64: si programmano solo le piu' vicine.`);
  }
  if (age('cleanup') >= INTERVAL.cleanup) add('cleanup', 'pulizia giornaliera');
  if (i.habitsEnabled && age('habits') >= INTERVAL.habits) add('habits', 'controllo abitudini');

  const lastRun = { ...state.lastRun };
  for (const t of run) lastRun[t] = now;
  return { run, reasons, clock, notes, next: { lastRun, tz: i.tz, offsetMin: i.offsetMin } };
}

// ---------------------------------------------------------------- pulizia

export type TrashLike = { at: number };
/** Cestino: tiene solo gli elementi eliminati da meno di `days` giorni. */
export function pruneTrash<T extends TrashLike>(trash: T[] | undefined, now: number, days = TRASH_DAYS): T[] {
  return (trash ?? []).filter((x) => typeof x?.at === 'number' && now - x.at < days * 86400000);
}

export type NotifLike = { id: number; read: boolean };
/** Notifiche in-app: toglie le LETTE piu' vecchie di `days` giorni (l'id e' un timestamp) e tiene al massimo `max` voci. */
export function pruneNotifications<T extends NotifLike>(list: T[] | undefined, now: number, days = NOTIF_MAX_AGE_DAYS, max = NOTIF_MAX): T[] {
  const src = list ?? [];
  const keep = src.filter((n) => !(n.read && n.id > 1e12 && now - n.id > days * 86400000));
  return keep.length > max ? keep.slice(0, max) : keep;
}

export const wasTrimmed = (before: number, after: number) => before !== after;

// ---------------------------------------------------------------- esito

export type BgOutcome = { ts: number; source: Source; ok: boolean; ran: TaskId[]; clock: ClockChange; ms: number; error?: string; notes?: string[] };

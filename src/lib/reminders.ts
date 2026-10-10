/**
 * Promemoria degli impegni: calcolo PURO di quali notifiche locali programmare, a che ora e con quale testo.
 * Nessun import di react-native o alias '@/': testabile con node. La programmazione vera e propria
 * (expo-notifications) sta in lib/notify.ts.
 */
import { t } from '../i18n/core.ts';
import { arrivalPlan, BUFFER } from './arrival.ts';
import { travelMinutes } from './places.ts';

export const LEAD_OPTIONS = [5, 10, 15, 30, 60] as const;
export const DEFAULT_LEAD = 15;
/** Finestra massima di programmazione (giorni) e tetto di notifiche (iOS ne accetta 64: il resto serve a briefing e automazioni). */
export const WINDOW_DAYS = 14;
export const MAX_SCHEDULED = 50;
/** Quanti minuti prima dell'ora di partenza arriva l'avviso "Parti alle ...". */
export const DEPART_HEADSUP = 15;
export const ID_PREFIX = 'lp-ev-';

export type ReminderPrefs = { on: boolean; leadMin: number; depart: boolean };
export const DEFAULT_PREFS: ReminderPrefs = { on: true, leadMin: DEFAULT_LEAD, depart: true };

/** Preferenze salvate da versioni precedenti (o mancanti) -> valori validi. */
export function normalizePrefs(p?: Partial<ReminderPrefs> | null): ReminderPrefs {
  const lead = Number(p?.leadMin);
  return {
    on: p?.on !== false,
    leadMin: (LEAD_OPTIONS as readonly number[]).includes(lead) ? lead : DEFAULT_LEAD,
    depart: p?.depart !== false,
  };
}

export type RemEvent = { time: string; title: string; place?: string; dur?: number; reminder?: boolean };
export type Planned = { id: string; at: number; kind: 'lead' | 'depart'; day: string; idx: number; title: string; body: string };

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

/** Istante (ms, ora locale) di inizio dell'impegno, o null se giorno/ora non sono validi. */
export function startOf(day: string, time: string): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const m = TIME_RE.exec(time ?? '');
  if (!d || !m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  const ms = new Date(+d[1], +d[2] - 1, +d[3], h, mi, 0, 0).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export const reminderId = (day: string, idx: number, kind: 'lead' | 'depart') => `${ID_PREFIX}${day}-${idx}-${kind}`;

/** Testo del promemoria con anticipo. */
export function leadText(ev: RemEvent, leadMin: number): { title: string; body: string } {
  return {
    title: t('Promemoria · {0}', ev.title),
    body: ev.place ? t('Inizia tra {0} min, alle {1} · {2}.', leadMin, ev.time, ev.place) : t('Inizia tra {0} min, alle {1}.', leadMin, ev.time),
  };
}

/** Testo dell'avviso di partenza. */
export function departText(ev: RemEvent, travel: number, leaveBy: string): { title: string; body: string } {
  const place = ev.place ?? '';
  const sameName = place && ev.title.toLowerCase().includes(place.toLowerCase());
  return {
    title: t('Parti alle {0} · {1}', leaveBy, ev.title),
    body: sameName
      ? t('Per {0} servono circa {1} min: parti alle {2} per arrivare in tempo.', ev.title, travel, leaveBy)
      : t('Per {0} ({1}) servono circa {2} min: parti alle {3} per arrivare in tempo.', ev.title, place, travel, leaveBy),
  };
}

export type PlanOptions = {
  now: number;
  prefs?: Partial<ReminderPrefs> | null;
  /** città/luogo di partenza (useInterests.homeCity); se vuoto non si calcola il tragitto */
  homeCity?: string;
  windowDays?: number;
  max?: number;
};

/**
 * Elenco ordinato delle notifiche da programmare. Regole:
 * - solo impegni con ora valida, futuri, entro la finestra, senza `reminder === false`;
 * - promemoria con anticipo configurabile (solo se l'istante è ancora futuro);
 * - se c'è un luogo e il tragitto è stimabile: avviso "Parti alle HH:MM" (arrivalPlan + BUFFER);
 * - al massimo `max` notifiche, le piu' vicine nel tempo.
 */
export function planReminders(events: Record<string, RemEvent[]> | undefined | null, opts: PlanOptions): Planned[] {
  const prefs = normalizePrefs(opts.prefs);
  if (!prefs.on || !events) return [];
  const now = opts.now;
  const horizon = now + (opts.windowDays ?? WINDOW_DAYS) * 86400000;
  const max = opts.max ?? MAX_SCHEDULED;
  const home = (opts.homeCity ?? '').trim();
  const out: Planned[] = [];

  for (const day of Object.keys(events).sort()) {
    const list = events[day];
    if (!Array.isArray(list)) continue;
    list.forEach((ev, idx) => {
      if (!ev || ev.reminder === false || typeof ev.title !== 'string') return;
      const start = startOf(day, ev.time);
      if (start === null || start <= now || start > horizon) return;

      const leadAt = start - prefs.leadMin * 60000;
      if (leadAt > now) out.push({ id: reminderId(day, idx, 'lead'), at: leadAt, kind: 'lead', day, idx, ...leadText(ev, prefs.leadMin) });

      const place = (ev.place ?? '').trim();
      if (prefs.depart && place && home) {
        const travel = travelMinutes(home, place);
        if (travel > 0) {
          const leaveAt = start - (travel + BUFFER) * 60000;
          const headsUp = leaveAt - DEPART_HEADSUP * 60000;
          // se l'avviso anticipato è già passato ma la partenza è ancora futura, avvisa all'ora di partenza
          const at = headsUp > now ? headsUp : leaveAt > now + 30000 ? leaveAt : null;
          if (at !== null) {
            const leaveBy = arrivalPlan(ev.time, travel, 0).leaveBy;
            out.push({ id: reminderId(day, idx, 'depart'), at, kind: 'depart', day, idx, ...departText({ ...ev, place }, travel, leaveBy) });
          }
        }
      }
    });
  }
  out.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  return out.slice(0, Math.max(0, max));
}

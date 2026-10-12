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
/** Finestra massima di programmazione (giorni). */
export const WINDOW_DAYS = 14;
/** Limite di notifiche programmate di iOS. */
export const IOS_LIMIT = 64;
/** Slot lasciati liberi ad altre funzioni (briefing mattino/sera + scadenze delle bollette). */
export const RESERVED_SLOTS = 14;
/** Tetto di notifiche dei promemoria impegni: IOS_LIMIT - RESERVED_SLOTS. */
export const MAX_SCHEDULED = IOS_LIMIT - RESERVED_SLOTS;
/** Quanti minuti prima dell'ora di partenza arriva l'avviso anticipato "Tra 15 minuti devi partire". */
export const DEPART_HEADSUP = 15;
export const ID_PREFIX = 'lp-ev-';

export type ReminderKind = 'lead' | 'headsup' | 'depart' | 'start';

/**
 * Preferenze. `on` = interruttore generale; `lead` = avviso con anticipo (leadMin); `depart` = avvisi di partenza (richiede
 * luogo + città di casa) con `headsup` (15 min prima di partire) e `leave` (alla partenza) disattivabili ciascuno;
 * `start` = "Inizia ora" all'ora dell'impegno.
 */
export type ReminderPrefs = { on: boolean; leadMin: number; lead: boolean; depart: boolean; headsup: boolean; leave: boolean; start: boolean; /** notifica fissa con gli urgenti di oggi */ pin: boolean };
export const DEFAULT_PREFS: ReminderPrefs = { on: true, leadMin: DEFAULT_LEAD, lead: true, depart: true, headsup: true, leave: true, start: true, pin: true };

/** Preferenze salvate da versioni precedenti (o mancanti) -> valori validi. */
export function normalizePrefs(p?: Partial<ReminderPrefs> | null): ReminderPrefs {
  const lead = Number(p?.leadMin);
  return {
    on: p?.on !== false,
    leadMin: (LEAD_OPTIONS as readonly number[]).includes(lead) ? lead : DEFAULT_LEAD,
    lead: p?.lead !== false,
    depart: p?.depart !== false,
    headsup: p?.headsup !== false,
    leave: p?.leave !== false,
    start: p?.start !== false,
    pin: p?.pin !== false,
  };
}

export type RemEvent = { time: string; title: string; place?: string; dur?: number; reminder?: boolean };
export type Planned = { id: string; at: number; kind: ReminderKind; day: string; idx: number; title: string; body: string };

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

export const reminderId = (day: string, idx: number, kind: ReminderKind) => `${ID_PREFIX}${day}-${idx}-${kind}`;

const withPlace = (txt: string, place?: string) => (place ? `${txt} · ${place}` : txt);

/** Testo del promemoria con anticipo: titolo = nome dell'impegno. */
export function leadText(ev: RemEvent, leadMin: number): { title: string; body: string } {
  return { title: ev.title, body: withPlace(t('Inizia tra {0} min, alle {1}', leadMin, ev.time), ev.place) + '.' };
}

/** "Inizia ora" all'ora di inizio. */
export function startText(ev: RemEvent): { title: string; body: string } {
  return { title: ev.title, body: withPlace(t('Inizia ora, alle {0}', ev.time), ev.place) + '.' };
}

/** Avviso anticipato di partenza ("tra 15 minuti devi partire") e avviso alla partenza. */
export function departText(ev: RemEvent, travel: number, leaveBy: string, when: 'headsup' | 'depart', mins = DEPART_HEADSUP): { title: string; body: string } {
  const place = (ev.place ?? '').trim();
  const sameName = !!place && ev.title.toLowerCase().includes(place.toLowerCase());
  const where = place && !sameName ? ` (${place})` : '';
  if (when === 'headsup') return { title: ev.title, body: t('Tra {0} min devi partire, alle {1}. Servono circa {2} min{3}.', mins, leaveBy, travel, where) };
  return { title: ev.title, body: t('Parti alle {0}: servono circa {1} min{2} per arrivare in tempo.', leaveBy, travel, where) };
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
 * - 'lead': avviso con anticipo configurabile; 'start': "Inizia ora" all'ora esatta;
 * - se c'è un luogo e il tragitto è stimabile: 'headsup' (15 min prima della partenza) e 'depart' (alla partenza);
 * - mai nel passato; al massimo `max` notifiche (default MAX_SCHEDULED), le più vicine nel tempo.
 * Gli id sono deterministici: lp-ev-<giorno>-<indice>-<tipo>.
 */
export function planReminders(events: Record<string, RemEvent[]> | undefined | null, opts: PlanOptions): Planned[] {
  const prefs = normalizePrefs(opts.prefs);
  if (!prefs.on || !events) return [];
  const now = opts.now;
  const horizon = now + (opts.windowDays ?? WINDOW_DAYS) * 86400000;
  const max = opts.max ?? MAX_SCHEDULED;
  const home = (opts.homeCity ?? '').trim();
  const out: Planned[] = [];
  const add = (day: string, idx: number, kind: ReminderKind, at: number, text: { title: string; body: string }) => {
    if (at > now + 1000) out.push({ id: reminderId(day, idx, kind), at, kind, day, idx, ...text });
  };

  for (const day of Object.keys(events).sort()) {
    const list = events[day];
    if (!Array.isArray(list)) continue;
    list.forEach((ev, idx) => {
      if (!ev || ev.reminder === false || typeof ev.title !== 'string') return;
      const start = startOf(day, ev.time);
      if (start === null || start <= now || start > horizon) return;

      if (prefs.lead) add(day, idx, 'lead', start - prefs.leadMin * 60000, leadText(ev, prefs.leadMin));
      if (prefs.start) add(day, idx, 'start', start, startText(ev));

      const place = (ev.place ?? '').trim();
      if (prefs.depart && place && home) {
        const travel = travelMinutes(home, place);
        if (travel > 0) {
          const leaveAt = start - (travel + BUFFER) * 60000;
          const leaveBy = arrivalPlan(ev.time, travel, 0).leaveBy;
          const e = { ...ev, place };
          const headsUp = leaveAt - DEPART_HEADSUP * 60000;
          if (prefs.headsup) add(day, idx, 'headsup', headsUp, departText(e, travel, leaveBy, 'headsup'));
          if (prefs.leave) add(day, idx, 'depart', leaveAt, departText(e, travel, leaveBy, 'depart'));
        }
      }
    });
  }
  out.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  return out.slice(0, Math.max(0, max));
}

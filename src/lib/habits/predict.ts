/**
 * Usi concreti delle abitudini, tutti locali: tempo di tragitto appreso, suggerimenti di routine, anomalie, prossimo luogo probabile.
 */
import { t } from '../../i18n/core.ts';
import { dist, median, madScaled } from './geo.ts';
import { displayName, effectiveKind } from './labels.ts';
import type { LearnedTravel } from './travel.ts';
import { ROUTINE, onDay, relinkTrips, type Report } from './routine.ts';
import { atLocal, dayKey, fmtMin, isWorkday, minOfDay, overlap } from './time.ts';
import type { GeoPoint, Inferred, Place, Stay, Trip } from './types.ts';

export type Model = { places: Place[]; stays: Stay[]; trips: Trip[]; inferred: Record<string, Inferred> };

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const HOME_WORDS = new Set(['casa', 'home']);
const WORK_WORDS = new Set(['ufficio', 'office', 'lavoro', 'work']);

/** Trova il luogo appreso a cui si riferisce un testo ("Casa", "Palestra Fit", la citta' di casa...). */
export function resolvePlace(model: Model, text: string, homeNames: string[] = []): Place | null {
  const x = strip(text);
  if (!x) return null;
  const kindOf = (p: Place) => effectiveKind(p, model.inferred[p.id]);
  if (HOME_WORDS.has(x) || homeNames.some((h) => strip(h) === x && x)) return model.places.find((p) => kindOf(p) === 'casa') ?? null;
  if (WORK_WORDS.has(x)) return model.places.find((p) => kindOf(p) === 'lavoro') ?? null;
  let best: Place | null = null;
  for (const p of model.places) {
    const nm = strip(displayName(p, model.inferred[p.id]));
    if (!nm || nm === 'luogo senza nome') continue;
    if (nm === x || (nm.length >= 4 && (x.includes(nm) || (x.length >= 4 && nm.includes(x))))) { if (!best || p.visits > best.visits) best = p; }
  }
  return best;
}

/** Tragitto appreso tra due luoghi (testi) all'ora indicata. Richiede almeno `minTrips` spostamenti simili. */
export function learnTravel(model: Model, from: string, to: string, when: Date, homeNames: string[] = []): LearnedTravel | null {
  const a = resolvePlace(model, from, homeNames), b = resolvePlace(model, to, homeNames);
  if (!a || !b || a.id === b.id) return null;
  const trips = relinkTrips(model.trips, model.stays);
  const direct = trips.filter((x) => x.from === a.id && x.to === b.id);
  const rev = trips.filter((x) => x.from === b.id && x.to === a.id);
  const all = direct.length >= ROUTINE.minTrips ? direct : [...direct, ...rev];
  if (all.length < ROUTINE.minTrips) return null;
  const wTs = when.getTime();
  const wMin = minOfDay(wTs), work = isWorkday(wTs);
  const near = all.filter((x) => isWorkday(x.start) === work && Math.abs(minOfDay(x.start) - wMin) <= 90);
  const use = near.length >= ROUTINE.minTrips ? near : all;
  const mins = use.map((x) => (x.end - x.start) / 60000);
  const med = median(mins);
  if (!Number.isFinite(med) || med < 1) return null;
  const modes = new Map<string, number>();
  use.forEach((x) => modes.set(x.mode, (modes.get(x.mode) ?? 0) + 1));
  const mode = [...modes.entries()].sort((p, q) => q[1] - p[1])[0]?.[0] ?? 'sconosciuto';
  return { minutes: Math.min(240, Math.max(1, Math.round(med))), n: use.length, spreadMin: Math.round(madScaled(mins)), mode };
}

// ---------------------------------------------------------------- suggerimenti di routine

export type PlanEv = { time: string; title: string; dur?: number; place?: string };
export type RoutineSuggestion = { id: string; day: string; time: string; dur: number; title: string; place: string; text: string; why: string; n: number };

/** "Di solito il giovedi vai in palestra verso le 18:30: vuoi bloccare l'orario?" per i prossimi giorni senza impegni gia' presenti. */
export function routineSuggestions(rep: Report, events: Record<string, PlanEv[]>, now: Date, horizonDays = 7): RoutineSuggestion[] {
  const out: RoutineSuggestion[] = [];
  for (const r of rep.routines) {
    if (r.confidence === 'bassa' && r.n < 6) continue;
    if (r.kind === 'casa' || r.kind === 'lavoro' || r.place === t('Luogo senza nome')) continue;
    for (let k = 0; k < horizonDays; k++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k);
      if (!r.days.includes(d.getDay())) continue;
      const day = dayKey(d.getTime());
      const start = atLocal(day, fmtMin(r.arriveMin));
      if (start < now.getTime()) continue;
      const dur = Math.max(30, Math.min(180, Math.round(r.dwellMin / 15) * 15 || 60));
      const busy = (events[day] ?? []).some((e) => overlap(atLocal(day, e.time), atLocal(day, e.time) + (e.dur || 60) * 60000, start - 30 * 60000, start + dur * 60000) > 0);
      if (busy) continue;
      out.push({
        id: `${r.id}-${day}`, day, time: fmtMin(r.arriveMin), dur, title: r.place, place: r.place, n: r.n,
        text: t('Di solito {0} vai in «{1}» verso le {2}: vuoi bloccare l\'orario?', onDay(d.getDay()), r.place, fmtMin(r.arriveMin)),
        why: r.why,
      });
    }
  }
  return out.sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
}

// ---------------------------------------------------------------- anomalie "adesso" (solo se l'utente le abilita)

export type NowAlert = { id: string; text: string; why: string };

/** "Oggi non sei uscito di casa dalle…": serve un'uscita regolare (>= 8 giorni, confidenza almeno media) e che l'ultimo punto sia a casa. */
export function leaveAnomaly(model: Model, rep: Report, last: GeoPoint | null, now: Date): NowAlert | null {
  if (!last || now.getTime() - last.ts > 3 * 3600000) return null;
  const home = model.places.find((p) => effectiveKind(p, model.inferred[p.id]) === 'casa');
  if (!home || dist(home, last) > Math.max(home.radius, 80)) return null;
  const work = isWorkday(now.getTime());
  const rule = rep.leaveHome.find((l) => (work ? l.days.includes(1) : l.days.includes(6)));
  if (!rule || rule.n < 8 || rule.confidence === 'bassa') return null;
  const nowMin = minOfDay(now.getTime());
  const limit = rule.medianMin + Math.max(90, 3 * rule.madMin);
  if (nowMin < limit || nowMin > rule.medianMin + 6 * 60) return null;
  const today = dayKey(now.getTime());
  const left = relinkTrips(model.trips, model.stays).some((x) => x.from === home.id && dayKey(x.start) === today);
  if (left) return null;
  return {
    id: `leave-${today}`,
    text: t('Oggi non sei ancora uscito di casa: di solito esci verso le {0}.', fmtMin(rule.medianMin)),
    why: t('Basato su {0} giorni in cui sei uscito entro {1} minuti dalle {2}. Lo vedi perche\' hai attivato gli avvisi.', rule.n, ROUTINE.window, fmtMin(rule.medianMin)),
  };
}

/** Dove andrai probabilmente dopo (in base alle routine di oggi ancora da fare). */
export function nextExpected(rep: Report, now: Date): { place: string; time: string; n: number } | null {
  const wd = now.getDay(), nm = minOfDay(now.getTime());
  const c = rep.routines.filter((r) => r.days.includes(wd) && r.arriveMin > nm).sort((a, b) => a.arriveMin - b.arriveMin)[0];
  return c ? { place: c.place, time: fmtMin(c.arriveMin), n: c.n } : null;
}

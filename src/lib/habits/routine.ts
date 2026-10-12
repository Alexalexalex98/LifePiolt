/**
 * Routine dalle soste e dagli spostamenti. Solo statistiche ROBUSTE (mediana e MAD) e SOGLIE MINIME di osservazioni:
 * sotto soglia l'app non dice nulla ("non constatare cio' che non e' certo"). Ogni risultato porta con se' N osservazioni,
 * una confidenza e il motivo ("perche' lo penso").
 */
import { t } from '../../i18n/core.ts';
import { median, madScaled, quantile } from './geo.ts';
import { displayName, effectiveKind } from './labels.ts';
import { dayKey, fmtMin, isWorkday, minOfDay, WEEKDAYS, weekdayOf } from './time.ts';
import type { Confidence, Inferred, Mode, Place, Stay, Trip } from './types.ts';

export const ROUTINE = {
  /** giorni con dati sotto i quali non si afferma NIENTE */
  minDays: 7,
  /** osservazioni minime per una routine settimanale / un tempo di tragitto / un orario di uscita */
  minHits: 4,
  minTrips: 4,
  minLeaveDays: 5,
  /** quota minima di quel giorno della settimana in cui si va davvero in quel posto */
  minShare: 0.6,
  /** finestra di regolarita' (min) attorno alla mediana */
  window: 45,
  /** stay piu' corte non contano come visita */
  minStayMin: 10,
  /** giorni "diversi dal solito": soglia robusta e giorni minimi nella classe */
  anomalyZ: 3.5,
  anomalyMinClass: 10,
};

export type Commute = {
  from: string; to: string; n: number;
  medianMin: number; madMin: number; p10: number; p90: number;
  mode: Mode; modeShare: number; confidence: Confidence;
};
export type LeaveHome = { days: number[]; medianMin: number; madMin: number; n: number; within: number; confidence: Confidence; text: string; why: string };
export type Routine = {
  id: string; placeId: string; place: string; kind: string;
  days: number[]; arriveMin: number; spreadMin: number; dwellMin: number;
  n: number; opps: number; share: number; confidence: Confidence; text: string; why: string;
};
export type DayType = { label: string; days: number; of: number; steps: { place: string; arrive: string; leave: string }[]; text: string };
export type Report = {
  daysObserved: number; spanDays: number; enough: boolean;
  commutes: Commute[]; leaveHome: LeaveHome[]; routines: Routine[]; dayTypes: DayType[];
  dwell: Record<string, { medianMin: number; n: number }>;
};

const conf = (n: number, within: number, spread: number): Confidence => (n >= 10 && within >= 0.8 && spread <= 30 ? 'alta' : n >= 6 && within >= 0.65 ? 'media' : 'bassa');

/** Collega gli spostamenti ai luoghi delle soste adiacenti. */
export function relinkTrips(trips: Trip[], stays: Stay[]): Trip[] {
  const byEnd = new Map(stays.map((s) => [s.end, s]));
  const byStart = new Map(stays.map((s) => [s.start, s]));
  return trips.map((tr) => ({ ...tr, from: byEnd.get(tr.start)?.placeId, to: byStart.get(tr.end)?.placeId }));
}

const days = (ts: number[]) => new Set(ts.map(dayKey));

export function analyze(input: { places: Place[]; stays: Stay[]; trips: Trip[]; inferred: Record<string, Inferred> }): Report {
  const R = ROUTINE;
  const { places, stays, inferred } = input;
  const trips = relinkTrips(input.trips, stays);
  const placeOf = new Map(places.map((p) => [p.id, p]));
  const kind = (id: string) => { const p = placeOf.get(id); return p ? effectiveKind(p, inferred[id]) : 'altro'; };
  const name = (id: string) => { const p = placeOf.get(id); return p ? displayName(p, inferred[id]) : t('Luogo senza nome'); };

  const obsDays = new Set<string>();
  stays.forEach((s) => { obsDays.add(dayKey(s.start)); obsDays.add(dayKey(s.end)); });
  trips.forEach((x) => obsDays.add(dayKey(x.start)));
  const sortedDays = [...obsDays].sort();
  const span = sortedDays.length ? Math.round((new Date(sortedDays[sortedDays.length - 1] + 'T12:00:00').getTime() - new Date(sortedDays[0] + 'T12:00:00').getTime()) / 86400000) + 1 : 0;
  const enough = obsDays.size >= R.minDays;
  const rep: Report = { daysObserved: obsDays.size, spanDays: span, enough, commutes: [], leaveHome: [], routines: [], dayTypes: [], dwell: {} };
  if (!enough) return rep;

  const home = places.find((p) => kind(p.id) === 'casa');

  // ---- tempi di permanenza
  const dw = new Map<string, number[]>();
  stays.forEach((s) => { if (s.placeId && (s.end - s.start) / 60000 >= R.minStayMin) (dw.get(s.placeId) ?? dw.set(s.placeId, []).get(s.placeId)!).push((s.end - s.start) / 60000); });
  dw.forEach((v, k) => { if (v.length >= R.minHits) rep.dwell[k] = { medianMin: Math.round(median(v)), n: v.length }; });

  // ---- tragitti per coppia di luoghi
  const pairs = new Map<string, Trip[]>();
  trips.forEach((x) => { if (x.from && x.to && x.from !== x.to) (pairs.get(`${x.from}|${x.to}`) ?? pairs.set(`${x.from}|${x.to}`, []).get(`${x.from}|${x.to}`)!).push(x); });
  pairs.forEach((list, key) => {
    if (list.length < R.minTrips) return;
    const [from, to] = key.split('|');
    const mins = list.map((x) => (x.end - x.start) / 60000);
    const modes = new Map<Mode, number>();
    list.forEach((x) => modes.set(x.mode, (modes.get(x.mode) ?? 0) + 1));
    const known = [...modes.entries()].filter(([m]) => m !== 'sconosciuto').sort((a, b) => b[1] - a[1]);
    const top = known[0];
    const share = top ? top[1] / list.length : 0;
    const mad = madScaled(mins);
    rep.commutes.push({
      from, to, n: list.length, medianMin: Math.round(median(mins)), madMin: Math.round(mad), p10: Math.round(quantile(mins, 0.1)), p90: Math.round(quantile(mins, 0.9)),
      mode: top && share >= 0.6 ? top[0] : 'sconosciuto', modeShare: share,
      confidence: list.length >= 12 && mad <= 0.25 * median(mins) ? 'alta' : list.length >= 6 ? 'media' : 'bassa',
    });
  });
  rep.commutes.sort((a, b) => b.n - a.n);

  // ---- uscita da casa per tipo di giorno
  if (home) {
    const firstLeave = new Map<string, number>();
    trips.filter((x) => x.from === home.id).sort((a, b) => a.start - b.start).forEach((x) => { const d = dayKey(x.start); if (!firstLeave.has(d)) firstLeave.set(d, x.start); });
    const groups: { label: string; days: number[]; test: (ts: number) => boolean }[] = [
      { label: 'work', days: [1, 2, 3, 4, 5], test: isWorkday },
      { label: 'weekend', days: [6, 0], test: (ts) => !isWorkday(ts) },
    ];
    for (const g of groups) {
      const v = [...firstLeave.values()].filter(g.test).map(minOfDay);
      if (v.length < R.minLeaveDays) continue;
      const med = median(v), mad = madScaled(v);
      const within = v.filter((x) => Math.abs(x - med) <= R.window).length / v.length;
      if (within < 0.5) continue; // troppo irregolare per dire "di solito"
      const dayNames = g.label === 'work' ? t('nei giorni feriali') : t('nel weekend');
      rep.leaveHome.push({
        days: g.days, medianMin: Math.round(med), madMin: Math.round(mad), n: v.length, within, confidence: conf(v.length, within, mad),
        text: t('Sembra che {0} esci di casa verso le {1}.', dayNames, fmtMin(med)),
        why: t('Basato su {0} giorni: nel {1}% dei casi sei uscito entro {2} minuti dalle {3}.', v.length, Math.round(within * 100), R.window, fmtMin(med)),
      });
    }
  }

  // ---- routine settimanali: stesso posto, stesso giorno, orario regolare
  const opps = new Map<number, Set<string>>();
  obsDays.forEach((d) => { const w = new Date(d + 'T12:00:00').getDay(); (opps.get(w) ?? opps.set(w, new Set()).get(w)!).add(d); });
  type Cell = { place: string; wd: number; arr: number[]; dwell: number[]; ds: Set<string> };
  const cells = new Map<string, Cell>();
  const firstPerDay = new Set<string>();
  stays.slice().sort((a, b) => a.start - b.start).forEach((s) => {
    if (!s.placeId || (s.end - s.start) / 60000 < R.minStayMin) return;
    const d = dayKey(s.start), wd = weekdayOf(s.start), key = `${s.placeId}|${wd}`;
    if (firstPerDay.has(key + d)) return; firstPerDay.add(key + d);
    const c = cells.get(key) ?? cells.set(key, { place: s.placeId, wd, arr: [], dwell: [], ds: new Set() }).get(key)!;
    c.arr.push(minOfDay(s.start)); c.dwell.push((s.end - s.start) / 60000); c.ds.add(d);
  });
  const good: (Cell & { med: number; mad: number; within: number; share: number })[] = [];
  cells.forEach((c) => {
    if (c.place === home?.id) return;
    const o = opps.get(c.wd)?.size ?? 0;
    if (c.ds.size < R.minHits || !o) return;
    const share = c.ds.size / o;
    if (share < R.minShare) return;
    const med = median(c.arr), mad = madScaled(c.arr);
    const within = c.arr.filter((x) => Math.abs(x - med) <= R.window).length / c.arr.length;
    if (within < 0.6) return;
    good.push({ ...c, med, mad, within, share });
  });
  // raggruppa i giorni con lo stesso luogo e orario simile
  const used = new Set<number>();
  good.sort((a, b) => a.place.localeCompare(b.place) || a.wd - b.wd);
  good.forEach((c, i) => {
    if (used.has(i)) return;
    const grp = [c];
    good.forEach((d, j) => { if (j > i && !used.has(j) && d.place === c.place && Math.abs(d.med - c.med) <= 40) { grp.push(d); used.add(j); } });
    used.add(i);
    const arr = grp.flatMap((g) => g.arr), dwell = grp.flatMap((g) => g.dwell);
    const med = median(arr), mad = madScaled(arr);
    const within = arr.filter((x) => Math.abs(x - med) <= R.window).length / arr.length;
    const n = grp.reduce((s, g) => s + g.ds.size, 0), op = grp.reduce((s, g) => s + (opps.get(g.wd)?.size ?? 0), 0);
    const dl = grp.map((g) => g.wd).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    const nm = name(c.place);
    const dtxt = dl.length === 5 && !dl.includes(0) && !dl.includes(6) ? t('nei giorni feriali') : dl.length === 1 ? t('il {0}', t(WEEKDAYS[dl[0]])) : t('il {0}', dl.map((w) => t(WEEKDAYS[w])).join(', '));
    rep.routines.push({
      id: `r-${c.place}-${dl.join('')}`, placeId: c.place, place: nm, kind: kind(c.place), days: dl,
      arriveMin: Math.round(med), spreadMin: Math.round(mad), dwellMin: Math.round(median(dwell)), n, opps: op, share: n / Math.max(1, op), within,
      confidence: conf(n, within, mad),
      text: t('Sembra che {0} tu vada in «{1}» verso le {2}.', dtxt, nm, fmtMin(med)),
      why: t('Basato su {0} giorni su {1} ({2}%): arrivi entro {3} minuti dalle {4} nel {5}% dei casi e ti fermi circa {6} minuti.', n, op, Math.round((n / Math.max(1, op)) * 100), R.window, fmtMin(med), Math.round(within * 100), Math.round(median(dwell))),
    });
  });
  rep.routines.sort((a, b) => b.n - a.n);

  // ---- giornate tipo: sequenza di luoghi del giorno
  type Day = { d: string; seq: { id: string; a: number; l: number }[] };
  const byDay = new Map<string, Day>();
  stays.slice().sort((a, b) => a.start - b.start).forEach((s) => {
    if (!s.placeId || (s.end - s.start) / 60000 < R.minStayMin) return;
    const d = dayKey(s.start);
    const day = byDay.get(d) ?? byDay.set(d, { d, seq: [] }).get(d)!;
    const last = day.seq[day.seq.length - 1];
    if (last && last.id === s.placeId) last.l = minOfDay(s.end); else day.seq.push({ id: s.placeId, a: minOfDay(s.start), l: minOfDay(s.end) });
  });
  for (const cls of ['work', 'weekend'] as const) {
    const list = [...byDay.values()].filter((x) => (isWorkday(new Date(x.d + 'T12:00:00').getTime()) ? 'work' : 'weekend') === cls && x.seq.length >= 2);
    const total = [...obsDays].filter((d) => (isWorkday(new Date(d + 'T12:00:00').getTime()) ? 'work' : 'weekend') === cls).length;
    if (list.length < R.minHits) continue;
    // la firma toglie i luoghi occasionali: restano quelli con >= 3 visite nel periodo
    const freq = new Map<string, number>();
    list.forEach((x) => new Set(x.seq.map((s) => s.id)).forEach((id) => freq.set(id, (freq.get(id) ?? 0) + 1)));
    const sig = (x: Day) => x.seq.filter((s) => (freq.get(s.id) ?? 0) >= 3).map((s) => s.id).filter((id, i, a) => a[i - 1] !== id).join('>');
    const sigs = new Map<string, Day[]>();
    list.forEach((x) => { const k = sig(x); if (k.includes('>')) (sigs.get(k) ?? sigs.set(k, []).get(k)!).push(x); });
    const top = [...sigs.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    if (!top || top[1].length < R.minHits || top[1].length / Math.max(1, total) < 0.3) continue;
    const ids = top[0].split('>');
    const steps = ids.map((id, k) => {
      const arrs: number[] = [], leaves: number[] = [];
      top[1].forEach((x) => { const seq = x.seq.filter((s) => (freq.get(s.id) ?? 0) >= 3).filter((s, i, a) => a[i - 1]?.id !== s.id); const st = seq[k]; if (st) { arrs.push(st.a); leaves.push(st.l); } });
      return { place: name(id), arrive: fmtMin(median(arrs)), leave: fmtMin(median(leaves)) };
    });
    const label = cls === 'work' ? t('Giornata tipo feriale') : t('Giornata tipo del weekend');
    rep.dayTypes.push({ label, days: top[1].length, of: total, steps, text: steps.map((s) => `${s.place} ${s.arrive}`).join(' → ') });
  }
  return rep;
}

/** Giorni "diversi dal solito": minuti fuori casa in un giorno, confrontati (MAD) con giorni della stessa classe. */
export type DayAnomaly = { day: string; outMin: number; typicalMin: number; z: number; text: string };
export function dayAnomalies(input: { places: Place[]; stays: Stay[]; inferred: Record<string, Inferred> }): DayAnomaly[] {
  const R = ROUTINE;
  const home = input.places.find((p) => effectiveKind(p, input.inferred[p.id]) === 'casa');
  if (!home) return [];
  const per = new Map<string, number>();
  const obs = new Set<string>();
  input.stays.forEach((s) => { obs.add(dayKey(s.start)); });
  input.stays.forEach((s) => {
    if (s.placeId === home.id) return;
    const d = dayKey(s.start);
    per.set(d, (per.get(d) ?? 0) + (s.end - s.start) / 60000);
  });
  const rows = [...obs].map((d) => ({ d, out: per.get(d) ?? 0, cls: isWorkday(new Date(d + 'T12:00:00').getTime()) ? 'work' : 'weekend' }));
  const res: DayAnomaly[] = [];
  for (const cls of ['work', 'weekend']) {
    const c = rows.filter((r) => r.cls === cls);
    if (c.length < R.anomalyMinClass) continue;
    const med = median(c.map((r) => r.out)), mad = madScaled(c.map((r) => r.out)) || 30;
    c.forEach((r) => {
      const z = (r.out - med) / mad;
      if (Math.abs(z) >= R.anomalyZ && Math.abs(r.out - med) >= 120) {
        res.push({ day: r.d, outMin: Math.round(r.out), typicalMin: Math.round(med), z, text: r.out < med ? t('Giornata quasi tutta in casa: di solito stai fuori circa {0} ore.', Math.round(med / 60)) : t('Giornata fuori casa piu\' lunga del solito: circa {0} ore contro {1}.', Math.round(r.out / 60), Math.round(med / 60)) });
      }
    });
  }
  return res.sort((a, b) => a.day.localeCompare(b.day));
}

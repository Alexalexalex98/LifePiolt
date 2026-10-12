/**
 * Etichette dei luoghi con REGOLE TRASPARENTI (ogni deduzione porta con se' il motivo e il numero di osservazioni):
 *  - CASA: il luogo dove si trascorre la notte (almeno 3 ore tra le 00:00 e le 06:00) per almeno 5 notti e per almeno la meta' delle notti osservate;
 *  - LAVORO: un altro luogo frequentato nei giorni feriali di giorno (almeno 2 ore e mezza tra le 09:00 e le 17:00) per almeno 5 giorni
 *    e per almeno il 40% dei giorni feriali osservati;
 *  - PALESTRA / ALTRO: solo se l'utente li nomina, oppure se almeno 2 impegni del Plan con luogo (o con parole come "palestra") coincidono
 *    con le soste in quel luogo. Altrimenti il luogo resta senza etichetta e l'app lo chiede.
 * L'utente ha sempre l'ultima parola: il nome scelto da lui vince su ogni deduzione.
 */
import { t } from '../../i18n/core.ts';
import { sameBase } from '../places.ts';
import { atLocal, daysBetween, isWorkday, overlap } from './time.ts';
import { HOUR_MS, type Confidence, type Inferred, type Place, type PlaceKind, type Stay } from './types.ts';

export const LABEL = {
  nightFrom: 0, nightTo: 6, minNightMs: 3 * HOUR_MS, minNights: 5, minNightShare: 0.5,
  dayFrom: 9, dayTo: 17, minDayMs: 2.5 * HOUR_MS, minWorkDays: 5, minWorkShare: 0.4,
  minEventMatches: 2,
};

export type PlanEvent = { time: string; title: string; place?: string; dur?: number };

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const KEYWORDS: { kind: PlaceKind; name: string; re: RegExp }[] = [
  { kind: 'palestra', name: 'Palestra', re: /\b(palestra|gym|fitness|crossfit|yoga|pilates|nuoto|piscina)\b/ },
  { kind: 'studio', name: 'Studio', re: /\b(universita|lezione|scuola|corso|biblioteca)\b/ },
  { kind: 'negozio', name: 'Negozio', re: /\b(spesa|supermercato|negozio|mercato)\b/ },
];

export function kindLabel(k: PlaceKind | undefined): string {
  return k === 'casa' ? 'Casa' : k === 'lavoro' ? 'Lavoro' : k === 'palestra' ? 'Palestra' : k === 'studio' ? 'Studio' : k === 'negozio' ? 'Negozio' : 'Altro';
}

/** Nome da mostrare: scelta dell'utente > etichetta dedotta > "Luogo senza nome". */
export function displayName(p: Place, inf?: Inferred): string {
  return p.name || inf?.name || (p.kind ? kindLabel(p.kind) : inf ? kindLabel(inf.kind) : 'Luogo senza nome');
}
export function effectiveKind(p: Place, inf?: Inferred): PlaceKind { return p.kind ?? inf?.kind ?? 'altro'; }

const conf = (n: number, share: number): Confidence => (n >= 14 && share >= 0.8 ? 'alta' : n >= 8 && share >= 0.65 ? 'media' : 'bassa');

/** Per ogni luogo: notti e giorni feriali di presenza. */
export function presence(stays: Stay[]) {
  const nights = new Map<string, Set<string>>(); // placeId -> giorni (notte che finisce alle 06:00 di quel giorno)
  const workdays = new Map<string, Set<string>>();
  const obsNights = new Set<string>(), obsWork = new Set<string>();
  for (const s of stays) {
    if (!s.placeId) continue;
    for (const d of daysBetween(s.start, s.end)) {
      const t0 = atLocal(d, '00:00');
      const night = overlap(s.start, s.end, t0 + LABEL.nightFrom * HOUR_MS, t0 + LABEL.nightTo * HOUR_MS);
      if (night >= LABEL.minNightMs) { (nights.get(s.placeId) ?? nights.set(s.placeId, new Set()).get(s.placeId)!).add(d); obsNights.add(d); }
      if (isWorkday(t0 + 12 * HOUR_MS)) {
        const day = overlap(s.start, s.end, t0 + LABEL.dayFrom * HOUR_MS, t0 + LABEL.dayTo * HOUR_MS);
        if (day >= LABEL.minDayMs) { (workdays.get(s.placeId) ?? workdays.set(s.placeId, new Set()).get(s.placeId)!).add(d); }
      }
    }
  }
  // giorni feriali osservati = feriali con almeno una sosta di qualunque luogo in orario diurno
  for (const s of stays) for (const d of daysBetween(s.start, s.end)) {
    const t0 = atLocal(d, '00:00');
    if (isWorkday(t0 + 12 * HOUR_MS) && overlap(s.start, s.end, t0 + LABEL.dayFrom * HOUR_MS, t0 + LABEL.dayTo * HOUR_MS) > 30 * 60000) obsWork.add(d);
  }
  return { nights, workdays, obsNights, obsWork };
}

export function inferLabels(places: Place[], stays: Stay[], events: Record<string, PlanEvent[]> = {}): Record<string, Inferred> {
  const out: Record<string, Inferred> = {};
  const pr = presence(stays);
  const L = LABEL;

  // casa
  let home: { id: string; n: number } | null = null;
  for (const p of places) {
    const n = pr.nights.get(p.id)?.size ?? 0;
    if (n >= L.minNights && n / Math.max(1, pr.obsNights.size) >= L.minNightShare && (!home || n > home.n)) home = { id: p.id, n };
  }
  if (home) {
    const share = home.n / Math.max(1, pr.obsNights.size);
    out[home.id] = { kind: 'casa', why: t('Ci hai trascorso la notte {0} volte su {1} notti osservate.', home.n, pr.obsNights.size), basedOn: home.n, confidence: conf(home.n, share) };
  }

  // lavoro
  let work: { id: string; n: number } | null = null;
  for (const p of places) {
    if (out[p.id]) continue;
    if ((pr.nights.get(p.id)?.size ?? 0) >= L.minNights) continue;
    const n = pr.workdays.get(p.id)?.size ?? 0;
    if (n >= L.minWorkDays && n / Math.max(1, pr.obsWork.size) >= L.minWorkShare && (!work || n > work.n)) work = { id: p.id, n };
  }
  if (work) {
    const share = work.n / Math.max(1, pr.obsWork.size);
    out[work.id] = { kind: 'lavoro', why: t('Ci passi gran parte della giornata nei giorni feriali: {0} giorni su {1} osservati.', work.n, pr.obsWork.size), basedOn: work.n, confidence: conf(work.n, share) };
  }

  // incrocio con il Plan: impegni con luogo/parole chiave che coincidono con le soste
  const votes = new Map<string, Map<string, { kind: PlaceKind; name: string; days: Set<string> }>>();
  for (const s of stays) {
    if (!s.placeId || out[s.placeId]) continue;
    for (const d of daysBetween(s.start, s.end)) {
      for (const e of events[d] ?? []) {
        const st = atLocal(d, e.time), en = st + (e.dur || 60) * 60000;
        if (overlap(s.start, s.end, st, en) < Math.min(15 * 60000, (en - st) / 2)) continue;
        const text = strip(`${e.place ?? ''} ${e.title}`);
        const kw = KEYWORDS.find((k) => k.re.test(text));
        const place = (e.place ?? '').trim();
        let kind: PlaceKind = 'altro', name = '';
        if (place && (sameBase(place, 'casa') || sameBase(place, 'ufficio'))) continue; // "casa/ufficio" non danno un nome nuovo
        if (place) { kind = kw?.kind ?? 'altro'; name = place; }
        else if (kw) { kind = kw.kind; name = kw.name; }
        else continue;
        const key = strip(name);
        const m = votes.get(s.placeId) ?? votes.set(s.placeId, new Map()).get(s.placeId)!;
        const v = m.get(key) ?? { kind, name, days: new Set<string>() };
        v.days.add(d); m.set(key, v);
      }
    }
  }
  for (const [pid, m] of votes) {
    const best = [...m.values()].sort((a, b) => b.days.size - a.days.size)[0];
    if (best && best.days.size >= L.minEventMatches) {
      out[pid] = { kind: best.kind, name: best.name, why: t('Hai {0} impegni «{1}» nel Plan che coincidono con le tue soste qui.', best.days.size, best.name), basedOn: best.days.size, confidence: best.days.size >= 6 ? 'media' : 'bassa' };
    }
  }
  return out;
}

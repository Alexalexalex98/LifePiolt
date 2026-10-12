/**
 * Rilevamento di SOSTE (stay point) e SPOSTAMENTI da una sequenza di punti puliti.
 *
 * Algoritmo (stay-point detection, Li et al. 2008, con centro mobile):
 *  - si parte da un punto e si estende la finestra finche' i punti restano entro `radius` dal centro della finestra;
 *  - se la finestra dura almeno `minStayMs` e contiene almeno `minPoints` punti, e' una sosta;
 *  - tra due punti consecutivi della stessa sosta non puo' passare piu' di `maxGapMs` (altrimenti non sappiamo cosa e' successo).
 * Una sosta e' "chiusa" solo quando si vede un punto fuori raggio (la partenza). L'ultima finestra resta "aperta".
 * Con campionamento rado (modalita' "solo quando apro l'app") bastano due punti agli estremi della sosta.
 */
import { centroid, dist, pathLength } from './geo.ts';
import { classifyMode } from './mode.ts';
import { HOUR_MS, MIN_MS, type GeoPoint, type Stay, type Trip } from './types.ts';

export const STAY = {
  /** raggio massimo di una sosta (m) */
  radius: 120,
  /** durata minima per chiamarla sosta */
  minStayMs: 10 * MIN_MS,
  minPoints: 2,
  /** buco massimo tra due punti della stessa sosta (notte intera senza movimento) */
  maxGapMs: 18 * HOUR_MS,
  /** i punti di avvicinamento/uscita oltre questa distanza dal centro non fanno parte della sosta (m) */
  trimRadius: 60,
};

export type StayOpts = Partial<typeof STAY>;
export type StayRange = Stay & { i: number; j: number; reachesEnd: boolean };

/** Tutte le soste trovate; `closed` = seguite da un punto fuori raggio (la sosta aperta e' l'ultima, se arriva all'ultimo punto). */
export function detectStays(points: GeoPoint[], opts: StayOpts = {}): { closed: StayRange[]; open: StayRange | null } {
  const o = { ...STAY, ...opts };
  const n = points.length;
  const found: StayRange[] = [];
  let i = 0;
  while (i < n) {
    let j = i, cnt = 1, sLat = points[i].lat, sLng = points[i].lng;
    while (j + 1 < n) {
      const p = points[j + 1];
      if (p.ts - points[j].ts > o.maxGapMs) break;
      if (dist({ lat: sLat / cnt, lng: sLng / cnt }, p) > o.radius + Math.min(p.accuracy, 50) * 0.5) break;
      j++; cnt++; sLat += p.lat; sLng += p.lng;
    }
    if (points[j].ts - points[i].ts >= o.minStayMs && cnt >= o.minPoints) {
      const reachesEnd = j === n - 1;
      let a = i, b = j;
      let c = centroid(points.slice(a, b + 1));
      // taglia gli estremi ancora "in cammino": l'arrivo e la partenza veri sono i primi/ultimi punti vicini al centro
      while (a < b && dist(points[a], c) > o.trimRadius) a++;
      while (b > a && dist(points[b], c) > o.trimRadius) b--;
      if (b > a && points[b].ts - points[a].ts >= o.minStayMs && b - a + 1 >= o.minPoints) c = centroid(points.slice(a, b + 1));
      else { a = i; b = j; }
      found.push({ start: points[a].ts, end: points[b].ts, lat: c.lat, lng: c.lng, n: b - a + 1, i: a, j: b, reachesEnd });
      i = j + 1;
    } else i++;
  }
  const last = found[found.length - 1];
  if (last && last.reachesEnd) return { closed: found.slice(0, -1), open: last };
  return { closed: found, open: null };
}

/** Spostamento tra due soste consecutive, usando i punti intermedi (se ci sono). */
export function tripBetween(a: Stay, b: Stay, points: GeoPoint[]): Trip | null {
  if (dist(a, b) < 150) return null; // stessa zona: non e' uno spostamento
  const mid = points.filter((p) => p.ts > a.end && p.ts < b.start);
  const path = [{ lat: a.lat, lng: a.lng, ts: a.end, accuracy: 20, speed: null }, ...mid, { lat: b.lat, lng: b.lng, ts: b.start, accuracy: 20, speed: null }] as GeoPoint[];
  const dm = Math.max(pathLength(path), dist(a, b));
  const m = classifyMode(mid, { distM: dm, durMs: b.start - a.end, samples: mid.length });
  return { start: a.end, end: b.start, distM: Math.round(dm), mode: m.mode, modeConf: m.confidence, samples: mid.length };
}

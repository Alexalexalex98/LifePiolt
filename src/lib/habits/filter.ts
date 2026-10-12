/**
 * Pulizia dei punti grezzi: valori non validi, accuratezza scarsa, duplicati e salti impossibili (GPS che "salta" per un attimo).
 * Soglie dichiarate qui e riportate in docs/habits.md.
 */
import { dist } from './geo.ts';
import type { GeoPoint } from './types.ts';

export const FILTER = {
  /** scarta i punti con incertezza oltre questo valore (m) */
  maxAccuracy: 100,
  /** velocita' massima plausibile tra due punti (m/s): ~216 km/h; oltre, il punto e' un salto del GPS */
  maxSpeed: 60,
  /** dopo questo numero di scarti consecutivi per "salto" si accetta il nuovo punto (spostamento vero, es. volo o telefono spento) */
  acceptAfter: 3,
  /** pausa oltre la quale non si giudica il salto (s): il telefono puo' essere stato spento */
  gapNoJudge: 6 * 3600,
};

export type FilterReport = { kept: number; invalid: number; accuracy: number; duplicate: number; jump: number };

export function filterPoints(raw: GeoPoint[], opts: Partial<typeof FILTER> = {}): { points: GeoPoint[]; report: FilterReport } {
  const o = { ...FILTER, ...opts };
  const rep: FilterReport = { kept: 0, invalid: 0, accuracy: 0, duplicate: 0, jump: 0 };
  const ok: GeoPoint[] = [];
  for (const p of raw) {
    if (!p || !Number.isFinite(p.ts) || !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180 || (p.lat === 0 && p.lng === 0)) { rep.invalid++; continue; }
    const acc = Number.isFinite(p.accuracy) && p.accuracy >= 0 ? p.accuracy : o.maxAccuracy;
    if (acc > o.maxAccuracy) { rep.accuracy++; continue; }
    ok.push({ ts: p.ts, lat: p.lat, lng: p.lng, accuracy: acc, speed: p.speed != null && Number.isFinite(p.speed) && p.speed >= 0 ? p.speed : null });
  }
  ok.sort((a, b) => a.ts - b.ts);
  const out: GeoPoint[] = [];
  let skipped = 0;
  for (const p of ok) {
    const last = out[out.length - 1];
    if (last && p.ts === last.ts) { rep.duplicate++; continue; }
    if (last) {
      const dt = (p.ts - last.ts) / 1000;
      const d = dist(last, p);
      const slack = last.accuracy + p.accuracy;
      if (dt < o.gapNoJudge && d > slack && d / Math.max(dt, 1) > o.maxSpeed && skipped < o.acceptAfter) { rep.jump++; skipped++; continue; }
    }
    skipped = 0;
    out.push(p);
  }
  rep.kept = out.length;
  return { points: out, report: rep };
}

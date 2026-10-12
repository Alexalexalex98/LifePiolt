/** Geometria sferica minima (nessuna rete, nessuna libreria). */
import type { GeoPoint } from './types.ts';

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distanza in metri (haversine). */
export function distM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export const dist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => distM(a.lat, a.lng, b.lat, b.lng);

/** Centro (media) di un insieme di punti: vale per distanze di pochi chilometri. */
export function centroid(pts: { lat: number; lng: number }[], w?: number[]): { lat: number; lng: number } {
  let sw = 0, la = 0, ln = 0;
  pts.forEach((p, i) => { const x = w ? w[i] : 1; sw += x; la += p.lat * x; ln += p.lng * x; });
  return sw ? { lat: la / sw, lng: ln / sw } : { lat: 0, lng: 0 };
}

/** Arrotonda a una griglia di ~100 m (0.001 gradi di latitudine = 111 m; la longitudine si adatta alla latitudine). */
export function coarsen(lat: number, lng: number, meters = 100): { lat: number; lng: number } {
  const dLat = meters / 111320;
  const dLng = meters / (111320 * Math.max(0.2, Math.cos(rad(lat))));
  const r = (v: number, s: number) => Math.round(v / s) * s;
  return { lat: Number(r(lat, dLat).toFixed(5)), lng: Number(r(lng, dLng).toFixed(5)) };
}

/** Lunghezza del percorso (somma dei segmenti), in metri. */
export function pathLength(pts: { lat: number; lng: number }[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
  return s;
}

/** Mediana semplice. */
export function median(a: number[]): number {
  if (!a.length) return NaN;
  const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
/** MAD scalata (equivale a una deviazione standard per dati normali). */
export function madScaled(a: number[]): number {
  if (!a.length) return NaN;
  const m = median(a);
  return 1.4826 * median(a.map((x) => Math.abs(x - m)));
}
export function quantile(a: number[], q: number): number {
  if (!a.length) return NaN;
  const s = a.slice().sort((x, y) => x - y);
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/** Proiezione equirettangolare locale per disegnare la mappa SVG senza tile esterni. Restituisce coordinate in 0..w, 0..h. */
export function projector(pts: { lat: number; lng: number }[], w: number, h: number, pad = 18) {
  if (!pts.length) return (_p: { lat: number; lng: number }) => ({ x: w / 2, y: h / 2 });
  const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const k = Math.cos(rad(lat0));
  const xs = pts.map((p) => p.lng * k), ys = pts.map((p) => -p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx = (w - 2 * pad) / Math.max(1e-9, maxX - minX), sy = (h - 2 * pad) / Math.max(1e-9, maxY - minY);
  const s = Math.min(sx, sy);
  const ox = (w - (maxX - minX) * s) / 2, oy = (h - (maxY - minY) * s) / 2;
  return (p: { lat: number; lng: number }) => ({ x: ox + (p.lng * k - minX) * s, y: oy + (-p.lat - minY) * s });
}

/** Metri per pixel della proiezione sopra (per disegnare i raggi). */
export function metersPerUnit(pts: { lat: number; lng: number }[], w: number, h: number, pad = 18): number {
  if (pts.length < 2) return 1;
  const pr = projector(pts, w, h, pad);
  let best = 0, bm = 1;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const a = pr(pts[i]), b = pr(pts[j]);
    const px = Math.hypot(a.x - b.x, a.y - b.y);
    if (px > best) { best = px; bm = dist(pts[i], pts[j]); }
  }
  return best > 0 ? bm / best : 1;
}

export type { GeoPoint };

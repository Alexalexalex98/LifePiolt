/**
 * Clustering dei luoghi: le soste vicine diventano un LUOGO (centro pesato sulla durata, raggio, visite).
 * Greedy deterministico con semi: i luoghi gia' noti restano semi, cosi' gli id e le scelte dell'utente (nome, etichetta confermata)
 * non cambiano quando arrivano nuovi dati. Distanza di aggancio `eps` (m).
 */
import { coarsen, dist, quantile } from './geo.ts';
import type { Place, Stay } from './types.ts';

export const CLUSTER = {
  eps: 100,
  minRadius: 40,
  maxRadius: 250,
};

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

type Acc = { id: string; lat: number; lng: number; stays: Stay[]; seed?: Place };

export function clusterPlaces(stays: Stay[], prev: Place[] = [], opts: { eps?: number; coarsen?: boolean } = {}): { places: Place[]; stays: Stay[] } {
  const eps = opts.eps ?? CLUSTER.eps;
  const accs: Acc[] = prev.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, stays: [], seed: p }));
  const sorted = stays.slice().sort((a, b) => a.start - b.start);
  for (const s of sorted) {
    let best: Acc | null = null, bd = Infinity;
    for (const a of accs) {
      const d = dist(a, s);
      const reach = Math.max(eps, a.seed ? Math.min(a.seed.radius, CLUSTER.maxRadius) : 0);
      if (d <= reach && d < bd) { best = a; bd = d; }
    }
    if (!best) { best = { id: 'p' + hash(`${s.lat.toFixed(4)},${s.lng.toFixed(4)},${s.start}`), lat: s.lat, lng: s.lng, stays: [] }; accs.push(best); }
    best.stays.push(s);
    // il centro segue le soste (pesate sulla durata) ma solo dopo averne qualcuna
    const w = best.stays.map((x) => Math.max(60000, x.end - x.start));
    const sw = w.reduce((a, b) => a + b, 0);
    best.lat = best.stays.reduce((a, x, i) => a + x.lat * w[i], 0) / sw;
    best.lng = best.stays.reduce((a, x, i) => a + x.lng * w[i], 0) / sw;
  }
  // unione dei gruppi i cui centri sono ormai vicini
  const alive = accs.filter((a) => a.stays.length > 0);
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      if (alive[i].stays.length && alive[j].stays.length && dist(alive[i], alive[j]) <= eps * 0.8) {
        const score = (a: Acc) => (a.seed?.name || a.seed?.confirmed ? 1e6 : 0) + a.stays.length;
        const keep = score(alive[i]) >= score(alive[j]) ? alive[i] : alive[j];
        const drop = keep === alive[i] ? alive[j] : alive[i];
        keep.stays.push(...drop.stays); drop.stays = [];
        const w = keep.stays.map((x) => Math.max(60000, x.end - x.start)); const sw = w.reduce((a, b) => a + b, 0);
        keep.lat = keep.stays.reduce((a, x, k) => a + x.lat * w[k], 0) / sw; keep.lng = keep.stays.reduce((a, x, k) => a + x.lng * w[k], 0) / sw;
      }
    }
  }
  const places: Place[] = [];
  const out: Stay[] = [];
  for (const a of alive) {
    if (!a.stays.length) continue;
    const c = opts.coarsen ? coarsen(a.lat, a.lng) : { lat: Number(a.lat.toFixed(6)), lng: Number(a.lng.toFixed(6)) };
    const radius = Math.min(CLUSTER.maxRadius, Math.max(CLUSTER.minRadius, Math.round(quantile(a.stays.map((s) => dist(c, s)), 0.9) + 20)));
    const seed = a.seed;
    places.push({
      id: a.id, lat: c.lat, lng: c.lng, radius, visits: a.stays.length,
      totalMs: a.stays.reduce((s, x) => s + (x.end - x.start), 0),
      first: Math.min(...a.stays.map((s) => s.start)), last: Math.max(...a.stays.map((s) => s.end)),
      ...(seed?.name ? { name: seed.name } : {}), ...(seed?.kind ? { kind: seed.kind } : {}), ...(seed?.confirmed ? { confirmed: true } : {}),
    });
    a.stays.forEach((s) => out.push({ ...s, placeId: a.id }));
  }
  places.sort((x, y) => y.totalMs - x.totalMs);
  out.sort((a, b) => a.start - b.start);
  return { places, stays: out };
}

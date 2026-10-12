/**
 * Pipeline completa e INCREMENTALE: punti grezzi -> filtraggio -> soste -> spostamenti (con mezzo) -> luoghi.
 * `ingest` e' una funzione pura: prende lo stato salvato e nuovi punti e restituisce il nuovo stato. I punti grezzi restano solo
 * finche' la sosta o il tragitto in corso non e' concluso ("coda"); poi si conservano soltanto soste, spostamenti e luoghi.
 */
import { clusterPlaces } from './cluster.ts';
import { filterPoints } from './filter.ts';
import { coarsen, dist } from './geo.ts';
import { relinkTrips } from './routine.ts';
import { detectStays, tripBetween } from './stays.ts';
import { DAY_MS, HOUR_MS, type GeoPoint, type Place, type Stay, type Trip } from './types.ts';

export type Zone = { lat: number; lng: number; r: number };
export type HabitData = { tail: GeoPoint[]; stays: Stay[]; trips: Trip[]; places: Place[]; excluded: Zone[] };
export const emptyData = (): HabitData => ({ tail: [], stays: [], trips: [], places: [], excluded: [] });

export const PIPE = {
  /** coda massima di punti grezzi (oltre, si scartano i piu' vecchi) */
  maxTail: 3000,
  /** quanti punti si conservano di una sosta ancora aperta */
  openKeep: 8,
  /** un "tragitto" senza punti e piu' lungo di cosi' non e' un tragitto (telefono spento, dati mancanti) */
  maxBlindTripMs: 3 * HOUR_MS,
  keepDays: 180,
};

export type IngestOpts = { coarsen?: boolean; keepDays?: number; now?: number };

const inZone = (p: { lat: number; lng: number }, zs: Zone[]) => zs.some((z) => dist(z, p) <= z.r);

function thin(pts: GeoPoint[], keep: number): GeoPoint[] {
  if (pts.length <= keep) return pts;
  const out: GeoPoint[] = [];
  for (let k = 0; k < keep; k++) out.push(pts[Math.round((k * (pts.length - 1)) / (keep - 1))]);
  return out;
}

export function ingest(data: HabitData, incoming: GeoPoint[], opts: IngestOpts = {}): HabitData {
  const fresh = incoming.filter((p) => p && !inZone(p, data.excluded));
  const { points } = filterPoints([...data.tail, ...fresh]);
  const { closed, open } = detectStays(points);

  let stays = data.stays.slice();
  let trips = data.trips.slice();
  let prev: Stay | undefined = stays[stays.length - 1];
  let consumedTo = -1;
  for (const c of closed) {
    // una sosta gia' registrata (stessi estremi) non si ripete
    if (prev && c.start <= prev.end) { consumedTo = Math.max(consumedTo, c.j); continue; }
    let s: Stay = { start: c.start, end: c.end, lat: c.lat, lng: c.lng, n: c.n };
    if (opts.coarsen) { const k = coarsen(s.lat, s.lng); s = { ...s, lat: k.lat, lng: k.lng }; }
    if (prev) {
      const blind = s.start - prev.end;
      const tr = tripBetween(prev, { ...s, lat: c.lat, lng: c.lng }, points);
      if (tr && (tr.samples > 0 || blind <= PIPE.maxBlindTripMs) && blind <= 12 * HOUR_MS) trips.push(tr);
    }
    stays.push(s);
    prev = s;
    consumedTo = Math.max(consumedTo, c.j);
  }
  // coda: tutto cio' che sta dopo l'ultima sosta chiusa; la sosta aperta si riduce a pochi punti
  let tail = points.slice(consumedTo + 1);
  if (open) {
    const idx = tail.findIndex((p) => p.ts >= open.start);
    if (idx >= 0) tail = [...tail.slice(0, idx), ...thin(tail.slice(idx), PIPE.openKeep)];
  }
  if (tail.length > PIPE.maxTail) tail = tail.slice(tail.length - PIPE.maxTail);

  // scadenza dei dati vecchi
  const keep = (opts.keepDays ?? PIPE.keepDays) * DAY_MS;
  const now = opts.now ?? (points.length ? points[points.length - 1].ts : Date.now());
  stays = stays.filter((s) => now - s.end <= keep);
  trips = trips.filter((x) => now - x.end <= keep);

  const cl = clusterPlaces(stays, data.places, { coarsen: opts.coarsen });
  return { tail, stays: cl.stays, trips: relinkTrips(trips, cl.stays), places: cl.places, excluded: data.excluded };
}

/** Elimina un luogo con tutte le sue soste e i tragitti collegati. Con `forget` aggiunge una zona da non registrare piu'. */
export function removePlace(data: HabitData, id: string, forget = false): HabitData {
  const p = data.places.find((x) => x.id === id);
  if (!p) return data;
  const stays = data.stays.filter((s) => s.placeId !== id);
  const trips = data.trips.filter((x) => x.from !== id && x.to !== id);
  const excluded = forget ? [...data.excluded, { lat: p.lat, lng: p.lng, r: Math.max(80, p.radius) }] : data.excluded;
  const tail = forget ? data.tail.filter((q) => !inZone(q, excluded)) : data.tail;
  return { ...data, stays, trips, places: data.places.filter((x) => x.id !== id), excluded, tail };
}

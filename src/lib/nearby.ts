/** Servizi opzionali online (OpenStreetMap: Nominatim, OSRM, Overpass). Ogni funzione fallisce in silenzio: l'app funziona anche offline. */
export type Poi = { name: string; lat: number; lng: number; kind: string; meters: number };

async function getJson(url: string, ms = 6000, init?: RequestInit): Promise<any> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal, headers: { Accept: 'application/json', ...(init?.headers ?? {}) } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(timer); }
}

export async function geocode(q: string): Promise<{ lat: number; lng: number; label: string } | null> {
  if (!q.trim()) return null;
  const j = await getJson(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
  const r = j?.[0];
  return r ? { lat: parseFloat(r.lat), lng: parseFloat(r.lon), label: String(r.display_name ?? q) } : null;
}

/** Minuti in auto (o a piedi/bici) tra due punti, via OSRM pubblico. */
export async function routeMinutes(from: { lat: number; lng: number }, to: { lat: number; lng: number }, mode: 'driving' | 'foot' | 'bike' = 'driving'): Promise<number | null> {
  const j = await getJson(`https://router.project-osrm.org/route/v1/${mode}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`);
  const s = j?.routes?.[0]?.duration;
  return typeof s === 'number' ? Math.round(s / 60) : null;
}

const dist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

/** Luoghi d'interesse attorno a un punto (Overpass). `tags` es. ['amenity=cafe']. */
export async function nearby(center: { lat: number; lng: number }, tags: readonly string[], radius = 600, max = 6): Promise<Poi[]> {
  if (!tags.length) return [];
  const parts = tags.map((tg) => { const [k, v] = tg.split('='); return `nwr["${k}"="${v}"]["name"](around:${radius},${center.lat},${center.lng});`; }).join('');
  const body = `[out:json][timeout:8];(${parts});out center 40;`;
  const j = await getJson('https://overpass-api.de/api/interpreter', 9000, { method: 'POST', body: `data=${encodeURIComponent(body)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  const els: any[] = j?.elements ?? [];
  const seen = new Set<string>();
  return els.map((e) => {
    const lat = e.lat ?? e.center?.lat, lng = e.center?.lon ?? e.lon;
    const kind = Object.entries(e.tags ?? {}).find(([k]) => ['amenity', 'tourism', 'historic', 'leisure', 'shop', 'building'].includes(k))?.[1] as string | undefined;
    return lat != null && lng != null ? { name: String(e.tags?.name ?? ''), lat, lng, kind: kind ?? '', meters: Math.round(dist(center, { lat, lng })) } : null;
  }).filter((p): p is Poi => !!p && !!p.name && !seen.has(p.name) && !!seen.add(p.name)).sort((a, b) => a.meters - b.meters).slice(0, max);
}

export const mapsUrl = (p: { lat: number; lng: number; name?: string }) => `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=18/${p.lat}/${p.lng}`;

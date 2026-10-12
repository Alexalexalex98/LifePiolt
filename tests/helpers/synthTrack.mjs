// Generatore di tracce GPS sintetiche e realistiche per i test delle abitudini. Deterministico (seed).
// Vita tipica: casa -> lavoro (auto, il mercoledi' in bici), giovedi' palestra a piedi alle 18:30, sabato spesa a piedi,
// domenica dalla mamma con i mezzi (fermate regolari). Rumore GPS, punti con accuratezza pessima e salti, una settimana di ferie
// lontano da casa e un giorno anomalo (mercoledi' della settimana 3: a casa tutto il giorno).
export function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const LAT0 = 46.0037, LNG0 = 8.9511; // Lugano
const mLat = 111320, mLng = 111320 * Math.cos((LAT0 * Math.PI) / 180);
export const toGeo = (x, y) => ({ lat: LAT0 + y / mLat, lng: LNG0 + x / mLng });

// posizioni vere (metri dal punto 0 = casa)
export const PLACES = {
  casa: { x: 0, y: 0 },
  lavoro: { x: 4200, y: 3100 },
  palestra: { x: -900, y: 1200 },
  spesa: { x: 350, y: -380 },
  mamma: { x: -9000, y: 8200 },
  hotel: { x: 140000, y: 180000 },
  spiaggia: { x: 140400, y: 180300 },
};

export function makeLife({ seed = 7, weeks = 6, vacationWeek = 4, anomalyWeek = 3, sampling = 'continuous', noise = 1, startDate = [2026, 2, 2], sparseOnly = false } = {}) {
  const r = rng(seed);
  const gauss = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const points = [];
  const truth = { trips: [], days: [], places: PLACES };

  const emitPoint = (t, x, y, force) => {
    let nx = gauss() * 6 * noise, ny = gauss() * 6 * noise, acc = 5 + r() * 10;
    const q = r();
    if (!force && q < 0.04) { nx = gauss() * 150; ny = gauss() * 150; acc = 150 + r() * 250; }      // fix pessimo, accuratezza dichiarata scarsa
    else if (!force && q < 0.05) { nx += (r() < 0.5 ? -1 : 1) * (2500 + r() * 3000); ny += (r() - 0.5) * 4000; acc = 12; } // salto non dichiarato
    const g = toGeo(x + nx, y + ny);
    points.push({ ts: t, lat: g.lat, lng: g.lng, accuracy: Math.round(acc), speed: null });
  };

  // movimento lungo una poligonale (con una curva) con profilo di velocita' per mezzo
  function move(from, to, mode, t0) {
    const dx = to.x - from.x, dy = to.y - from.y, L = Math.hypot(dx, dy);
    const bend = 0.18 * L * (r() - 0.5);
    const mid = { x: (from.x + to.x) / 2 - (dy / L) * bend, y: (from.y + to.y) / 2 + (dx / L) * bend };
    const path = [from, mid, to];
    const segL = [Math.hypot(mid.x - from.x, mid.y - from.y), Math.hypot(to.x - mid.x, to.y - mid.y)];
    const total = segL[0] + segL[1];
    const posAt = (s) => { if (s <= segL[0]) { const k = s / segL[0]; return { x: from.x + (mid.x - from.x) * k, y: from.y + (mid.y - from.y) * k }; } const k = Math.min(1, (s - segL[0]) / segL[1]); return { x: mid.x + (to.x - mid.x) * k, y: mid.y + (to.y - mid.y) * k }; };
    const stops = [];
    if (mode === 'mezzi') { for (let s = 520 + r() * 80; s < total - 300; s += 560 + r() * 60) stops.push({ s, dwell: 22 + r() * 18 }); }
    if (mode === 'auto') { const n = 2 + Math.floor(r() * 3); for (let k = 0; k < n; k++) stops.push({ s: 400 + r() * (total - 800), dwell: 15 + r() * 40 }); stops.sort((a, b) => a.s - b.s); }
    const base = { piedi: 1.4, bici: 5.2, auto: 12.5, mezzi: 9 }[mode];
    let s = 0, t = t0, dwell = 0, si = 0, last = { ...from, t: t0 };
    emitPoint(t0, from.x, from.y, true);
    let curV = base;
    while (s < total) {
      t += 1;
      if (dwell > 0) { dwell--; continue; }
      if (t % 7 === 0) curV = base * (0.8 + r() * 0.4);
      s += curV;
      if (si < stops.length && s >= stops[si].s) { dwell = Math.round(stops[si].dwell); si++; }
      const p = posAt(Math.min(s, total));
      if (Math.hypot(p.x - last.x, p.y - last.y) >= 25 && t - last.t >= 5) { emitPoint(t * 1000 === 0 ? t : t, p.x, p.y); last = { ...p, t }; }
    }
    emitPoint(t, to.x, to.y, true);
    return t;
  }

  // il tempo e' in secondi nel generatore, ms nei punti
  const msPoints = () => points.forEach((p) => { p.ts = p.ts * 1000; });

  let stationarySince = null; // per i battiti da fermo
  function stay(place, t0, t1) {
    if (sparseOnly) return;
    // battito ogni ~20 min con piccolo scarto (e a volte un fix a 40-60 m)
    for (let t = t0 + 60; t < t1; t += 1200 + r() * 600) emitPoint(t, place.x + (r() < 0.03 ? 45 : 0), place.y);
  }

  const dayStart = (d) => new Date(startDate[0], startDate[1], startDate[2] + d, 0, 0, 0, 0).getTime() / 1000;
  const at = (d, h, m = 0, jitter = 0) => dayStart(d) + (h * 60 + m + Math.round(gauss() * jitter)) * 60;

  let cur = { ...PLACES.casa }; let curName = 'casa';
  let tNow = dayStart(0);
  const totalDays = weeks * 7;
  for (let d = 0; d < totalDays; d++) {
    const date = new Date(dayStart(d) * 1000);
    const wd = date.getDay();
    const week = Math.floor(d / 7);
    const dayRec = { d, wd, kind: 'normale', events: [] };
    truth.days.push(dayRec);
    const goTo = (name, mode, depart) => {
      const dest = PLACES[name];
      const t0 = Math.max(depart, tNow);
      const t = move(cur, dest, mode, t0);
      truth.trips.push({ d, from: curName, to: name, mode, start: t0, end: t });
      cur = { ...dest }; curName = name; tNow = t;
    };
    const waitUntil = (t) => { stay(cur, tNow, t); tNow = t; };

    if (week === vacationWeek) {
      dayRec.kind = 'ferie';
      if (d % 7 === 0) { goTo('hotel', 'auto', at(d, 8, 0, 5)); }
      else if (d % 7 === 6) { waitUntil(at(d, 14, 0)); goTo('casa', 'auto', at(d, 14, 30)); waitUntil(at(d, 23, 59)); }
      else { waitUntil(at(d, 10, 0)); goTo('spiaggia', 'piedi', at(d, 10, 0)); waitUntil(at(d, 13, 0)); goTo('hotel', 'piedi', at(d, 13, 0)); waitUntil(at(d, 23, 59)); }
      continue;
    }
    if (week === anomalyWeek && wd === 3) { dayRec.kind = 'anomalo'; waitUntil(at(d, 23, 59)); continue; }

    if (wd >= 1 && wd <= 5) {
      const leave = at(d, 7, 40, 8);
      waitUntil(leave);
      goTo('lavoro', wd === 3 ? 'bici' : 'auto', leave);
      const out = at(d, 17, 30, 10);
      waitUntil(out);
      goTo('casa', wd === 3 ? 'bici' : 'auto', out);
      if (wd === 4) {
        const g = at(d, 18, 15, 5);
        waitUntil(g);
        goTo('palestra', 'piedi', g);
        waitUntil(tNow + 75 * 60);
        goTo('casa', 'piedi', tNow);
      }
    } else if (wd === 6) {
      const s = at(d, 10, 30, 15);
      waitUntil(s);
      goTo('spesa', 'piedi', s);
      waitUntil(tNow + 35 * 60);
      goTo('casa', 'piedi', tNow);
    } else if (wd === 0) {
      const s = at(d, 11, 45, 10);
      waitUntil(s);
      goTo('mamma', 'mezzi', s);
      waitUntil(at(d, 16, 30, 10));
      goTo('casa', 'mezzi', tNow);
    }
    waitUntil(at(d, 23, 59));
  }
  msPoints();
  let out = points.sort((a, b) => a.ts - b.ts);
  if (sampling === 'sparse') {
    // solo quando apro l'app: 4-6 campioni al giorno in orari "da telefono in mano", posizione presa dalla traccia piu' vicina
    const rr = rng(seed + 99);
    const exact = out.filter((p) => p.accuracy <= 20);
    const sparse = [];
    for (let d = 0; d < totalDays; d++) {
      const ds = dayStart(d) * 1000;
      const n = 4 + Math.floor(rr() * 3);
      for (let k = 0; k < n; k++) {
        const t = ds + (7 * 60 + rr() * 15 * 60) * 60000; // 07:00-22:00
        const near = exact.reduce((b, p) => (Math.abs(p.ts - t) < Math.abs(b.ts - t) ? p : b), exact[0]);
        sparse.push({ ...near, ts: Math.round(t) });
      }
    }
    out = sparse.sort((a, b) => a.ts - b.ts);
  }
  return { points: out, truth };
}

/** Prime `days` giorni della traccia (taglio per timestamp). */
export function firstDays(points, days, startDate = [2026, 2, 2]) {
  const cut = new Date(startDate[0], startDate[1], startDate[2] + days, 0, 0, 0, 0).getTime();
  return points.filter((p) => p.ts < cut);
}

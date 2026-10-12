/**
 * Mezzo di trasporto da velocita' e interruzioni del tragitto. Euristica DICHIARATA (nessun modello opaco):
 *
 *  - a piedi: velocita' in movimento (mediana) 0,6-2,3 m/s (2-8 km/h) e 90o percentile <= 3,6 m/s (corsa lenta inclusa);
 *  - bici: mediana 2,3-7,5 m/s (8-27 km/h), 90o percentile <= 11 m/s, poche soste (< 20% del tempo);
 *  - mezzi: mediana 3-25 m/s con almeno 3 soste brevi (15-300 s) distanziate in modo regolare (fermate), oppure velocita' di crociera > 40 m/s (treno veloce);
 *  - auto: mediana > 7,5 m/s con soste irregolari o assenti;
 *  - sconosciuto: meno di 4 campioni di velocita' utili, o segnali in contrasto (es. auto e mezzi con punteggi vicini).
 * La confidenza e' alta solo se il tragitto e' lungo e i segnali sono netti. Auto e mezzi si confondono facilmente: se incerto, "sconosciuto".
 */
import { dist, median, quantile } from './geo.ts';
import type { Confidence, GeoPoint, Mode } from './types.ts';

export const MODE = {
  minSpeedSamples: 4,
  moving: 0.5,
  maxSegDt: 120,
  walkMedian: [0.6, 2.3] as [number, number],
  walkP90: 3.6,
  bikeMedian: [2.3, 7.5] as [number, number],
  bikeP90: 11,
  bikeMaxStopFrac: 0.2,
  stopEpisode: [15, 300] as [number, number],
  transitMinStops: 3,
  transitMedian: [3, 25] as [number, number],
  trainCruise: 40,
  carMedian: 7.5,
  stopSpacingCv: 0.45,
};

export type ModeResult = { mode: Mode; confidence: Confidence; why: string; speedMed?: number; speedP90?: number; stops?: number };

export function classifyMode(path: GeoPoint[], ctx: { distM: number; durMs: number; samples?: number }): ModeResult {
  const M = MODE;
  const speeds: number[] = [];
  const segs: { dt: number; v: number; mid: GeoPoint }[] = [];
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1], b = path[k];
    const dt = (b.ts - a.ts) / 1000;
    if (dt < 1 || dt > M.maxSegDt) continue;
    const dev = b.speed != null && Number.isFinite(b.speed) ? b.speed : null;
    const v = dev != null ? (dev + dist(a, b) / dt) / 2 : dist(a, b) / dt;
    speeds.push(v);
    segs.push({ dt, v, mid: b });
  }
  if (speeds.length < M.minSpeedSamples) return { mode: 'sconosciuto', confidence: 'bassa', why: 'pochi punti lungo il tragitto' };
  const movingV = speeds.filter((v) => v > M.moving);
  if (movingV.length < 3) return { mode: 'sconosciuto', confidence: 'bassa', why: 'quasi fermo' };
  const vm = median(movingV), v90 = quantile(movingV, 0.9);
  const totalT = segs.reduce((s, x) => s + x.dt, 0);
  const stopT = segs.filter((x) => x.v <= M.moving).reduce((s, x) => s + x.dt, 0);
  const stopFrac = totalT ? stopT / totalT : 0;

  // episodi di sosta brevi (fermate, semafori) e loro distanza lungo il percorso
  const stops: number[] = []; // posizione cumulata (m) dell'inizio di ogni sosta
  let cum = 0, run = 0, runStart = 0;
  for (const s of segs) {
    if (s.v <= M.moving) { if (!run) runStart = cum; run += s.dt; }
    else {
      if (run >= M.stopEpisode[0] && run <= M.stopEpisode[1]) stops.push(runStart);
      run = 0;
    }
    cum += s.v * s.dt;
  }
  if (run >= M.stopEpisode[0] && run <= M.stopEpisode[1]) stops.push(runStart);
  let spacingCv = Infinity;
  if (stops.length >= 3) {
    const gaps = stops.slice(1).map((x, i) => x - stops[i]);
    const m = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - m) ** 2, 0) / gaps.length);
    spacingCv = m ? sd / m : Infinity;
  }
  const long = ctx.distM >= 1500 && speeds.length >= 20;
  const res = (mode: Mode, confidence: Confidence, why: string): ModeResult => ({ mode, confidence, why, speedMed: vm, speedP90: v90, stops: stops.length });

  if (vm >= M.walkMedian[0] && vm <= M.walkMedian[1] && v90 <= M.walkP90) {
    return res('piedi', vm >= 1 && vm <= 1.9 && v90 <= 2.8 && speeds.length >= 8 ? 'alta' : 'media', 'velocita\' da passo');
  }
  if (vm > M.walkMedian[1] && vm <= M.bikeMedian[1] && v90 <= M.bikeP90 && stopFrac < M.bikeMaxStopFrac && stops.length < M.transitMinStops) {
    return res('bici', long && vm >= 3.5 ? 'media' : 'bassa', 'velocita\' costante da bici');
  }
  if (vm >= M.trainCruise) return res('mezzi', 'media', 'velocita\' di crociera da treno veloce');
  const transit = stops.length >= M.transitMinStops && spacingCv <= M.stopSpacingCv && vm >= M.transitMedian[0] && vm <= M.transitMedian[1];
  if (transit) return res('mezzi', long ? 'media' : 'bassa', 'fermate regolari');
  if (vm > M.carMedian) {
    // soste irregolari o assenti = auto; molte soste di forma incerta = non lo so
    if (stops.length >= M.transitMinStops && spacingCv <= M.stopSpacingCv * 1.6) return res('sconosciuto', 'bassa', 'auto o mezzi pubblici: segnali in contrasto');
    return res('auto', long && v90 >= 11 ? 'media' : 'bassa', 'velocita\' da veicolo, soste irregolari');
  }
  return res('sconosciuto', 'bassa', 'velocita\' in una zona di confine');
}

export const MODE_LABEL: Record<Mode, string> = { piedi: 'a piedi', bici: 'in bici', auto: 'in auto', mezzi: 'con i mezzi', sconosciuto: 'mezzo non chiaro' };

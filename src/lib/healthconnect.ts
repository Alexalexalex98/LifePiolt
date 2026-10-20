import { Platform } from 'react-native';

import { dayKey } from '@/lib/format';
import { perDay, sleepHours } from '@/lib/healthDaily';
import { useHealth, type Pt, type Workout } from '@/store/health';

/**
 * Collegamento a Health Connect di Android: qui arrivano i dati del Galaxy Watch (Samsung Health li scrive in Health Connect),
 * di Pixel Watch, Garmin, Fitbit, Oura e delle altre app di salute. Funziona solo in una build nativa Android (non in Expo Go).
 * Se il modulo non c'è, tutte le funzioni restituiscono un messaggio chiaro senza rompere l'app.
 */
export const HEALTH_CONNECT = 'Health Connect';
type SyncResult = { ok: boolean; message: string; counts?: Record<string, number> };

type HC = typeof import('react-native-health-connect');
let HC: HC | null = null;
if (Platform.OS === 'android') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    HC = require('react-native-health-connect') as HC;
  } catch { HC = null; }
}

const DAY = 86400000;
const TYPES = ['Steps', 'Distance', 'FloorsClimbed', 'ActiveCaloriesBurned', 'TotalCaloriesBurned', 'HeartRate', 'RestingHeartRate', 'HeartRateVariabilityRmssd', 'Weight', 'BodyFat', 'SleepSession', 'ExerciseSession', 'Vo2Max', 'OxygenSaturation', 'RespiratoryRate'] as const;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const iso = (d: Date | number) => new Date(d).toISOString();
const round1 = (n: number) => Math.round(n * 10) / 10;

const EX_NAMES: Record<string, string> = {
  RUNNING: 'Corsa', RUNNING_TREADMILL: 'Corsa', WALKING: 'Camminata', BIKING: 'Ciclismo', BIKING_STATIONARY: 'Ciclismo', SWIMMING_POOL: 'Nuoto', SWIMMING_OPEN_WATER: 'Nuoto', YOGA: 'Yoga', HIKING: 'Escursione',
  STRENGTH_TRAINING: 'Palestra', WEIGHTLIFTING: 'Palestra', HIGH_INTENSITY_INTERVAL_TRAINING: 'HIIT', ELLIPTICAL: 'Ellittica', ROWING: 'Canottaggio', ROWING_MACHINE: 'Canottaggio', PILATES: 'Pilates', DANCING: 'Danza',
  TENNIS: 'Tennis', FOOTBALL_SOCCER: 'Calcio', CALISTHENICS: 'Corpo libero', STRETCHING: 'Stretching', OTHER_WORKOUT: 'Allenamento',
};

export async function hcState(): Promise<'unsupported' | 'unavailable' | 'update' | 'ready'> {
  if (!HC) return 'unsupported';
  try {
    const s = await HC.getSdkStatus();
    if (s === HC.SdkAvailabilityStatus.SDK_AVAILABLE) return 'ready';
    return s === HC.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ? 'update' : 'unavailable';
  } catch { return 'unsupported'; }
}

async function readAll(type: (typeof TYPES)[number], from: Date, to: Date): Promise<Record<string, unknown>[]> {
  if (!HC) return [];
  const out: Record<string, unknown>[] = [];
  let token: string | undefined;
  for (let i = 0; i < 30; i++) {
    const r = await HC.readRecords(type as never, { timeRangeFilter: { operator: 'between', startTime: iso(from), endTime: iso(to) }, pageSize: 1000, ...(token ? { pageToken: token } : {}) } as never) as unknown as { records: Record<string, unknown>[]; pageToken?: string };
    out.push(...r.records);
    if (!r.pageToken) break;
    token = r.pageToken;
  }
  return out;
}
/** Somma o media al giorno calcolata da Health Connect (più veloce e senza doppioni tra più app). */
async function aggregate(type: string, pick: (r: Record<string, unknown>) => number | undefined, from: Date, to: Date): Promise<Pt[]> {
  if (!HC) return [];
  const rows = await HC.aggregateGroupByPeriod({ recordType: type, timeRangeFilter: { operator: 'between', startTime: iso(from), endTime: iso(to) }, timeRangeSlicer: { period: 'DAYS', length: 1 } } as never) as unknown as { startTime: string; result: Record<string, unknown> }[];
  const out: Pt[] = [];
  rows.forEach((r) => { const v = pick(r.result); if (v != null && Number.isFinite(v)) out.push({ d: dayKey(new Date(r.startTime)), v }); });
  return out;
}
const num = (x: unknown) => (typeof x === 'number' ? x : undefined);
const inner = (x: unknown, k: string) => num((x as Record<string, unknown> | undefined)?.[k]);

export async function requestHealthConnect(): Promise<boolean> {
  if (!HC) return false;
  try {
    await HC.initialize();
    const granted = await HC.requestPermission(TYPES.map((recordType) => ({ accessType: 'read' as const, recordType })) as never);
    return (granted as unknown[]).length > 0;
  } catch { return false; }
}

let inFlight: Promise<SyncResult> | null = null;
export function syncHealthConnect(days = 30): Promise<SyncResult> {
  if (inFlight) return inFlight;
  inFlight = syncInner(days).catch((e): SyncResult => ({ ok: false, message: 'Errore nella lettura da Health Connect: ' + (e instanceof Error ? e.message : String(e)) })).finally(() => { inFlight = null; });
  return inFlight;
}

async function syncInner(days: number): Promise<SyncResult> {
  const st = await hcState();
  if (st === 'unsupported') return { ok: false, message: 'Health Connect richiede la versione installata (non Expo Go). Puoi registrare i dati a mano.' };
  if (st === 'update') return { ok: false, message: 'Aggiorna Health Connect dal Play Store e riprova.' };
  if (st === 'unavailable') return { ok: false, message: 'Questo telefono non ha Health Connect.' };
  await HC!.initialize();
  const store = useHealth.getState();
  const to = new Date(), from = startOfDay(new Date(to.getTime() - days * DAY));
  const safe = <T,>(p: Promise<T>, d: T): Promise<T> => p.catch(() => d);
  const [steps, dist, floors, energy, hrAvg, rhr, hrv, weight, fat, sleepRecs, exRecs, vo2, spo2, resp] = await Promise.all([
    safe(aggregate('Steps', (r) => num(r.COUNT_TOTAL), from, to), [] as Pt[]),
    safe(aggregate('Distance', (r) => { const m = inner(r.DISTANCE, 'inMeters'); return m != null ? m / 1000 : undefined; }, from, to), [] as Pt[]),
    safe(aggregate('FloorsClimbed', (r) => num(r.FLOORS_CLIMBED_TOTAL), from, to), [] as Pt[]),
    safe(aggregate('ActiveCaloriesBurned', (r) => inner(r.ACTIVE_CALORIES_TOTAL, 'inKilocalories'), from, to), [] as Pt[]),
    safe(aggregate('HeartRate', (r) => num(r.BPM_AVG), from, to), [] as Pt[]),
    safe(readAll('RestingHeartRate', from, to), []),
    safe(readAll('HeartRateVariabilityRmssd', from, to), []),
    safe(readAll('Weight', from, to), []),
    safe(readAll('BodyFat', from, to), []),
    safe(readAll('SleepSession', from, to), []),
    safe(readAll('ExerciseSession', from, to), []),
    safe(readAll('Vo2Max', from, to), []),
    safe(readAll('OxygenSaturation', from, to), []),
    safe(readAll('RespiratoryRate', from, to), []),
  ]);
  const t = (r: Record<string, unknown>) => String(r.time ?? r.startTime);
  const series = (rows: Record<string, unknown>[], f: (r: Record<string, unknown>) => number | undefined, how: 'avg' | 'last'): Pt[] => perDay(rows.flatMap((r) => { const v = f(r); return v == null ? [] : [{ t: t(r), v }]; }), how);
  const hrPts = series(rhr, (r) => num(r.beatsPerMinute), 'avg');
  const hrvPts = series(hrv, (r) => num(r.heartRateVariabilityMillis), 'avg');
  const weightPts = series(weight, (r) => inner(r.weight, 'inKilograms'), 'last').map((p) => ({ d: p.d, v: round1(p.v) }));
  const sleep = sleepHours(sleepRecs.map((r) => ({ start: new Date(String(r.startTime)).getTime(), end: new Date(String(r.endTime)).getTime() })));
  const exMin = perDay(exRecs.map((r) => ({ t: String(r.startTime), v: (new Date(String(r.endTime)).getTime() - new Date(String(r.startTime)).getTime()) / 60000 })), 'sum');
  const put = (m: Parameters<typeof store.setPoints>[0], pts: Pt[]) => { if (pts.length) store.setPoints(m, pts, 'hc'); };
  put('steps', steps.filter((p) => p.v > 0)); put('energy', energy.filter((p) => p.v > 0).map((p) => ({ d: p.d, v: Math.round(p.v) })));
  put('hr', hrPts); put('hrv', hrvPts); put('weight', weightPts); put('sleep', sleep); put('exercise', exMin.map((p) => ({ d: p.d, v: Math.round(p.v) })));
  put('vo2', series(vo2, (r) => num(r.vo2MillilitersPerMinuteKilogram), 'last'));
  put('spo2', series(spo2, (r) => { const v = inner(r.percentage, 'value') ?? num(r.percentage); return v == null ? undefined : v <= 1 ? v * 100 : v; }, 'avg'));
  const stress = hrvPts.length >= 5 ? estimateStress(hrvPts, hrPts) : [];
  if (stress.length) store.setPoints('stress', stress, 'stimato');
  const x = (k: Parameters<typeof store.setExtra>[0], pts: Pt[]) => { if (pts.length) store.setExtra(k, pts); };
  x('distance', dist.filter((p) => p.v > 0).map((p) => ({ d: p.d, v: round1(p.v) }))); x('flights', floors.filter((p) => p.v > 0)); x('hravg', hrAvg.map((p) => ({ d: p.d, v: Math.round(p.v) })));
  x('resp', series(resp, (r) => num(r.rate), 'avg').map((p) => ({ d: p.d, v: round1(p.v) })));
  x('fat', series(fat, (r) => num(r.percentage), 'last').map((p) => ({ d: p.d, v: round1(p.v) })));
  const names = EX_NAMES;
  const ws: Workout[] = exRecs.map((r) => {
    const d = new Date(String(r.startTime));
    const key = Object.entries(HC!.ExerciseType as Record<string, number>).find(([, v]) => v === r.exerciseType)?.[0] ?? 'OTHER_WORKOUT';
    return { id: 'hc-' + String(r.metadata && (r.metadata as Record<string, unknown>).id || d.getTime()), type: String(r.title || names[key] || 'Allenamento'), date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, duration: Math.round((new Date(String(r.endTime)).getTime() - d.getTime()) / 60000), calories: 0, source: 'hc' as const };
  }).slice(0, 200);
  if (ws.length) store.mergeWorkouts(ws);
  store.connect(HEALTH_CONNECT); store.setSync(Date.now(), null);
  const counts = { passi: steps.length, battito: hrPts.length, hrv: hrvPts.length, sonno: sleep.length, peso: weightPts.length, allenamenti: ws.length };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { ok: true, counts, message: total ? `Sincronizzato: ${steps.length} giorni di passi, ${sleep.length} notti di sonno, ${hrvPts.length} misure HRV, ${ws.length} allenamenti.` : 'Nessun dato letto. In Samsung Health attiva la sincronizzazione con Health Connect, poi in Health Connect consenti a LifePilot le categorie.' };
}

const median = (a: number[]) => { const s = a.slice().sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
/** Stesso indice di stress STIMATO usato per Apple Health: HRV più bassa e battito più alto del tuo solito = più stress. Non è una misura clinica. */
function estimateStress(hrv: Pt[], hr: Pt[]): Pt[] {
  const bh = median(hrv.map((p) => p.v)), mad = median(hrv.map((p) => Math.abs(p.v - bh))) || bh * 0.15 || 1;
  const bhr = median(hr.map((p) => p.v)), madHr = median(hr.map((p) => Math.abs(p.v - bhr))) || 2;
  const hrMap = new Map(hr.map((p) => [p.d, p.v]));
  return hrv.map((p) => { const zH = (p.v - bh) / (1.4826 * mad); const h = hrMap.get(p.d); const zR = h != null ? (h - bhr) / (1.4826 * madHr) : 0; return { d: p.d, v: Math.max(0, Math.min(100, Math.round(50 - 15 * zH + 8 * zR))) }; });
}

export async function connectHealthConnect(): Promise<SyncResult> {
  const st = await hcState();
  if (st !== 'ready') return syncHealthConnect();
  if (!(await requestHealthConnect())) return { ok: false, message: 'Permesso non concesso. Puoi attivarlo da Health Connect > Accesso alle app > LifePilot.' };
  return syncHealthConnect(30);
}

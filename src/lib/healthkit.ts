import { Platform } from 'react-native';

import { dayKey } from '@/lib/format';
import { useHealth, type Pt, type Workout } from '@/store/health';

/**
 * Collegamento reale ad Apple Health (e quindi ad Apple Watch: l'orologio scrive i suoi dati in Salute sull'iPhone).
 * Funziona SOLO in una build nativa (development build / TestFlight / App Store), non in Expo Go né su Android.
 * Quando il modulo nativo non c'è, tutte le funzioni restituiscono "non disponibile" senza rompere l'app.
 */

type HK = typeof import('@kingstinct/react-native-healthkit');
let HK: HK | null = null;
if (Platform.OS === 'ios') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    HK = require('@kingstinct/react-native-healthkit') as HK;
  } catch {
    HK = null;
  }
}

const DAY = 86400000;
const QTY = {
  steps: 'HKQuantityTypeIdentifierStepCount',
  hr: 'HKQuantityTypeIdentifierRestingHeartRate',
  hrv: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  weight: 'HKQuantityTypeIdentifierBodyMass',
  energy: 'HKQuantityTypeIdentifierActiveEnergyBurned',
  exercise: 'HKQuantityTypeIdentifierAppleExerciseTime',
  vo2: 'HKQuantityTypeIdentifierVO2Max',
  spo2: 'HKQuantityTypeIdentifierOxygenSaturation',
} as const;
const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis' as const;
const MINDFUL = 'HKCategoryTypeIdentifierMindfulSession' as const;

export const HK_UNAVAILABLE_MSG = 'Apple Health richiede la versione installata con Xcode, in Expo Go non è disponibile. Puoi registrare i dati a mano.';

export type HkState = 'unsupported' | 'unavailable' | 'ready';

/** 'unsupported' = non iOS o modulo nativo assente (Expo Go); 'unavailable' = dispositivo senza HealthKit (es. iPad vecchi). */
export async function hkState(): Promise<HkState> {
  if (!HK) return 'unsupported';
  try {
    return (await HK.isHealthDataAvailableAsync()) ? 'ready' : 'unavailable';
  } catch {
    return 'unsupported';
  }
}

export async function requestAppleHealth(): Promise<boolean> {
  if (!HK) return false;
  try {
    return await HK.requestAuthorization({
      toRead: [...Object.values(QTY), SLEEP, MINDFUL, 'HKWorkoutTypeIdentifier'],
    });
  } catch {
    return false;
  }
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Una statistica al giorno (somma o media) per gli ultimi `days` giorni. */
async function daily(id: keyof typeof QTY, stat: 'cumulativeSum' | 'discreteAverage', unit: string, days: number): Promise<Pt[]> {
  if (!HK) return [];
  const end = new Date();
  const anchor = startOfDay(new Date(end.getTime() - days * DAY));
  const res = await HK.queryStatisticsCollectionForQuantity(QTY[id] as never, [stat], anchor, { day: 1 }, {
    filter: { date: { startDate: anchor, endDate: end } },
    unit: unit as never,
  });
  const out: Pt[] = [];
  res.forEach((r) => {
    const q = stat === 'cumulativeSum' ? r.sumQuantity : r.averageQuantity;
    if (q && r.startDate) out.push({ d: dayKey(new Date(r.startDate)), v: q.quantity });
  });
  return out;
}

/** Notti di sonno: unisce gli intervalli "addormentato" (così iPhone + Watch non si sommano due volte). */
async function sleepNights(days: number): Promise<Pt[]> {
  if (!HK) return [];
  const end = new Date();
  const start = startOfDay(new Date(end.getTime() - days * DAY));
  const samples = await HK.queryCategorySamples(SLEEP, { filter: { date: { startDate: start, endDate: end } }, limit: -1, ascending: true });
  const asleep = new Set<number>([1, 3, 4, 5]); // asleepUnspecified, core, deep, REM
  const perNight = new Map<string, [number, number][]>();
  samples.forEach((s) => {
    if (!asleep.has(Number(s.value))) return;
    const from = new Date(s.startDate).getTime(), to = new Date(s.endDate).getTime();
    // la notte appartiene al giorno del risveglio
    const key = dayKey(new Date(to));
    const list = perNight.get(key) ?? [];
    list.push([from, to]);
    perNight.set(key, list);
  });
  const out: Pt[] = [];
  perNight.forEach((iv, d) => {
    iv.sort((a, b) => a[0] - b[0]);
    let total = 0, curS = iv[0][0], curE = iv[0][1];
    for (let i = 1; i < iv.length; i++) {
      if (iv[i][0] <= curE) curE = Math.max(curE, iv[i][1]);
      else { total += curE - curS; curS = iv[i][0]; curE = iv[i][1]; }
    }
    total += curE - curS;
    const hours = total / 3600000;
    if (hours >= 1 && hours <= 16) out.push({ d, v: Math.round(hours * 100) / 100 });
  });
  return out.sort((a, b) => a.d.localeCompare(b.d));
}

async function mindfulDaily(days: number): Promise<Pt[]> {
  if (!HK) return [];
  const end = new Date();
  const start = startOfDay(new Date(end.getTime() - days * DAY));
  const samples = await HK.queryCategorySamples(MINDFUL, { filter: { date: { startDate: start, endDate: end } }, limit: -1, ascending: true });
  const map = new Map<string, number>();
  samples.forEach((s) => {
    const min = (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000;
    const d = dayKey(new Date(s.startDate));
    map.set(d, (map.get(d) ?? 0) + min);
  });
  return [...map.entries()].map(([d, v]) => ({ d, v: Math.round(v) })).sort((a, b) => a.d.localeCompare(b.d));
}

const workoutNames: Record<string, string> = {
  running: 'Corsa', walking: 'Camminata', cycling: 'Ciclismo', swimming: 'Nuoto', yoga: 'Yoga', hiking: 'Escursione',
  functionalStrengthTraining: 'Forza', traditionalStrengthTraining: 'Palestra', highIntensityIntervalTraining: 'HIIT',
  elliptical: 'Ellittica', rowing: 'Canottaggio', pilates: 'Pilates', dance: 'Danza', tennis: 'Tennis', soccer: 'Calcio',
  coreTraining: 'Core', mindAndBody: 'Mente e corpo', other: 'Allenamento',
};

async function workouts(days: number): Promise<Workout[]> {
  if (!HK) return [];
  const end = new Date();
  const start = startOfDay(new Date(end.getTime() - days * DAY));
  const list = await HK.queryWorkoutSamples({ filter: { date: { startDate: start, endDate: end } }, limit: 200, ascending: false });
  return list.map((w) => {
    const raw = (HK as unknown as { WorkoutActivityType?: Record<number, string> }).WorkoutActivityType?.[Number(w.workoutActivityType)] ?? 'other';
    const d = new Date(w.startDate);
    return {
      id: 'hk-' + String(w.uuid ?? d.getTime()),
      type: workoutNames[raw] ?? raw,
      date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      duration: Math.round((w.duration?.quantity ?? 0) / (w.duration?.unit === 's' ? 60 : 1)),
      calories: Math.round(w.totalEnergyBurned?.quantity ?? 0),
      source: 'apple' as const,
    };
  });
}

const median = (a: number[]) => { const s = a.slice().sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };

/** Indice di stress STIMATO: HRV più bassa e battito a riposo più alto del tuo solito = più stress. Non è una misura clinica. */
function estimateStress(hrv: Pt[], hr: Pt[]): Pt[] {
  if (hrv.length < 5) return [];
  const bh = median(hrv.map((p) => p.v)), mad = median(hrv.map((p) => Math.abs(p.v - bh))) || bh * 0.15 || 1;
  const bhr = median(hr.map((p) => p.v)), madHr = median(hr.map((p) => Math.abs(p.v - bhr))) || 2;
  const hrMap = new Map(hr.map((p) => [p.d, p.v]));
  return hrv.map((p) => {
    const zH = (p.v - bh) / (1.4826 * mad);
    const h = hrMap.get(p.d);
    const zR = h != null ? (h - bhr) / (1.4826 * madHr) : 0;
    return { d: p.d, v: Math.max(0, Math.min(100, Math.round(50 - 15 * zH + 8 * zR))) };
  });
}

export type SyncResult = { ok: boolean; message: string; counts?: Record<string, number> };

/** Scarica gli ultimi `days` giorni da Salute e li salva nello stato dell'app. */
export async function syncAppleHealth(days = 60): Promise<SyncResult> {
  const st = await hkState();
  if (st === 'unsupported') return { ok: false, message: HK_UNAVAILABLE_MSG };
  if (st === 'unavailable') return { ok: false, message: 'Questo dispositivo non supporta Apple Health.' };
  const store = useHealth.getState();
  try {
    const [steps, hr, hrv, weight, energy, exercise, vo2, spo2, sleep, mindful, w] = await Promise.all([
      daily('steps', 'cumulativeSum', 'count', days),
      daily('hr', 'discreteAverage', 'count/min', days),
      daily('hrv', 'discreteAverage', 'ms', days),
      daily('weight', 'discreteAverage', 'kg', days),
      daily('energy', 'cumulativeSum', 'kcal', days),
      daily('exercise', 'cumulativeSum', 'min', days),
      daily('vo2', 'discreteAverage', 'ml/(kg*min)', days),
      daily('spo2', 'discreteAverage', '%', days),
      sleepNights(days),
      mindfulDaily(days),
      workouts(days),
    ]);
    // la giornata di oggi è parziale per i totali: la teniamo (serve vedere i passi di oggi), ma l'analisi la tratta a parte
    const put = (m: Parameters<typeof store.setPoints>[0], pts: Pt[]) => { if (pts.length) store.setPoints(m, pts, 'apple'); };
    put('steps', steps.filter((p) => p.v > 0));
    put('hr', hr); put('hrv', hrv); put('weight', weight);
    put('energy', energy.filter((p) => p.v > 0)); put('exercise', exercise.filter((p) => p.v > 0));
    put('vo2', vo2); put('spo2', spo2.map((p) => ({ d: p.d, v: p.v <= 1 ? p.v * 100 : p.v })));
    put('sleep', sleep); put('mindful', mindful);
    const stress = estimateStress(hrv, hr);
    if (stress.length) store.setPoints('stress', stress, 'stimato');
    if (w.length) store.mergeWorkouts(w);
    store.connect('Apple Health');
    store.setSync(Date.now(), null);
    const counts = { passi: steps.length, battito: hr.length, hrv: hrv.length, sonno: sleep.length, peso: weight.length, allenamenti: w.length };
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return {
      ok: true, counts,
      message: total
        ? `Sincronizzato: ${steps.length} giorni di passi, ${sleep.length} notti di sonno, ${hrv.length} misure HRV, ${w.length} allenamenti.`
        : 'Nessun dato letto. Apri Impostazioni > Salute > Accesso ai dati e app > LifePilot e attiva le categorie.',
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    store.setSync(null, msg);
    return { ok: false, message: 'Errore nella lettura da Apple Health: ' + msg };
  }
}

export async function connectAppleHealth(): Promise<SyncResult> {
  const st = await hkState();
  if (st !== 'ready') return syncAppleHealth(); // restituisce il messaggio giusto
  let granted = false;
  try { granted = await requestAppleHealth(); } catch { granted = false; }
  if (!granted) return { ok: false, message: 'Permesso non concesso. Puoi attivarlo da Impostazioni > Salute.' };
  return syncAppleHealth(90);
}

let lastAuto = 0;
/** Sincronizzazione leggera all'avvio e quando l'app torna in primo piano (al massimo ogni 10 minuti). */
export async function autoSyncIfConnected() {
  try { await autoSyncInner(); } catch { /* mai bloccare l'avvio */ }
}
async function autoSyncInner() {
  const { wearable } = useHealth.getState();
  if (!wearable.connected || wearable.device !== 'Apple Health') return;
  if (Date.now() - lastAuto < 10 * 60 * 1000) return;
  lastAuto = Date.now();
  await syncAppleHealth(21);
}

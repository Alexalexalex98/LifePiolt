/**
 * Inserimento a mano di TUTTI i dati di salute (anche dei giorni passati), per chi non ha un orologio o vuole completare i dati.
 * Servono all'analisi incrociata e al punteggio «La tua vita in un dato». Modulo PURO.
 */
export type ManualKey = 'sleep' | 'hr' | 'steps' | 'weight' | 'stress' | 'hrv' | 'mindful' | 'energy' | 'exercise' | 'vo2' | 'spo2'
  | 'distance' | 'flights' | 'resp' | 'fat' | 'stand' | 'hravg' | 'basal' | 'social';
export type ManualField = { key: ManualKey; label: string; unit: string; placeholder: string; min: number; max: number; /** dato che vive nelle «altre» serie */ extra?: boolean };
export type ManualGroup = { id: string; title: string; fields: ManualField[] };

const f = (key: ManualKey, label: string, unit: string, placeholder: string, min: number, max: number, extra = false): ManualField => ({ key, label, unit, placeholder, min, max, ...(extra ? { extra } : {}) });

export const MANUAL_GROUPS: ManualGroup[] = [
  { id: 'sonno', title: 'Sonno', fields: [f('sleep', 'Ore dormite', 'ore', '7.5', 0, 24)] },
  { id: 'movimento', title: 'Movimento', fields: [
    f('steps', 'Passi', '', '8000', 0, 100000), f('distance', 'Distanza a piedi e di corsa', 'km', '5.2', 0, 200, true), f('flights', 'Piani saliti', '', '10', 0, 500, true),
    f('exercise', 'Minuti di esercizio', 'min', '30', 0, 1440), f('energy', 'Energia attiva', 'kcal', '400', 0, 10000), f('stand', 'Tempo in piedi', 'min', '600', 0, 1440, true),
  ] },
  { id: 'cuore', title: 'Cuore e respiro', fields: [
    f('hr', 'Frequenza a riposo', 'bpm', '58', 30, 220), f('hravg', 'Battito medio', 'bpm', '75', 30, 220, true), f('hrv', 'HRV', 'ms', '54', 5, 300),
    f('spo2', 'Ossigeno nel sangue', '%', '97', 70, 100), f('resp', 'Respiri al minuto', '/min', '15', 4, 60, true), f('vo2', 'VO₂ max', 'ml/kg/min', '42', 10, 90),
  ] },
  { id: 'corpo', title: 'Corpo', fields: [f('weight', 'Peso', 'kg', '72.5', 20, 400), f('fat', 'Massa grassa', '%', '18', 2, 70, true), f('basal', 'Energia a riposo', 'kcal', '1600', 500, 6000, true)] },
  { id: 'mente', title: 'Mente', fields: [f('stress', 'Stress (0-100)', '/100', '35', 0, 100), f('mindful', 'Mindfulness', 'min', '10', 0, 1440), f('social', 'Persone con cui hai parlato', '', '3', 0, 200, true)] },
];
export const MANUAL_FIELDS: ManualField[] = MANUAL_GROUPS.flatMap((g) => g.fields);

/** «7,5» o «7.5» → 7.5; null se non è un numero. */
export function parseManual(s: string): number | null {
  const n = Number(String(s ?? '').trim().replace(',', '.'));
  return String(s ?? '').trim() !== '' && Number.isFinite(n) ? n : null;
}

/** Controlla un valore: null se va bene, altrimenti il perché non va. */
export function checkManual(field: ManualField, raw: string): string | null {
  const v = parseManual(raw);
  if (v == null) return `«${field.label}»: scrivi un numero`;
  if (v < field.min || v > field.max) return `«${field.label}»: deve stare tra ${field.min} e ${field.max}`;
  return null;
}

export type ManualEntry = { field: ManualField; value: number };
/** Dai testi inseriti: i valori buoni e gli errori (le caselle vuote si ignorano). */
export function collectManual(values: Record<string, string>): { entries: ManualEntry[]; errors: string[] } {
  const entries: ManualEntry[] = []; const errors: string[] = [];
  for (const field of MANUAL_FIELDS) {
    const raw = values[field.key];
    if (raw == null || raw.trim() === '') continue;
    const err = checkManual(field, raw);
    if (err) errors.push(err); else entries.push({ field, value: parseManual(raw)! });
  }
  return { entries, errors };
}

const pad = (n: number) => String(n).padStart(2, '0');
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Gli ultimi `n` giorni (oggi per primo) con la data in formato AAAA-MM-GG e un nome leggibile. */
export function recentDays(n = 14, now = new Date()): { key: string; label: string }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    return { key: key(d), label: i === 0 ? 'Oggi' : i === 1 ? 'Ieri' : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` };
  });
}

/**
 * Parte pura del backup: serializzazione e validazione. Nessun import di React Native,
 * così si può testare con `node --experimental-strip-types`.
 */

export const BACKUP_APP = 'LifePilot';
export const BACKUP_FORMAT = 1;
export const STORE_PREFIX = 'lp2-';

export type BackupFile = {
  app: typeof BACKUP_APP;
  format: number;
  createdAt: string;
  appVersion: string;
  stores: Record<string, { state: Record<string, unknown>; version?: number }>;
};

export type BackupPreview = {
  createdAt: string;
  appVersion: string;
  storeCount: number;
  sizeKB: number;
  /** nome store (senza prefisso) -> numero di voci principali */
  items: Record<string, number>;
  totalItems: number;
};

export type ValidateResult = { ok: true; backup: BackupFile; preview: BackupPreview } | { ok: false; error: string };

/** Costruisce il file a partire dalle stringhe grezze lette da AsyncStorage ({chiave: json}). */
export function buildBackup(raw: Record<string, string | null | undefined>, appVersion: string, now = new Date()): BackupFile {
  const stores: BackupFile['stores'] = {};
  for (const key of Object.keys(raw).sort()) {
    if (!key.startsWith(STORE_PREFIX)) continue;
    const v = raw[key];
    if (typeof v !== 'string') continue;
    try {
      const parsed = JSON.parse(v);
      if (parsed && typeof parsed === 'object' && parsed.state && typeof parsed.state === 'object') stores[key] = { state: parsed.state, version: typeof parsed.version === 'number' ? parsed.version : 0 };
    } catch { /* valore corrotto: lo salto */ }
  }
  return { app: BACKUP_APP, format: BACKUP_FORMAT, createdAt: now.toISOString(), appVersion, stores };
}

export const serializeBackup = (b: BackupFile) => JSON.stringify(b, null, 1);

export function backupFileName(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `lifepilot-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

/** Conta le voci di uno store: somma degli elementi degli array di primo livello. */
function countItems(state: Record<string, unknown>): number {
  let n = 0;
  for (const v of Object.values(state)) {
    if (Array.isArray(v)) n += v.length;
  }
  return n;
}

export function validateBackup(text: string): ValidateResult {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { ok: false, error: 'Il file non è un backup valido (non è leggibile).' }; }
  if (!data || typeof data !== 'object' || (data as BackupFile).app !== BACKUP_APP) return { ok: false, error: 'Questo file non è un backup di LifePilot.' };
  const b = data as BackupFile;
  if (typeof b.format !== 'number' || !Number.isInteger(b.format) || b.format < 1) return { ok: false, error: 'Il backup non ha una versione riconoscibile.' };
  if (b.format > BACKUP_FORMAT) return { ok: false, error: 'Il backup viene da una versione più recente di LifePilot: aggiorna l\'app e riprova.' };
  if (!b.stores || typeof b.stores !== 'object' || Array.isArray(b.stores)) return { ok: false, error: 'Il backup è incompleto: mancano i dati.' };
  const clean: BackupFile['stores'] = {};
  for (const [k, v] of Object.entries(b.stores)) {
    if (!k.startsWith(STORE_PREFIX)) return { ok: false, error: `Il backup contiene una voce non riconosciuta (${k.slice(0, 20)}).` };
    if (!v || typeof v !== 'object' || !v.state || typeof v.state !== 'object' || Array.isArray(v.state)) return { ok: false, error: `Il backup è danneggiato (${k}).` };
    clean[k] = { state: v.state, version: typeof v.version === 'number' ? v.version : 0 };
  }
  const keys = Object.keys(clean);
  if (!keys.length) return { ok: false, error: 'Il backup è vuoto.' };
  if (!clean[`${STORE_PREFIX}app`]) return { ok: false, error: 'Il backup non contiene il profilo: non sembra completo.' };
  const created = typeof b.createdAt === 'string' && !Number.isNaN(Date.parse(b.createdAt)) ? b.createdAt : '';
  const backup: BackupFile = { app: BACKUP_APP, format: b.format, createdAt: created, appVersion: typeof b.appVersion === 'string' ? b.appVersion : '', stores: clean };
  const items: Record<string, number> = {};
  let total = 0;
  for (const k of keys) { const c = countItems(clean[k].state); items[k.slice(STORE_PREFIX.length)] = c; total += c; }
  return { ok: true, backup, preview: { createdAt: created, appVersion: backup.appVersion, storeCount: keys.length, sizeKB: Math.round(text.length / 102.4) / 10, items, totalItems: total } };
}

/** Coppie {chiave, json} da scrivere in AsyncStorage per ripristinare. */
export function toStorageEntries(b: BackupFile): [string, string][] {
  return Object.entries(b.stores).map(([k, v]) => [k, JSON.stringify({ state: v.state, version: v.version ?? 0 })]);
}

/** Etichette leggibili per l'anteprima. */
export const STORE_LABELS: Record<string, string> = {
  app: 'Account e impostazioni', life: 'Task, obiettivi, note, file, calendario', health: 'Salute e umore', finance: 'Finanze', travel: 'Viaggi',
  network: 'Network e LifePoints', chat: 'Messaggi', jobs: 'Lavoro', context: 'Meteo e contesto', assistant: 'Assistente', discover: 'Guida', prefs: 'Preferenze', theia: 'Suggerimenti', interests: 'Interessi', sharing: 'Condivisione', tour: 'Tutorial', live: 'Dirette', calprefs: 'Calendario',
};

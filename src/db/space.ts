/**
 * Spazio occupato: calcoli puri su dimensioni di store e file. Nessun import nativo.
 * Un file e' "orfano" se si trova nella cartella degli allegati dell'app e nessuno store lo cita.
 */
export type StoreSize = { name: string; bytes: number };
export type FileEntry = { uri: string; name: string; bytes: number; group: 'attachments' | 'cache' | 'database' | 'other' };

export type SpaceReport = {
  dbBytes: number;
  stores: StoreSize[];
  filesBytes: number;
  files: FileEntry[];
  biggest: FileEntry[];
  orphans: FileEntry[];
  orphanBytes: number;
  cacheBytes: number;
  cacheFiles: FileEntry[];
  totalBytes: number;
};

export const basename = (uri: string) => decodeURIComponentSafe(uri.split('?')[0].split('#')[0].replace(/\/+$/, '').split('/').pop() ?? '');
function decodeURIComponentSafe(s: string) { try { return decodeURIComponent(s); } catch { return s; } }

/** Nomi di file citati nei dati (testo JSON degli store): tutto cio' che sembra un percorso file:// o un file dell'app. */
export function referencedNames(jsonTexts: string[]): Set<string> {
  const out = new Set<string>();
  const re = /file:\/\/[^"\\\s]+/g;
  for (const t of jsonTexts) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) out.add(basename(m[0]));
  }
  return out;
}

export function buildReport(input: { stores: StoreSize[]; files: FileEntry[]; referenced: Set<string>; top?: number }): SpaceReport {
  const stores = [...input.stores].sort((a, b) => b.bytes - a.bytes);
  const dbBytes = stores.reduce((a, s) => a + s.bytes, 0);
  const files = input.files.filter((f) => f.group !== 'database');
  const filesBytes = files.reduce((a, f) => a + f.bytes, 0);
  const orphans = files.filter((f) => f.group === 'attachments' && !input.referenced.has(f.name)).sort((a, b) => b.bytes - a.bytes);
  const cacheFiles = files.filter((f) => f.group === 'cache');
  return {
    dbBytes, stores, filesBytes, files,
    biggest: [...files].sort((a, b) => b.bytes - a.bytes).slice(0, input.top ?? 8),
    orphans, orphanBytes: orphans.reduce((a, f) => a + f.bytes, 0),
    cacheFiles, cacheBytes: cacheFiles.reduce((a, f) => a + f.bytes, 0),
    totalBytes: dbBytes + filesBytes,
  };
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0 B';
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1048576).toFixed(n < 10 * 1048576 ? 1 : 0)} MB`;
  return `${(n / 1073741824).toFixed(1)} GB`;
}

/** Soglia di avviso per poco spazio libero: meno di 300 MB oppure meno del 5% del totale. */
export const LOW_SPACE_BYTES = 300 * 1048576;
export function isLowSpace(available: number, total: number): boolean {
  if (!Number.isFinite(available) || available < 0) return false;
  if (available < LOW_SPACE_BYTES) return true;
  return total > 0 && available / total < 0.05;
}

/** Limiti di AsyncStorage (per confronto nei report): ~6 MB totali su Android, ~2 MB per riga in lettura. */
export const ASYNCSTORAGE_TOTAL_LIMIT = 6 * 1048576;
export const ASYNCSTORAGE_ROW_LIMIT = 2 * 1048576;

import { openNativeDriver } from '@/db/sqliteDriver';
import type { SqlDriver } from '@/db/types';

/** SQLite in memoria (telefono): serve all'indice FTS5. Nessun file su disco. */
export async function openMemoryDb(): Promise<SqlDriver | null> {
  try { return (await openNativeDriver(':memory:', null)).driver; } catch { return null; }
}

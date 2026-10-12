import type { SqlDriver } from '@/db/types';

/** Sul web non c'e' SQLite (vedi src/db/backend.web.ts): si usa la ricerca in memoria. */
export async function openMemoryDb(): Promise<SqlDriver | null> { return null; }

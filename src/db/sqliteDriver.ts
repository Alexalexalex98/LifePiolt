import * as SQLite from 'expo-sqlite';

import { serialDriver, type SqlDriver, type SqlValue } from './types.ts';

/** Apre un database expo-sqlite e lo avvolge in un driver seriale. `keyHex` = chiave SQLCipher (ignorata da SQLite normale). */
export async function openNativeDriver(name: string, keyHex: string | null): Promise<{ driver: SqlDriver; cipherVersion: string | null }> {
  const db = await SQLite.openDatabaseAsync(name);
  try {
    if (keyHex) await db.execAsync(`PRAGMA key = "x'${keyHex}'";`);
    const cv = (await db.getAllAsync<{ cipher_version?: string }>('PRAGMA cipher_version'))[0]?.cipher_version ?? null;
    const driver = serialDriver({
      exec: (sql) => db.execAsync(sql),
      run: async (sql, params) => { const r = await db.runAsync(sql, params as SQLite.SQLiteBindParams); return { changes: r.changes }; },
      all: (sql, params) => db.getAllAsync(sql, params as SQLite.SQLiteBindParams),
      close: () => db.closeAsync(),
    });
    return { driver, cipherVersion: cv };
  } catch (e) {
    try { await db.closeAsync(); } catch { /* ignore */ }
    throw e;
  }
}

/** Cambia la chiave SQLCipher di un database gia' aperto con quella vecchia. */
export async function rekeyDriver(driver: SqlDriver, newHex: string): Promise<void> {
  await driver.exec(`PRAGMA rekey = "x'${newHex}'";`);
}

export type { SqlValue };
export const deleteDatabase = (name: string) => SQLite.deleteDatabaseAsync(name);
export const databaseDirectory = (): string => String(SQLite.defaultDatabaseDirectory);

// Driver SQL per i test: implementa SqlDriver sopra node:sqlite (SQLite vero, con FTS5), cosi' lo stesso SQL dell'app viene provato in Node.
import { DatabaseSync } from 'node:sqlite';
import { serialDriver } from '../../src/db/types.ts';

export function openNodeDriver(path = ':memory:') {
  const db = new DatabaseSync(path);
  const raw = {
    exec: (sql) => { db.exec(sql); },
    run: (sql, params) => { const r = db.prepare(sql).run(...params); return { changes: Number(r.changes) }; },
    all: (sql, params) => db.prepare(sql).all(...params).map((r) => ({ ...r })),
    close: () => { db.close(); },
  };
  return { driver: serialDriver(raw), raw: db };
}

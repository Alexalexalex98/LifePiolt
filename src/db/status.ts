import type { DbNotice, DbNoticeKind } from './types.ts';

/** Avvisi dell'engine per l'utente (disco pieno, ripristino, cifratura assente...). Pub/sub minimale, nessun import nativo. */
let list: DbNotice[] = [];
const subs = new Set<() => void>();
let seq = 0;

export function pushNotice(n: Omit<DbNotice, 'id' | 'at'>, now = Date.now()) {
  list = [{ ...n, id: `n${++seq}`, at: now }, ...list.filter((x) => !(x.kind === n.kind && x.store === n.store))].slice(0, 20);
  subs.forEach((f) => f());
}
export const getNotices = () => list;
export function dismissNotice(id: string) { list = list.filter((n) => n.id !== id); subs.forEach((f) => f()); }
export function dismissKind(kind: DbNoticeKind) { list = list.filter((n) => n.kind !== kind); subs.forEach((f) => f()); }
export function subscribeNotices(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }
export function clearNoticesForTests() { list = []; subs.forEach((f) => f()); }

export type StorageInfo = {
  mode: 'sqlite' | 'asyncstorage' | 'memory' | 'opening';
  encryption: 'sqlcipher' | 'value' | 'none';
  cipherVersion: string | null;
  /** motivo leggibile se la cifratura non e' attiva */
  encryptionNote: string;
  dbName: string;
  fts5: boolean | null;
  legacy: string;
};
let info: StorageInfo = { mode: 'opening', encryption: 'none', cipherVersion: null, encryptionNote: '', dbName: '', fts5: null, legacy: '' };
export const getStorageInfo = () => info;
export function setStorageInfo(p: Partial<StorageInfo>) { info = { ...info, ...p }; subs.forEach((f) => f()); }

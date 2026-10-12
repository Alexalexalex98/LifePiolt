import { checksum } from './checksum.ts';
import { isPlainObject } from './schemaKit.ts';

/**
 * Storage a "pezzi" per gli store grandi (chat, piano, rete, finanze, salute...).
 * Invece di riscrivere ~10 MB di JSON a ogni modifica, i campi grandi di primo livello vengono salvati in righe separate:
 *   - 'whole':  un campo (array/oggetto) = una riga           (es. life.notes)
 *   - 'record': un campo-mappa = una riga per chiave           (es. chat.messages[chatId])
 * Gli store sono immutabili: se il riferimento di un pezzo non e' cambiato, il pezzo non viene nemmeno serializzato.
 * Nessuna modifica agli store o alle schermate: il formato logico (JSON dello store) resta identico.
 */
export type ShardKind = 'whole' | 'record';
export type ShardSpec = Record<string, ShardKind>;

export type Piece = { field: string; key: string; value: unknown };
/** chiave piatta di un pezzo */
export const pieceId = (field: string, key: string) => field + '\u0000' + key;
/** i pezzi 'whole' hanno chiave vuota, quelli 'record' hanno '#'+chiave (cosi' una chiave vuota e' distinguibile) */
export const WHOLE_KEY = '';
export const recordKey = (k: string) => '#' + k;

export function splitState(state: Record<string, unknown>, spec: ShardSpec): { rest: Record<string, unknown>; pieces: Piece[] } {
  const rest: Record<string, unknown> = {};
  const pieces: Piece[] = [];
  for (const [k, v] of Object.entries(state)) {
    const kind = spec[k];
    if (v === undefined || typeof v === 'function') continue;
    if (!kind) { rest[k] = v; continue; }
    if (kind === 'whole') {
      if (v !== null && typeof v === 'object') pieces.push({ field: k, key: WHOLE_KEY, value: v }); else rest[k] = v;
    } else if (isPlainObject(v)) {
      const entries = Object.entries(v).filter(([, x]) => x !== undefined && typeof x !== 'function');
      if (!entries.length) rest[k] = {};
      for (const [rk, rv] of entries) pieces.push({ field: k, key: recordKey(rk), value: rv });
    } else rest[k] = v;
  }
  return { rest, pieces };
}

/** Ricostruisce il JSON dello store ({"state":{...},"version":N}) dalla riga "testa" e dai pezzi, senza riparsare i pezzi. */
export function joinJson(headJson: string, pieces: { field: string; key: string; value: string }[]): string {
  const head = JSON.parse(headJson) as { state?: unknown; version?: unknown };
  const rest = isPlainObject(head.state) ? head.state : {};
  const version = typeof head.version === 'number' ? head.version : 0;
  const byField = new Map<string, { whole?: string; rec: string[] }>();
  for (const p of pieces) {
    const f = byField.get(p.field) ?? { rec: [] };
    if (p.key === WHOLE_KEY) f.whole = p.value; else f.rec.push(JSON.stringify(p.key.slice(1)) + ':' + p.value);
    byField.set(p.field, f);
  }
  const parts: string[] = [];
  for (const [k, v] of Object.entries(rest)) if (!byField.has(k) && v !== undefined) parts.push(JSON.stringify(k) + ':' + JSON.stringify(v));
  for (const [f, v] of byField) parts.push(JSON.stringify(f) + ':' + (v.whole !== undefined ? v.whole : '{' + v.rec.join(',') + '}'));
  return '{"state":{' + parts.join(',') + '},"version":' + version + '}';
}

export type ShardMemo = { sums: Map<string, string>; refs: Map<string, unknown>; head: string | null };
export const newMemo = (): ShardMemo => ({ sums: new Map(), refs: new Map(), head: null });

export type ShardPlan = {
  headJson: string;
  headSum: string;
  headChanged: boolean;
  upserts: { field: string; key: string; json: string; sum: string; id: string; ref: unknown }[];
  deletes: { field: string; key: string; id: string }[];
  /** quanti pezzi sono stati effettivamente serializzati */
  serialized: number;
  total: number;
};

/**
 * Calcola cosa scrivere. `verify`=true ignora i riferimenti e serializza tutto (rete di sicurezza contro mutazioni sul posto),
 * scrivendo solo i pezzi il cui checksum e' diverso da quello su disco.
 */
export function planShards(state: Record<string, unknown>, version: number, spec: ShardSpec, memo: ShardMemo, verify = false): ShardPlan {
  const { rest, pieces } = splitState(state, spec);
  const headJson = JSON.stringify({ state: rest, version });
  const headSum = checksum(headJson);
  const upserts: ShardPlan['upserts'] = [];
  const seen = new Set<string>();
  let serialized = 0;
  for (const p of pieces) {
    const id = pieceId(p.field, p.key);
    seen.add(id);
    if (!verify && memo.refs.get(id) === p.value && memo.sums.has(id)) continue;
    const json = JSON.stringify(p.value);
    serialized++;
    const sum = checksum(json);
    if (memo.sums.get(id) === sum) { continue; }
    upserts.push({ field: p.field, key: p.key, json, sum, id, ref: p.value });
  }
  const deletes: ShardPlan['deletes'] = [];
  for (const id of memo.sums.keys()) {
    if (seen.has(id)) continue;
    const [field, key] = id.split('\u0000');
    deletes.push({ field, key, id });
  }
  return { headJson, headSum, headChanged: memo.head !== headSum, upserts, deletes, serialized, total: pieces.length };
}

/** Aggiorna la memoria dopo una scrittura riuscita. */
export function commitPlan(state: Record<string, unknown>, spec: ShardSpec, plan: ShardPlan, memo: ShardMemo) {
  const { pieces } = splitState(state, spec);
  for (const u of plan.upserts) memo.sums.set(u.id, u.sum);
  for (const d of plan.deletes) { memo.sums.delete(d.id); memo.refs.delete(d.id); }
  for (const p of pieces) memo.refs.set(pieceId(p.field, p.key), p.value);
  memo.head = plan.headSum;
}

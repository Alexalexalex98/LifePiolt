/**
 * Politiche di conflitto. Funzioni pure.
 *  - lww: last-writer-wins PER CAMPO con HLC (default);
 *  - server-wins: il valore arrivato dal server prevale sempre (follower, voti);
 *  - set: l'entita' e' la presenza di un elemento (add/remove con tombstone), le aggiunte concorrenti si uniscono;
 *  - union (per campo): unione degli array (tag): le aggiunte non si perdono mai;
 *  - manual (per campo): se entrambi i lati hanno cambiato il testo, vince l'HLC piu' recente e la versione perdente
 *    viene conservata come "copia in conflitto" (mai perdere testo).
 * Le eliminazioni sono tombstone: una scrittura piu' recente della tombstone la "resuscita" (solo per collezioni con
 * aggiornamenti completi), una piu' vecchia viene ignorata. Le tombstone si dimenticano dopo il TTL.
 */
import { hlcWall, maxHlc, type Hlc } from './clock.ts';
import { cloneJson, deepEqual, stableStringify } from './ids.ts';
import type { ChangeOp, EntityMeta, FieldPolicy, Json, PolicyKind, Wire } from './types.ts';

export type PolicyDef = { policy: PolicyKind; fieldPolicies?: Record<string, FieldPolicy>; fullUpdates?: boolean; required?: string[] };
export type IncomingChange = { op: ChangeOp; fields?: Wire; unset?: string[]; full?: Wire; hlc: Hlc; base?: Hlc };
export type FieldConflict = { field: string; loserValue: Json; loserHlc: Hlc; winnerHlc: Hlc; remoteWon: boolean };
export type MergeResult = {
  wire: Wire | undefined;
  meta: EntityMeta | undefined;
  changed: boolean;
  conflicts: FieldConflict[];
  ignored?: 'stale' | 'tombstoned' | 'incomplete' | 'newer-local';
};

export const DEFAULT_TOMBSTONE_TTL_DAYS = 90;

/** HLC dell'ultima scrittura nota su un'entita' (campi o tombstone). */
export function lastWrite(m: EntityMeta | undefined): Hlc | undefined {
  if (!m) return undefined;
  let h = maxHlc(m.b, m.d, m.r);
  if (m.f) for (const k in m.f) h = maxHlc(h, m.f[k]);
  return h;
}

/** Aggiorna i metadati dopo una modifica LOCALE. */
export function metaAfterLocal(meta: EntityMeta | undefined, op: ChangeOp, fieldKeys: string[], unset: string[], hlc: Hlc): EntityMeta {
  if (op === 'delete') return { d: hlc };
  if (op === 'create' || !meta || meta.d) return { b: hlc };
  const f = { ...(meta.f ?? {}) };
  for (const k of fieldKeys) f[k] = hlc;
  for (const k of unset) f[k] = hlc;
  return { ...meta, f };
}

const union = (a: Json, b: Json): Json => {
  const x = Array.isArray(a) ? a : [], y = Array.isArray(b) ? b : [];
  const seen = new Set(x.map(stableStringify));
  const out = x.slice();
  for (const v of y) { const k = stableStringify(v); if (!seen.has(k)) { seen.add(k); out.push(v); } }
  return out;
};

/** Modifiche locali non ancora confermate dal server per l'entita' (servono alle politiche "server-wins"). */
export type PendingLocal = { fields: string[]; deleted: boolean } | undefined;

export function mergeRemote(def: PolicyDef, localWire: Wire | undefined, meta: EntityMeta | undefined, ch: IncomingChange, pending?: PendingLocal): MergeResult {
  const m: EntityMeta = meta ?? {};
  const serverWins = def.policy === 'server-wins';
  const lw = lastWrite(m);

  if (ch.op === 'delete') {
    if (m.d && m.d >= ch.hlc) return { wire: undefined, meta, changed: false, conflicts: [], ignored: 'stale' };
    // modifica locale piu' recente della cancellazione: con aggiornamenti completi (note) vince la modifica; con aggiornamenti parziali
    // vince la cancellazione, a meno che l'entita' sia stata ricreata dopo (create): cosi' tutti i dispositivi convergono
    const created = maxHlc(m.b, m.r);
    const localNewer = def.fullUpdates ? !!lw && lw > ch.hlc : !!created && created > ch.hlc;
    // server-wins: se c'e' una modifica locale ancora in coda, l'ultima parola e' del server DOPO il suo invio (ordine del registro)
    if (serverWins && pending && localWire) return { wire: localWire, meta, changed: false, conflicts: [], ignored: 'newer-local' };
    if (!serverWins && localWire && localNewer && !m.d) return { wire: localWire, meta, changed: false, conflicts: [], ignored: 'newer-local' };
    return { wire: undefined, meta: { d: ch.hlc }, changed: !!localWire || !m.d, conflicts: [] };
  }

  let local: Wire | undefined = localWire;
  let cur: EntityMeta = { ...m, f: m.f ? { ...m.f } : undefined };
  if (m.d) {
    if (ch.hlc <= m.d) return { wire: undefined, meta, changed: false, conflicts: [], ignored: 'tombstoned' };
    if (ch.op === 'update' && !def.fullUpdates && def.policy !== 'set') return { wire: undefined, meta, changed: false, conflicts: [], ignored: 'tombstoned' };
    local = undefined; cur = {}; // resurrezione
  }

  const fields = (!local && ch.full) ? ch.full : (ch.fields ?? {});
  const out: Wire = { ...(local ?? {}) };
  const conflicts: FieldConflict[] = [];
  let changed = false;

  if (!local) {
    for (const k of Object.keys(fields)) out[k] = cloneJson(fields[k]);
    if (def.required?.some((r) => out[r] === undefined)) return { wire: undefined, meta, changed: false, conflicts: [], ignored: 'incomplete' };
    return { wire: out, meta: { b: ch.hlc, s: true }, changed: true, conflicts: [] };
  }

  if (def.policy === 'set') {
    const h = maxHlc(cur.b, ch.hlc);
    return { wire: out, meta: { ...cur, b: h, s: true }, changed: false, conflicts: [] };
  }

  cur.s = true;
  if (ch.op === 'create' && (!cur.r || ch.hlc > cur.r)) cur.r = ch.hlc;
  const setField = (k: string, h: Hlc) => { if (cur.b !== h) cur.f = { ...(cur.f ?? {}), [k]: h }; };
  for (const k of Object.keys(fields)) {
    const v = fields[k];
    const pol: FieldPolicy = def.fieldPolicies?.[k] ?? (serverWins ? 'server' : 'lww');
    const localH = cur.f?.[k] ?? cur.b ?? '';
    const take = () => { if (!deepEqual(out[k], v)) { out[k] = cloneJson(v); changed = true; } setField(k, ch.hlc > localH ? ch.hlc : localH); };
    if (pol === 'server') { if (!pending || (!pending.deleted && !pending.fields.includes(k))) take(); continue; }
    if (pol === 'union') {
      const u = union(out[k] as Json, v);
      if (!deepEqual(u, out[k])) { out[k] = u; changed = true; }
      setField(k, ch.hlc > localH ? ch.hlc : localH);
      continue;
    }
    if (pol === 'manual' && !deepEqual(out[k], v)) {
      const concurrent = localH > (ch.base ?? '');
      if (concurrent) {
        const remoteWon = ch.hlc > localH;
        conflicts.push({ field: k, loserValue: cloneJson(remoteWon ? (out[k] ?? null) : v), loserHlc: remoteWon ? localH : ch.hlc, winnerHlc: remoteWon ? ch.hlc : localH, remoteWon });
        if (remoteWon) { out[k] = cloneJson(v); changed = true; setField(k, ch.hlc); }
        continue;
      }
    }
    if (ch.hlc > localH) { if (!deepEqual(out[k], v)) { out[k] = cloneJson(v); changed = true; } setField(k, ch.hlc); }
  }
  for (const k of ch.unset ?? []) {
    const localH = cur.f?.[k] ?? cur.b ?? '';
    if (ch.hlc > localH) { if (k in out) { delete out[k]; changed = true; } setField(k, ch.hlc); }
  }
  return { wire: out, meta: cur, changed, conflicts };
}

/** Elimina dalle mappe di metadati le tombstone piu' vecchie del TTL. Ritorna quante ne ha tolte. */
export function purgeTombstones(metas: Record<string, EntityMeta>, now: number, ttlMs: number): number {
  let n = 0;
  for (const id of Object.keys(metas)) {
    const d = metas[id].d;
    if (d && hlcWall(d) + ttlMs < now) { delete metas[id]; n++; }
  }
  return n;
}

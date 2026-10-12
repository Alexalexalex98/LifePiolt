/**
 * Diff incrementale per id. Confronta lo snapshot precedente con lo stato nuovo di una collezione sfruttando
 * l'immutabilita' degli oggetti zustand: un bucket con lo stesso riferimento si salta per intero, e dentro un bucket
 * cambiato le entita' con lo stesso riferimento si saltano senza confrontare i campi. Solo le entita' con riferimento
 * nuovo vengono trasformate in "wire" e confrontate campo per campo.
 */
import type { Adapter, ScanItem, Slot } from './adapters.ts';
import { deepEqual, hash53, stableStringify } from './ids.ts';
import type { Wire } from './types.ts';

export type EntSnap = { ref: unknown; hash: string; bucket: string };
export type Snapshot = {
  buckets: Map<string, { ref: unknown; ids: string[] }>;
  ents: Map<string, EntSnap>;
  slots: Map<string, Slot[]>;
  /** false = costruito da impronte salvate (dopo un riavvio): il primo scan confronta per hash */
  primed: boolean;
};

export const newSnapshot = (): Snapshot => ({ buckets: new Map(), ents: new Map(), slots: new Map(), primed: true });

export function snapshotFromBaseline(hashes: Record<string, string> | undefined, slots?: Record<string, [string, string][]>): Snapshot {
  const s = newSnapshot();
  if (hashes) {
    s.primed = false;
    for (const id of Object.keys(hashes)) s.ents.set(id, { ref: undefined, hash: hashes[id], bucket: '' });
  }
  if (slots) for (const b of Object.keys(slots)) s.slots.set(b, slots[b].map(([id, key]) => ({ id, key })));
  return s;
}
export const snapshotHashes = (s: Snapshot): Record<string, string> => { const o: Record<string, string> = {}; for (const [id, e] of s.ents) o[id] = e.hash; return o; };
export const snapshotSlots = (s: Snapshot): Record<string, [string, string][]> => { const o: Record<string, [string, string][]> = {}; for (const [b, l] of s.slots) if (l.length) o[b] = l.map((x) => [x.id, x.key]); return o; };

export const hashWire = (w: Wire) => hash53(stableStringify(w));

export type Added = { id: string; wire: Wire };
export type Updated = { id: string; fields: Wire; unset: string[]; wire: Wire };
export type ScanResult = { added: Added[]; updated: Updated[]; removed: string[]; scanned: number };

/** Differenza tra due wire: campi cambiati/aggiunti e campi spariti. null = identici. */
export function diffWire(a: Wire, b: Wire): { fields: Wire; unset: string[] } | null {
  const fields: Wire = {}; const unset: string[] = [];
  let any = false;
  for (const k of Object.keys(b)) if (b[k] !== undefined && !deepEqual(a[k], b[k])) { fields[k] = b[k]; any = true; }
  for (const k of Object.keys(a)) if (a[k] !== undefined && b[k] === undefined) { unset.push(k); any = true; }
  return any ? { fields, unset } : null;
}

/**
 * Assegna gli id alle entita' senza id (eventi): prima per chiave di contenuto (stesso testo = stessa entita'),
 * poi accoppia per posizione le voci modificate (stessa posizione, chiave cambiata = modifica della stessa entita').
 */
export function matchSlots(old: Slot[], items: ScanItem[], newId: () => string): { ids: string[]; slots: Slot[]; gone: string[] } {
  const keys: string[] = [];
  const occ = new Map<string, number>();
  for (const it of items) { const k0 = it.key ?? ''; const n = occ.get(k0) ?? 0; occ.set(k0, n + 1); keys.push(n ? `${k0}#${n}` : k0); }
  const byKey = new Map<string, number>();
  old.forEach((s, i) => byKey.set(s.key, i));
  const usedOld = new Set<number>();
  const ids: (string | undefined)[] = new Array(items.length).fill(undefined);
  keys.forEach((k, i) => { const oi = byKey.get(k); if (oi !== undefined) { ids[i] = old[oi].id; usedOld.add(oi); } });
  for (let i = 0; i < items.length; i++) {
    if (ids[i] === undefined && i < old.length && !usedOld.has(i)) { ids[i] = old[i].id; usedOld.add(i); }
  }
  const out = ids.map((x) => x ?? newId());
  const gone = old.filter((_, i) => !usedOld.has(i)).map((s) => s.id);
  return { ids: out, slots: out.map((id, i) => ({ id, key: keys[i] })), gone };
}

export type ScanOpts = { newId: () => string; absorb?: Set<string> };

export function scanCollection<S>(adapter: Adapter<S>, state: S, snap: Snapshot, opts: ScanOpts): ScanResult {
  const res: ScanResult = { added: [], updated: [], removed: [], scanned: 0 };
  const absorb = opts.absorb;
  const seenBuckets = new Set<string>();
  const touched = new Set<string>();
  const seenAll = snap.primed ? null : new Set<string>();
  const candidates: [string, string][] = []; // [id, bucket in cui stava]

  for (const [bk, bref] of adapter.buckets(state)) {
    seenBuckets.add(bk);
    const old = snap.buckets.get(bk);
    if (old && old.ref === bref) { if (seenAll) for (const id of old.ids) seenAll.add(id); continue; }
    const items = adapter.items(bk, bref);
    res.scanned += items.length;
    let ids: string[];
    let goneIds: string[] = [];
    if (adapter.positional) {
      const m = matchSlots(snap.slots.get(bk) ?? [], items, opts.newId);
      ids = m.ids; goneIds = m.gone; snap.slots.set(bk, m.slots);
    } else ids = items.map((it) => it.id as string);
    const live = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      const id = ids[i];
      if (live.has(id)) continue; // id duplicato nello stesso bucket: conta solo il primo
      live.add(id); touched.add(id); seenAll?.add(id);
      const it = items[i];
      const prev = snap.ents.get(id);
      if (!prev) {
        const w = it.wire();
        const h = hashWire(w);
        snap.ents.set(id, { ref: it.ref, hash: h, bucket: bk });
        if (!absorb?.has(id)) res.added.push({ id, wire: w });
      } else if (prev.ref === it.ref && prev.bucket === bk) {
        // invariato
      } else {
        const w = it.wire();
        const h = hashWire(w);
        let d: { fields: Wire; unset: string[] } | null;
        if (prev.ref === undefined) d = h !== prev.hash ? { fields: w, unset: [] } : null;
        else d = h === prev.hash && prev.bucket === bk ? null : diffWire(adapter.toWire(prev.ref, prev.bucket, id), w);
        prev.ref = it.ref; prev.hash = h; prev.bucket = bk;
        if (d && !absorb?.has(id)) res.updated.push({ id, fields: d.fields, unset: d.unset, wire: w });
      }
    }
    for (const id of old?.ids ?? []) if (!live.has(id)) candidates.push([id, bk]);
    for (const id of goneIds) if (!live.has(id)) candidates.push([id, bk]);
    snap.buckets.set(bk, { ref: bref, ids: [...live] });
  }
  for (const [bk, old] of snap.buckets) {
    if (seenBuckets.has(bk)) continue;
    for (const id of old.ids) candidates.push([id, bk]);
    snap.buckets.delete(bk); snap.slots.delete(bk);
  }
  const seenRemoved = new Set<string>();
  for (const [id, bk] of candidates) {
    const e = snap.ents.get(id);
    if (!e || touched.has(id) || e.bucket !== bk || seenRemoved.has(id)) continue;
    seenRemoved.add(id);
    snap.ents.delete(id);
    if (!absorb?.has(id)) res.removed.push(id);
  }
  if (seenAll) {
    for (const [id] of snap.ents) if (!seenAll.has(id)) { snap.ents.delete(id); if (!absorb?.has(id)) res.removed.push(id); }
    snap.primed = true;
  }
  return res;
}

/**
 * Adattatori: trasformano la struttura di uno store (array, mappe, liste per giorno, insiemi...) in "entita' con id stabile"
 * e, al contrario, applicano le modifiche arrivate dal server tramite setState parziale IMMUTABILE.
 * Non modificano mai gli store: leggono lo stato e producono un patch. Modulo puro.
 *
 * Quattro forme coprono tutti gli store:
 *  - bucketedAdapter: liste raggruppate (Record<bucket, E[]>) o lista piatta; id intrinseco oppure posizionale (eventi);
 *  - recordAdapter: mappa id -> entita';
 *  - setAdapter: array di stringhe usato come insieme (follower, interessi);
 *  - nestedAdapter: mappa di mappe di valori (voti).
 */
import type { Wire } from './types.ts';

export type Slot = { id: string; key: string };
export type ScanItem = { id?: string; key?: string; ref: unknown; wire: () => Wire };
export type ApplyCtx = {
  /** bucket in cui vive oggi l'entita' (da snapshot), undefined se non esiste */
  bucketOf(id: string): string | undefined;
  /** slot posizionali del bucket (solo adattatori posizionali) */
  slots(bucket: string): Slot[];
};
export type ApplyResult<S> = { patch: Partial<S> | null; assigned: { id: string; bucket: string; key: string }[]; /** solo posizionali: slot aggiornati e allineati all'array per i bucket toccati */ slots?: Map<string, Slot[]> };

export interface Adapter<S = unknown> {
  /** true = le entita' non hanno id nello store: l'id si assegna con la tabella degli slot */
  positional: boolean;
  /** riferimenti da confrontare per sapere se la collezione puo' essere cambiata (se tutti uguali: niente da fare) */
  roots(s: S): unknown[];
  buckets(s: S): Iterable<[string, unknown]>;
  items(bucket: string, ref: unknown): ScanItem[];
  toWire(ref: unknown, bucket: string, id: string): Wire;
  /** indice id -> (riferimento, bucket) dello stato corrente: serve quando lo snapshot non c'e' ancora (collezione in attesa di attivazione) */
  index(s: S, slots: Map<string, Slot[]>): Map<string, { ref: unknown; bucket: string }>;
  apply(s: S, upserts: Map<string, Wire>, deletes: Set<string>, ctx: ApplyCtx): ApplyResult<S>;
}

/** Chiavi di contenuto con suffisso di occorrenza (#n) per distinguere voci identiche nello stesso bucket. */
export function occurrenceKeys(keys: string[]): string[] {
  const occ = new Map<string, number>();
  return keys.map((k) => { const n = occ.get(k) ?? 0; occ.set(k, n + 1); return n ? `${k}#${n}` : k; });
}

type BucketedOpts<S, E extends object> = {
  get(s: S): Record<string, E[]>;
  set(rec: Record<string, E[]>): Partial<S>;
  /** riferimenti stabili per il rilevamento rapido dei cambi (se manca: [get(s)]) */
  roots?(s: S): unknown[];
  bucketOf?(w: Wire): string;
  idOf?(e: E): string;
  keyOf?(e: E, bucket: string): string;
  toWire(e: E, bucket: string): Wire;
  fromWire(id: string, w: Wire, existing?: E): E | null;
};

export function bucketedAdapter<S, E extends object>(o: BucketedOpts<S, E>): Adapter<S> {
  const positional = !o.idOf;
  const bucketOfWire = o.bucketOf ?? (() => '');
  /** id -> indice nell'array, ricavato dagli slot confrontando le chiavi di contenuto (non assume che gli slot siano allineati) */
  const slotIndex = (arr: E[], bucket: string, slots: Slot[]): Map<string, number> => {
    const m = new Map<string, number>();
    if (!slots.length) return m;
    const keys = occurrenceKeys(arr.map((e) => o.keyOf!(e, bucket)));
    const byKey = new Map<string, number>();
    keys.forEach((k, j) => byKey.set(k, j));
    for (const s of slots) { const j = byKey.get(s.key); if (j !== undefined) m.set(s.id, j); }
    return m;
  };
  return {
    positional,
    roots: (s) => (o.roots ? o.roots(s) : [o.get(s)]),
    buckets: (s) => Object.entries(o.get(s)),
    items: (bk, ref) => (ref as E[]).map((e) => ({ id: o.idOf?.(e), key: o.keyOf?.(e, bk), ref: e, wire: () => o.toWire(e, bk) })),
    toWire: (ref, bk) => o.toWire(ref as E, bk),
    index(s, slots) {
      const m = new Map<string, { ref: unknown; bucket: string }>();
      for (const [bk, arr] of Object.entries(o.get(s))) {
        if (positional) { for (const [id, j] of slotIndex(arr, bk, slots.get(bk) ?? [])) m.set(id, { ref: arr[j], bucket: bk }); }
        else for (const e of arr) m.set(o.idOf!(e), { ref: e, bucket: bk });
      }
      return m;
    },
    apply(s, upserts, deletes, ctx) {
      const rec: Record<string, E[]> = { ...o.get(s) };
      // se lo snapshot non conosce l'entita' (collezione non ancora attivata) la cerco direttamente nello stato
      let all: Map<string, string> | undefined;
      const where = (id: string): string | undefined => {
        const known = ctx.bucketOf(id);
        if (known !== undefined || positional) return known;
        if (!all) { all = new Map(); for (const [bk, arr] of Object.entries(rec)) for (const e of arr) all.set(o.idOf!(e), bk); }
        return all.get(id);
      };
      const ops = new Map<string, { put: Map<string, Wire>; del: Set<string> }>();
      const op = (b: string) => { let x = ops.get(b); if (!x) { x = { put: new Map(), del: new Set() }; ops.set(b, x); } return x; };
      for (const id of deletes) { const b = where(id); if (b !== undefined) op(b).del.add(id); }
      for (const [id, w] of upserts) {
        const nb = bucketOfWire(w), ob = where(id);
        if (ob !== undefined && ob !== nb) op(ob).del.add(id);
        op(nb).put.set(id, w);
      }
      const assigned: { id: string; bucket: string; key: string }[] = [];
      const newSlots = new Map<string, Slot[]>();
      for (const [b, x] of ops) {
        const arr = rec[b] ?? [];
        const idx = new Map<string, number>();
        if (positional) for (const [id, j] of slotIndex(arr, b, ctx.slots(b))) idx.set(id, j);
        else arr.forEach((e, i) => idx.set(o.idOf!(e), i));
        const next = arr.slice();
        const idAt: (string | undefined)[] = arr.map(() => undefined);
        for (const [id, j] of idx) idAt[j] = id;
        const gone = new Set<number>();
        for (const id of x.del) { const i = idx.get(id); if (i !== undefined && !x.put.has(id)) gone.add(i); }
        let keyIdx: Map<string, number[]> | undefined;
        for (const [id, w] of x.put) {
          let i = idx.get(id);
          if (i === undefined && positional && o.keyOf) {
            // l'entita' non ha ancora uno slot: se esiste gia' una voce locale identica (stesso contenuto) la adotto invece di duplicarla
            const cand = o.fromWire(id, w, undefined);
            if (cand) {
              if (!keyIdx) {
                keyIdx = new Map();
                const slotted = new Set(idx.values());
                next.forEach((e, j) => { if (!slotted.has(j)) { const k = o.keyOf!(e, b); const l = keyIdx!.get(k); if (l) l.push(j); else keyIdx!.set(k, [j]); } });
              }
              const hit = keyIdx.get(o.keyOf(cand, b))?.shift();
              if (hit !== undefined) i = hit;
            }
          }
          const e = o.fromWire(id, w, i !== undefined && i < next.length ? next[i] : undefined);
          if (!e) continue;
          if (i !== undefined && i < next.length) next[i] = e; else { next.push(e); idAt.push(id); i = next.length - 1; }
          idAt[i] = id;
          assigned.push({ id, bucket: b, key: o.keyOf ? o.keyOf(e, b) : id });
        }
        // le entita' spostate di bucket (x.del con put in altro bucket) vanno tolte dal vecchio
        for (const id of x.del) { const i = idx.get(id); if (i !== undefined && x.put.has(id)) gone.add(i); }
        const out = gone.size ? next.filter((_, i) => !gone.has(i)) : next;
        if (positional) {
          const ids = gone.size ? idAt.filter((_, i) => !gone.has(i)) : idAt;
          const keys = occurrenceKeys(out.map((e) => o.keyOf!(e, b)));
          const sl: Slot[] = [];
          ids.forEach((id, j) => { if (id !== undefined) sl.push({ id, key: keys[j] }); });
          newSlots.set(b, sl);
        }
        if (out.length === 0 && b !== '') delete rec[b]; else rec[b] = out;
      }
      return { patch: ops.size ? o.set(rec) : null, assigned, ...(positional ? { slots: newSlots } : {}) };
    },
  };
}

/** Lista piatta con id intrinseco (task, note, obiettivi...). */
export function listAdapter<S, E extends object>(o: {
  get(s: S): E[]; set(list: E[]): Partial<S>; idOf(e: E): string; toWire(e: E): Wire; fromWire(id: string, w: Wire, existing?: E): E | null;
}): Adapter<S> {
  const base = bucketedAdapter<S, E>({
    get: (s) => ({ '': o.get(s) }), roots: (s) => [o.get(s)], set: (rec) => o.set(rec[''] ?? []),
    idOf: o.idOf, toWire: (e) => o.toWire(e), fromWire: o.fromWire,
  });
  return base;
}

/** Mappa id -> entita' (club, iscrizioni): ogni chiave e' un bucket a se', cosi' le voci non cambiate si saltano per riferimento. */
export function recordAdapter<S, E extends object>(o: {
  get(s: S): Record<string, E>; set(rec: Record<string, E>): Partial<S>; toWire(e: E, id: string): Wire; fromWire(id: string, w: Wire, existing?: E): E | null;
}): Adapter<S> {
  return {
    positional: false,
    roots: (s) => [o.get(s)],
    buckets: (s) => Object.entries(o.get(s)),
    items: (bk, ref) => [{ id: bk, ref, wire: () => o.toWire(ref as E, bk) }],
    toWire: (ref, bk) => o.toWire(ref as E, bk),
    index: (s) => new Map(Object.entries(o.get(s)).map(([k, e]) => [k, { ref: e, bucket: k }])),
    apply(s, upserts, deletes) {
      const rec = { ...o.get(s) };
      let changed = false;
      for (const id of deletes) if (id in rec && !upserts.has(id)) { delete rec[id]; changed = true; }
      for (const [id, w] of upserts) { const e = o.fromWire(id, w, rec[id]); if (e) { rec[id] = e; changed = true; } }
      return { patch: changed ? o.set(rec) : null, assigned: [] };
    },
  };
}

/** Array di stringhe usato come insieme: ogni elemento e' un'entita' (id = elemento) senza campi; la rimozione e' una tombstone. */
export function setAdapter<S>(o: { get(s: S): string[]; set(list: string[]): Partial<S> }): Adapter<S> {
  return {
    positional: false,
    roots: (s) => [o.get(s)],
    buckets: (s) => [['', o.get(s)]],
    items: (_bk, ref) => (ref as string[]).map((el) => ({ id: el, ref: el, wire: () => ({}) })),
    toWire: () => ({}),
    index: (s) => new Map(o.get(s).map((el) => [el, { ref: el, bucket: '' }])),
    apply(s, upserts, deletes) {
      const cur = o.get(s);
      const set = new Set(cur);
      let changed = false;
      for (const id of deletes) if (!upserts.has(id) && set.delete(id)) changed = true;
      const adds: string[] = [];
      for (const id of upserts.keys()) if (!set.has(id)) { adds.push(id); changed = true; }
      if (!changed) return { patch: null, assigned: [] };
      return { patch: o.set([...cur.filter((x) => set.has(x)), ...adds]), assigned: [] };
    },
  };
}

/** Mappa di mappe di numeri (voti): id = "chiave|sotto-chiave", wire {a, b, v}. */
export function nestedAdapter<S>(o: { get(s: S): Record<string, Record<string, number>>; set(rec: Record<string, Record<string, number>>): Partial<S> }): Adapter<S> {
  return {
    positional: false,
    roots: (s) => [o.get(s)],
    buckets: (s) => Object.entries(o.get(s)),
    items: (bk, ref) => Object.entries(ref as Record<string, number>).map(([k2, v]) => ({ id: `${bk}|${k2}`, ref: v, wire: () => ({ a: bk, b: k2, v }) })),
    toWire: (ref, bk, id) => ({ a: bk, b: id.slice(id.lastIndexOf('|') + 1), v: ref as number }),
    index: (s) => { const m = new Map<string, { ref: unknown; bucket: string }>(); for (const [a, inner] of Object.entries(o.get(s))) for (const [b, v] of Object.entries(inner)) m.set(`${a}|${b}`, { ref: v, bucket: a }); return m; },
    apply(s, upserts, deletes) {
      const rec = { ...o.get(s) };
      let changed = false;
      const inner = (a: string) => { if (rec[a] === o.get(s)[a]) rec[a] = { ...(rec[a] ?? {}) }; return rec[a]; };
      for (const id of deletes) {
        if (upserts.has(id)) continue;
        const i = id.lastIndexOf('|'); const a = id.slice(0, i), b = id.slice(i + 1);
        if (rec[a] && b in rec[a]) { delete inner(a)[b]; changed = true; if (!Object.keys(rec[a]).length) delete rec[a]; }
      }
      for (const [, w] of upserts) {
        const a = String(w.a), b = String(w.b), v = Number(w.v);
        if (!Number.isFinite(v)) continue;
        inner(a)[b] = v; changed = true;
      }
      return { patch: changed ? o.set(rec) : null, assigned: [] };
    },
  };
}

/**
 * Outbox: registro persistito delle modifiche locali non ancora confermate dal server.
 * Compattazione per entita' (una sola voce in coda per entita', salvo quella gia' in volo):
 *   create+update -> create | update+update -> update | update+delete -> delete
 *   create+delete -> nulla (il server non l'ha mai vista) | delete+create -> create
 */
import type { ChangeRecord } from './types.ts';

const ekey = (r: { collection: string; entityId: string }) => r.collection + '\u0000' + r.entityId;

export type EnqueueResult = { kind: 'added' | 'merged' | 'annihilated'; record?: ChangeRecord };

export class Outbox {
  private records = new Map<string, ChangeRecord>();
  private latest = new Map<string, string>();
  private inflight = new Set<string>();

  constructor(initial: ChangeRecord[] = []) {
    for (const r of initial) { this.records.set(r.id, r); this.latest.set(ekey(r), r.id); }
  }

  /** voce piu' recente in coda (anche in volo) per un'entita' */
  peek(collection: string, entityId: string): ChangeRecord | undefined {
    const id = this.latest.get(collection + '\u0000' + entityId);
    return id ? this.records.get(id) : undefined;
  }

  get size() { return this.records.size; }
  get inflightCount() { return this.inflight.size; }
  toArray(): ChangeRecord[] { return [...this.records.values()]; }
  has(id: string) { return this.records.has(id); }
  countByCollection(): Record<string, number> { const o: Record<string, number> = {}; for (const r of this.records.values()) o[r.collection] = (o[r.collection] ?? 0) + 1; return o; }

  /** `serverKnows`: il server conosce gia' l'entita' (per altre vie): una cancellazione non puo' annullarsi con la creazione in coda */
  enqueue(rec: ChangeRecord, serverKnows = false): EnqueueResult {
    const k = ekey(rec);
    const prevId = this.latest.get(k);
    const prev = prevId ? this.records.get(prevId) : undefined;
    if (!prev || this.inflight.has(prev.id) || prev.tried) {
      this.records.set(rec.id, rec); this.latest.set(k, rec.id);
      return { kind: 'added', record: rec };
    }
    if (rec.op === 'delete') {
      if (prev.op === 'create' && !prev.afterDelete && !serverKnows) { this.records.delete(prev.id); this.latest.delete(k); return { kind: 'annihilated' }; }
      const m: ChangeRecord = { ...prev, op: 'delete', fields: undefined, unset: undefined, hlc: rec.hlc };
      this.records.set(prev.id, m);
      return { kind: 'merged', record: m };
    }
    if (rec.op === 'create' || prev.op === 'delete') {
      const m: ChangeRecord = { ...prev, op: 'create', fields: rec.fields, unset: undefined, hlc: rec.hlc, schemaV: rec.schemaV, full: undefined, ...(prev.op === 'delete' || prev.afterDelete ? { afterDelete: true } : {}) };
      this.records.set(prev.id, m);
      return { kind: 'merged', record: m };
    }
    const fields = { ...(prev.fields ?? {}), ...(rec.fields ?? {}) };
    let unset = [...(prev.unset ?? []).filter((u) => !(u in fields)), ...(rec.unset ?? [])];
    for (const u of rec.unset ?? []) delete fields[u];
    unset = [...new Set(unset)];
    const m: ChangeRecord = { ...prev, op: prev.op, fields, unset: unset.length ? unset : undefined, hlc: rec.hlc, schemaV: rec.schemaV, ...(rec.full ? { full: rec.full } : {}) };
    this.records.set(prev.id, m);
    return { kind: 'merged', record: m };
  }

  /** Prende fino a n voci (le piu' vecchie) che passano il filtro e le segna "in volo". */
  take(n: number, filter: (r: ChangeRecord) => boolean = () => true, maxBytes = Infinity): ChangeRecord[] {
    const out: ChangeRecord[] = [];
    let bytes = 0;
    for (const r of this.records.values()) {
      if (out.length >= n) break;
      if (this.inflight.has(r.id) || !filter(r)) continue;
      const size = r.fields ? JSON.stringify(r.fields).length + 200 : 200;
      if (out.length && bytes + size > maxBytes) break;
      bytes += size; out.push(r);
    }
    for (const r of out) { this.inflight.add(r.id); r.tried = true; }
    return out;
  }
  /** Conferma: toglie dalla coda. */
  ack(ids: string[]) { for (const id of ids) this.remove(id); }
  /** Rimette in coda (invio fallito o esito ignoto). */
  release(ids: string[], bumpAttempts = false) {
    for (const id of ids) {
      this.inflight.delete(id);
      const r = this.records.get(id);
      if (r && bumpAttempts) this.records.set(id, { ...r, attempts: (r.attempts ?? 0) + 1 });
    }
  }
  remove(id: string) {
    const r = this.records.get(id);
    this.inflight.delete(id);
    if (!r) return;
    this.records.delete(id);
    if (this.latest.get(ekey(r)) === id) this.latest.delete(ekey(r));
  }
  dropWhere(pred: (r: ChangeRecord) => boolean): number {
    let n = 0;
    for (const r of [...this.records.values()]) if (pred(r)) { this.remove(r.id); n++; }
    return n;
  }
  clear() { this.records.clear(); this.latest.clear(); this.inflight.clear(); }
  /** Dopo un riavvio nulla e' piu' in volo. */
  resetInflight() { this.inflight.clear(); }
}

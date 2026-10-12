/**
 * Motore di sincronizzazione local-first. Osserva gli store dall'esterno (subscribe + snapshot), produce un registro di
 * modifiche (outbox) con ID stabili, HLC e tombstone, e lo sincronizza con un SyncTransport. Non modifica il codice degli store:
 * le modifiche remote si applicano con setState parziale immutabile tramite gli adattatori inversi (src/sync/adapters.ts).
 *
 * Garanzie:
 *  - privacy: solo categorie abilitate dall'utente, non critiche e (se richiesto) con cifratura E2E; il controllo e' ripetuto
 *    al momento dell'invio (difesa in profondita');
 *  - nessun loop: le modifiche remote vengono "assorbite" nello snapshot e non generano nuovi record;
 *  - idempotenza: ogni modifica ha un changeId, il server la accetta una volta sola, il client ignora i duplicati;
 *  - convergenza: l'applicazione e' deterministica (HLC), quindi tutti i dispositivi arrivano allo stesso stato.
 */
import type { Adapter } from './adapters.ts';
import { ClockSkewError, createClock, hlcWall, type Clock } from './clock.ts';
import { identityCodec, type PayloadCodec } from './codec.ts';
import { newSnapshot, scanCollection, snapshotFromBaseline, snapshotHashes, snapshotSlots, type ScanResult, type Snapshot } from './diff.ts';
import { defaultRand, derivedId, uuidv7, type Rand } from './ids.ts';
import { Outbox } from './outbox.ts';
import { lastWrite, mergeRemote, metaAfterLocal, purgeTombstones } from './policy.ts';
import { categoryEligibility, ttlDaysOf, type CollectionDef } from './registry.ts';
import { TransportError, type SyncTransport } from './transport.ts';
import type { ChangeRecord, ConflictEntry, DeviceInfo, EntityMeta, Json, MassHold, SentLogEntry, SyncPhase, SyncStatus, Wire, WireChange } from './types.ts';

// ---------- stato persistito (le due meta' sono in src/store/sync.ts) ----------
export type SyncSettings = {
  /** opt-in per categoria del catalogo dati (predefinito: tutto "solo sul telefono") */
  enabled: Record<string, boolean>;
  paused: boolean;
  transportName: string;
  serverUrl: string;
  deviceName: string;
  conflicts: ConflictEntry[];
  sentLog: SentLogEntry[];
  lastResult: { at: number; ok: boolean; pushed: number; pulled: number; error?: string } | null;
  devices: DeviceInfo[];
  massHold: Record<string, MassHold>;
  rejectedCount: number;
};
export type SyncData = {
  deviceId: string;
  seq: number;
  hlc: string;
  cursor: string | null;
  backfill: string[];
  seedPending: string[];
  outbox: ChangeRecord[];
  meta: Record<string, Record<string, EntityMeta>>;
  baseline: Record<string, Record<string, string>>;
  idMap: Record<string, Record<string, [string, string][]>>;
  applied: string[];
  skippedSchema: Record<string, number>;
};
export type SyncState = SyncSettings & SyncData;
export interface StateAccess { get(): SyncState; patch(p: Partial<SyncState>): void }

export const emptySettings = (): SyncSettings => ({
  enabled: {}, paused: false, transportName: 'disconnected', serverUrl: '', deviceName: '', conflicts: [], sentLog: [], lastResult: null, devices: [], massHold: {}, rejectedCount: 0,
});
export const emptyData = (deviceId = ''): SyncData => ({
  deviceId, seq: 0, hlc: '', cursor: null, backfill: [], seedPending: [], outbox: [], meta: {}, baseline: {}, idMap: {}, applied: [], skippedSchema: {},
});

export function memoryState(init: Partial<SyncState> = {}): StateAccess & { snapshot(): SyncState } {
  let s: SyncState = { ...emptySettings(), ...emptyData('device-' + Math.random().toString(36).slice(2, 8)), ...init };
  return { get: () => s, patch: (p) => { s = { ...s, ...p }; }, snapshot: () => s };
}

// ---------- store ----------
export interface StoreLike<S = any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  getState(): S;
  setState(partial: Partial<S>): void;
  subscribe(listener: (state: S, prev: S) => void): () => void;
  /** false = persistenza non ancora ripristinata: finche' non e' pronto non si legge nulla (si rischierebbero cancellazioni false) */
  isReady?(): boolean;
}

export type EngineConfig = {
  debounceMs: number; batchSize: number; maxBatchBytes: number; pullPage: number;
  backoffBaseMs: number; backoffMaxMs: number; maxAttempts: number; heavyFlushMs: number; pollMs: number; autoSyncDelayMs: number;
  massDeleteRatio: number; massDeleteMin: number; maxDriftMs: number; appliedRing: number; sentLogMax: number; autoRetry: boolean;
};
export const DEFAULT_CONFIG: EngineConfig = {
  debounceMs: 800, batchSize: 100, maxBatchBytes: 256 * 1024, pullPage: 500,
  backoffBaseMs: 2000, backoffMaxMs: 5 * 60 * 1000, maxAttempts: 20, heavyFlushMs: 1500, pollMs: 2 * 60 * 1000, autoSyncDelayMs: 3000,
  massDeleteRatio: 0.5, massDeleteMin: 25, maxDriftMs: 24 * 3600 * 1000, appliedRing: 2000, sentLogMax: 200, autoRetry: true,
};

export interface Scheduler { set(fn: () => void, ms: number): unknown; clear(h: unknown): void }
const realScheduler: Scheduler = { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };

export type EngineDeps = {
  bindings: Record<string, StoreLike>;
  collections: CollectionDef[];
  state: StateAccess;
  getTransport: () => SyncTransport;
  getCodec?: () => PayloadCodec;
  now?: () => number;
  rand?: Rand;
  scheduler?: Scheduler;
  isOnline?: () => boolean;
  config?: Partial<EngineConfig>;
};

export type SyncResult = { ok: boolean; pushed: number; pulled: number; applied: number; error?: string; skipped?: 'disconnected' | 'offline' | 'paused' | 'nothing-enabled' };

const hasChanged = (a: unknown[], b: unknown[]) => { if (a.length !== b.length) return true; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return true; return false; };

export class SyncEngine {
  readonly cfg: EngineConfig;
  private now: () => number;
  private rand: Rand;
  private sched: Scheduler;
  private snaps = new Map<string, Snapshot>();
  private seeded = new Set<string>();
  private dirty = new Set<string>();
  private seedAbsorb = new Map<string, Set<string>>();
  private held = new Map<string, string[]>();
  private outbox: Outbox;
  private clock: Clock;
  private applying = false;
  private unsubs: (() => void)[] = [];
  private listeners = new Set<(s: SyncStatus) => void>();
  private status: SyncStatus = { phase: 'disconnected', pending: 0, blocked: 0 };
  private debounceH: unknown;
  private heavyH: unknown;
  private autoH: unknown;
  private retryH: unknown;
  private pollH: unknown;
  private heavyDirty = new Set<string>();
  private heavyMisc = false;
  private running: Promise<SyncResult> | null = null;
  private again = false;
  private retries = 0;
  private started = false;
  private appliedSet: Set<string>;
  readonly stats = { captured: 0, applied: 0, skippedDuplicates: 0, clockSkew: 0, undecodable: 0, scans: 0, scanned: 0 };

  private deps: EngineDeps;
  constructor(deps: EngineDeps) {
    this.deps = deps;
    this.cfg = { ...DEFAULT_CONFIG, ...(deps.config ?? {}) };
    this.now = deps.now ?? Date.now;
    this.rand = deps.rand ?? defaultRand;
    this.sched = deps.scheduler ?? realScheduler;
    const st = deps.state.get();
    this.outbox = new Outbox(st.outbox);
    this.outbox.resetInflight();
    this.clock = createClock({ node: this.node(), now: this.now, maxDriftMs: this.cfg.maxDriftMs, initial: st.hlc || undefined });
    this.appliedSet = new Set(st.applied);
  }

  // ---------- accessori ----------
  private get st() { return this.deps.state.get(); }
  private node() { return (this.deps.state.get().deviceId || 'dev').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'dev'; }
  private codec(): PayloadCodec { return this.deps.getCodec?.() ?? identityCodec; }
  private newId = () => uuidv7(this.now(), this.rand);
  private defOf(name: string) { return this.deps.collections.find((c) => c.name === name); }
  private online() { return this.deps.isOnline ? this.deps.isOnline() : true; }

  /** Una collezione si sincronizza solo se: categoria abilitata dall'utente, non critica/bloccata, e (se serve) cifratura E2E attiva. */
  isAllowed(def: CollectionDef): boolean {
    if (!this.st.enabled[def.category]) return false;
    if (!categoryEligibility(def.category).eligible) return false;
    if (def.requiresE2E && !this.codec().e2e) return false;
    return true;
  }
  allowedCollections(): CollectionDef[] { return this.deps.collections.filter((c) => this.isAllowed(c)); }
  /** Collezioni che l'utente ha abilitato ma che aspettano la cifratura E2E. */
  blockedCollections(): CollectionDef[] { return this.deps.collections.filter((c) => this.st.enabled[c.category] && categoryEligibility(c.category).eligible && !this.isAllowed(c)); }

  getStatus(): SyncStatus { return this.status; }
  subscribe(l: (s: SyncStatus) => void): () => void { this.listeners.add(l); return () => this.listeners.delete(l); }
  pendingCount() { return this.outbox.size; }
  pendingByCollection() { return this.outbox.countByCollection(); }
  outboxSnapshot(): ChangeRecord[] { return this.outbox.toArray(); }

  private setStatus(p: Partial<SyncStatus>) {
    const blocked = this.blockedCollections().length;
    const next: SyncStatus = { ...this.status, ...p, pending: this.outbox.size, blocked };
    if (next.phase === this.status.phase && next.pending === this.status.pending && next.blocked === this.status.blocked && next.lastError === this.status.lastError && next.retryAt === this.status.retryAt && next.lastOkAt === this.status.lastOkAt) return;
    this.status = next;
    this.listeners.forEach((l) => l(next));
  }
  private phaseIdle(): SyncPhase {
    if (this.st.paused) return 'paused';
    if (!this.deps.getTransport().isConnected()) return 'disconnected';
    if (!this.online()) return 'offline';
    return 'idle';
  }
  refreshStatus() { this.setStatus({ phase: this.status.phase === 'syncing' ? 'syncing' : this.status.phase === 'error' ? 'error' : this.phaseIdle() }); }

  // ---------- ciclo di vita ----------
  /** Avvia l'osservazione degli store. Da chiamare quando gli store sono stati ripristinati (isReady). */
  start(): () => void {
    if (this.started) return () => this.stop();
    this.started = true;
    this.reconfigure();
    const stores = new Set(this.deps.collections.map((c) => c.store));
    for (const name of stores) {
      const b = this.deps.bindings[name];
      if (!b) continue;
      this.unsubs.push(b.subscribe((state, prev) => this.onStoreChange(name, state, prev)));
    }
    this.captureAll();
    this.setStatus({ phase: this.phaseIdle() });
    this.schedulePoll();
    if (this.outbox.size) this.scheduleAutoSync();
    return () => this.stop();
  }
  stop() {
    this.started = false;
    this.unsubs.forEach((u) => u()); this.unsubs = [];
    for (const h of [this.debounceH, this.heavyH, this.autoH, this.retryH, this.pollH]) if (h) this.sched.clear(h);
    this.debounceH = this.heavyH = this.autoH = this.retryH = this.pollH = undefined;
    this.flush();
  }

  private ready(store: string) { const b = this.deps.bindings[store]; return !!b && (b.isReady ? b.isReady() : true); }

  /**
   * Allinea le collezioni attive alle scelte dell'utente: crea gli snapshot per quelle nuove (da attivare con un "seed" dopo
   * il primo pull) e butta via quelle disabilitate (coda, impronte, metadati).
   */
  reconfigure() {
    const allowed = new Set(this.allowedCollections().map((c) => c.name));
    const st = this.st;
    const data: Partial<SyncState> = {};
    for (const name of [...this.snaps.keys()]) if (!allowed.has(name)) this.dropCollection(name);
    // anche se l'engine non ha mai visto la collezione, pulisco i residui di categorie non piu' consentite
    for (const c of this.deps.collections) if (!allowed.has(c.name) && (st.meta[c.name] || st.baseline[c.name] || st.idMap[c.name] || st.seedPending.includes(c.name) || this.outbox.countByCollection()[c.name])) this.dropCollection(c.name);
    const pending = new Set(this.st.seedPending);
    const backfill = new Set(this.st.backfill);
    for (const c of this.allowedCollections()) {
      if (this.snaps.has(c.name)) continue;
      const base = this.st.baseline[c.name];
      if (base && !pending.has(c.name)) {
        this.snaps.set(c.name, snapshotFromBaseline(base, this.st.idMap[c.name]));
        this.seeded.add(c.name);
      } else {
        this.snaps.set(c.name, newSnapshot());
        pending.add(c.name);
        backfill.add(c.name);
      }
    }
    if (pending.size !== this.st.seedPending.length || backfill.size !== this.st.backfill.length) { data.seedPending = [...pending]; data.backfill = [...backfill]; }
    if (Object.keys(data).length) this.deps.state.patch(data);
    this.setStatus({});
  }

  private dropCollection(name: string) {
    this.snaps.delete(name); this.seeded.delete(name); this.dirty.delete(name); this.seedAbsorb.delete(name); this.held.delete(name);
    this.outbox.dropWhere((r) => r.collection === name);
    const st = this.st;
    const meta = { ...st.meta }, baseline = { ...st.baseline }, idMap = { ...st.idMap }, massHold = { ...st.massHold };
    delete meta[name]; delete baseline[name]; delete idMap[name]; delete massHold[name];
    this.deps.state.patch({
      meta, baseline, idMap, massHold,
      seedPending: st.seedPending.filter((x) => x !== name), backfill: st.backfill.filter((x) => x !== name),
      outbox: this.outbox.toArray(),
    });
  }

  /** L'utente attiva o disattiva la sincronizzazione di una categoria. Disattivare cancella coda e metadati locali (non il server). */
  setCategoryEnabled(category: string, on: boolean): { ok: boolean; error?: string } {
    const el = categoryEligibility(category);
    if (on && !el.eligible) return { ok: false, error: el.reason };
    const st = this.st;
    if (!!st.enabled[category] === on) return { ok: true };
    this.deps.state.patch({ enabled: { ...st.enabled, [category]: on } });
    this.reconfigure();
    if (on && this.started) this.scheduleAutoSync(0);
    this.setStatus({});
    return { ok: true };
  }

  // ---------- osservazione e cattura ----------
  private onStoreChange(store: string, state: unknown, prev: unknown) {
    if (this.applying) return;
    for (const def of this.deps.collections) {
      if (def.store !== store || !this.seeded.has(def.name)) continue;
      if (hasChanged(def.adapter.roots(state), def.adapter.roots(prev))) this.dirty.add(def.name);
    }
    if (this.dirty.size && !this.debounceH) this.debounceH = this.sched.set(() => { this.debounceH = undefined; this.captureAll(); }, this.cfg.debounceMs);
  }

  /** Cattura subito tutte le collezioni sporche (o tutte, se `all`). Ritorna quanti record ha prodotto. */
  captureAll(all = false): number {
    if (this.debounceH) { this.sched.clear(this.debounceH); this.debounceH = undefined; }
    let n = 0;
    for (const name of this.seeded) if (all || this.dirty.has(name) || this.snaps.get(name)?.primed === false) n += this.capture(name).records;
    return n;
  }

  /** Un solo giro di diff per una collezione. Con `absorb` le entita' indicate entrano nello snapshot senza generare record. */
  capture(name: string, absorb?: Set<string>): { records: number; held?: boolean } {
    const def = this.defOf(name);
    const snap = this.snaps.get(name);
    if (!def || !snap || !this.ready(def.store)) return { records: 0 };
    this.dirty.delete(name);
    const state = this.deps.bindings[def.store].getState();
    const before = snap.ents.size;
    const res = scanCollection(def.adapter as Adapter<unknown>, state, snap, { newId: this.newId, absorb });
    this.stats.scans++; this.stats.scanned += res.scanned;
    return { records: this.emit(def, snap, res, before) };
  }

  private emit(def: CollectionDef, snap: Snapshot, res: ScanResult, before: number): number {
    if (!res.added.length && !res.updated.length && !res.removed.length) { return 0; }
    const name = def.name;
    // protezione dalle cancellazioni di massa (reset dello store, ripristino di un backup, dati non ancora caricati)
    if (res.removed.length >= this.cfg.massDeleteMin && before > 0 && res.removed.length / before >= this.cfg.massDeleteRatio) {
      this.held.set(name, [...(this.held.get(name) ?? []), ...res.removed]);
      const hold: MassHold = { collection: name, count: this.held.get(name)!.length, total: before, at: this.now() };
      this.deps.state.patch({ massHold: { ...this.st.massHold, [name]: hold } });
      res = { ...res, removed: [] };
      this.markHeavy(name);
    }
    const metas = (this.st.meta[name] ??= {});
    const full = !!def.fullUpdates;
    let n = 0;
    const push = (id: string, op: ChangeRecord['op'], fields?: Wire, unset?: string[], fullWire?: Wire) => {
      const hlc = this.clock.tick();
      const m = metas[id];
      const rec: ChangeRecord = {
        id: this.newId(), collection: name, schemaV: def.schemaV, entityId: id, op, hlc, deviceId: this.st.deviceId, seq: this.nextSeq(),
        ...(m && lastWrite(m) ? { base: lastWrite(m) } : {}),
        ...(fields ? { fields } : {}), ...(unset && unset.length ? { unset } : {}), ...(fullWire ? { full: fullWire } : {}),
      };
      const r = this.outbox.enqueue(rec);
      if (r.kind === 'annihilated') delete metas[id];
      else metas[id] = metaAfterLocal(m, op, fields ? Object.keys(fields) : [], unset ?? [], hlc);
      n++; this.stats.captured++;
    };
    for (const a of res.added) push(a.id, 'create', a.wire);
    for (const u of res.updated) push(u.id, 'update', u.fields, u.unset, full ? u.wire : undefined);
    for (const id of res.removed) push(id, 'delete');
    this.markHeavy(name);
    this.setStatus({});
    if (n) this.scheduleAutoSync();
    return n;
  }

  private nextSeq() { const s = this.st.seq + 1; this.deps.state.patch({ seq: s }); return s; }

  /** Conferma (true) o scarta (false) una cancellazione di massa trattenuta. */
  resolveMassDelete(collection: string, confirm: boolean) {
    const ids = this.held.get(collection) ?? [];
    this.held.delete(collection);
    const def = this.defOf(collection);
    const snap = this.snaps.get(collection);
    const { [collection]: _drop, ...rest } = this.st.massHold; void _drop;
    this.deps.state.patch({ massHold: rest });
    if (!def || !snap) return;
    if (confirm) this.emit(def, snap, { added: [], updated: [], removed: ids, scanned: 0 }, Math.max(ids.length * 10, 1_000_000));
    for (const id of ids) snap.ents.delete(id);
    this.markHeavy(collection);
  }

  // ---------- persistenza pesante (throttle) ----------
  private markHeavy(name?: string) {
    if (name) this.heavyDirty.add(name); else this.heavyMisc = true;
    if (!this.heavyH) this.heavyH = this.sched.set(() => { this.heavyH = undefined; this.flush(); }, this.cfg.heavyFlushMs);
  }
  /** Scrive subito su disco impronte, tabella degli id, metadati, coda e orologio. */
  flush() {
    if (this.heavyH) { this.sched.clear(this.heavyH); this.heavyH = undefined; }
    const st = this.st;
    const baseline = { ...st.baseline }, idMap = { ...st.idMap };
    for (const name of this.heavyDirty) {
      const snap = this.snaps.get(name);
      if (!snap || !this.seeded.has(name)) continue;
      baseline[name] = snapshotHashes(snap);
      const slots = snapshotSlots(snap);
      if (this.defOf(name)?.adapter.positional) idMap[name] = slots;
    }
    this.heavyDirty.clear(); this.heavyMisc = false;
    this.deps.state.patch({ baseline, idMap, meta: { ...st.meta }, outbox: this.outbox.toArray(), hlc: this.clock.last(), applied: [...this.appliedSet].slice(-this.cfg.appliedRing) });
  }

  // ---------- sincronizzazione ----------
  pause() { this.deps.state.patch({ paused: true }); this.setStatus({ phase: 'paused' }); }
  resume() { this.deps.state.patch({ paused: false }); this.setStatus({ phase: this.phaseIdle() }); this.scheduleAutoSync(0); }
  notifyOnline() { this.retries = 0; this.setStatus({ phase: this.status.phase === 'offline' || this.status.phase === 'error' ? this.phaseIdle() : this.status.phase }); this.scheduleAutoSync(0); }

  private scheduleAutoSync(delay = this.cfg.autoSyncDelayMs) {
    if (!this.started || this.autoH || this.st.paused) return;
    this.autoH = this.sched.set(() => { this.autoH = undefined; void this.syncNow().catch(() => {}); }, delay);
  }
  private schedulePoll() {
    if (this.pollH || !this.cfg.pollMs) return;
    this.pollH = this.sched.set(() => { this.pollH = undefined; if (this.started) { void this.syncNow().catch(() => {}); this.schedulePoll(); } }, this.cfg.pollMs);
  }

  /** "Sincronizza ora": invia la coda e scarica le novita'. Una sola esecuzione alla volta. */
  syncNow(): Promise<SyncResult> {
    if (this.running) { this.again = true; return this.running; }
    this.running = this.runOnce().finally(() => { this.running = null; if (this.again) { this.again = false; this.scheduleAutoSync(0); } });
    return this.running;
  }

  private async runOnce(): Promise<SyncResult> {
    const out: SyncResult = { ok: true, pushed: 0, pulled: 0, applied: 0 };
    if (this.st.paused) { this.setStatus({ phase: 'paused' }); return { ...out, skipped: 'paused' }; }
    this.reconfigure();
    if (!this.allowedCollections().length) { this.setStatus({ phase: this.phaseIdle() }); return { ...out, skipped: 'nothing-enabled' }; }
    const tr = this.deps.getTransport();
    if (!tr.isConnected()) { this.setStatus({ phase: 'disconnected' }); return { ...out, ok: false, skipped: 'disconnected' }; }
    if (!this.online()) { this.setStatus({ phase: 'offline' }); return { ...out, ok: false, skipped: 'offline' }; }
    this.setStatus({ phase: 'syncing', lastError: undefined });
    try {
      this.captureAll();
      // 1) novita' dal server (la prima volta PRIMA di inviare, cosi' il server vince sull'unione iniziale)
      const r1 = await this.pullAll(tr);
      out.pulled += r1.pulled; out.applied += r1.applied;
      // 2) attivazione delle collezioni nuove: il loro contenuto locale entra ora nella coda
      this.seedPendingCollections();
      // 3) invio
      out.pushed += await this.pushAll(tr);
      // 4) eco e novita' arrivate nel frattempo
      if (out.pushed) { const r2 = await this.pullAll(tr); out.pulled += r2.pulled; out.applied += r2.applied; }
      this.purgeTombstones();
      this.retries = 0;
      const at = this.now();
      this.deps.state.patch({ lastResult: { at, ok: true, pushed: out.pushed, pulled: out.pulled } });
      void this.refreshDevices(tr);
      this.flush();
      this.setStatus({ phase: 'idle', lastError: undefined, lastOkAt: at, retryAt: undefined });
      return out;
    } catch (e) {
      return this.fail(e, out);
    }
  }

  private fail(e: unknown, out: SyncResult): SyncResult {
    const te = e instanceof TransportError ? e : null;
    const msg = te ? friendly(te) : 'Errore imprevisto durante la sincronizzazione.';
    const at = this.now();
    this.deps.state.patch({ lastResult: { at, ok: false, pushed: out.pushed, pulled: out.pulled, error: msg } });
    this.flush();
    const offline = te?.kind === 'network' && !this.online();
    const noRetry = te?.kind === 'auth' || te?.kind === 'unavailable';
    let retryAt: number | undefined;
    if (!noRetry && this.cfg.autoRetry && this.started) {
      const exp = Math.min(this.cfg.backoffMaxMs, this.cfg.backoffBaseMs * 2 ** this.retries);
      const delay = te?.retryAfterMs ?? Math.round(exp * (0.5 + this.rand(1)[0] / 512));
      this.retries++;
      retryAt = at + delay;
      if (this.retryH) this.sched.clear(this.retryH);
      this.retryH = this.sched.set(() => { this.retryH = undefined; void this.syncNow().catch(() => {}); }, delay);
    }
    this.setStatus({ phase: te?.kind === 'unavailable' ? 'disconnected' : offline ? 'offline' : 'error', lastError: msg, retryAt });
    return { ...out, ok: false, error: msg };
  }

  private async refreshDevices(tr: SyncTransport) {
    try { const d = await tr.devices?.(); if (d) this.deps.state.patch({ devices: d }); } catch { /* facoltativo */ }
  }

  // ---------- push ----------
  private async pushAll(tr: SyncTransport): Promise<number> {
    const codec = this.codec();
    // difesa in profondita': mai in coda cio' che non e' piu' consentito
    this.outbox.dropWhere((r) => { const d = this.defOf(r.collection); return !d || !this.st.enabled[d.category] || !categoryEligibility(d.category).eligible; });
    const okCollection = (r: ChangeRecord) => { const d = this.defOf(r.collection); return !!d && this.isAllowed(d); };
    let total = 0;
    for (;;) {
      const recs = this.outbox.take(this.cfg.batchSize, okCollection, this.cfg.maxBatchBytes);
      if (!recs.length) break;
      const ids = recs.map((r) => r.id);
      let wire: WireChange[];
      try { wire = await Promise.all(recs.map((r) => this.toWire(r, codec))); } catch (e) { this.outbox.release(ids); throw e; }
      let res;
      try { res = await tr.push(wire); } catch (e) { this.outbox.release(ids, true); this.dropExhausted(); this.flush(); throw e; }
      const acked = new Set(res.acked);
      const rej = new Map(res.rejected.map((x) => [x.id, x]));
      const done: string[] = [], retry: string[] = [];
      for (const r of recs) {
        if (acked.has(r.id)) done.push(r.id);
        else { const x = rej.get(r.id); if (x && !x.retryable) { this.outbox.remove(r.id); this.deps.state.patch({ rejectedCount: this.st.rejectedCount + 1 }); } else retry.push(r.id); }
      }
      this.outbox.ack(done);
      this.outbox.release(retry, true);
      this.dropExhausted();
      const by = new Map<string, number>();
      for (const r of recs) if (acked.has(r.id)) by.set(r.collection, (by.get(r.collection) ?? 0) + 1);
      for (const [c, count] of by) this.log({ at: this.now(), dir: 'invio', collection: c, category: this.defOf(c)?.category ?? '', count, ok: true });
      total += done.length;
      this.setStatus({});
      if (!done.length) break; // nulla accettato: inutile insistere in questo giro
    }
    this.markHeavy();
    return total;
  }

  private dropExhausted() { this.outbox.dropWhere((r) => (r.attempts ?? 0) >= this.cfg.maxAttempts); }

  private async toWire(r: ChangeRecord, codec: PayloadCodec): Promise<WireChange> {
    const w: WireChange = { v: 1, id: r.id, collection: r.collection, schemaV: r.schemaV, entityId: r.entityId, op: r.op, hlc: r.hlc, ...(r.base ? { base: r.base } : {}), deviceId: r.deviceId, seq: r.seq, codec: codec.id };
    if (r.op !== 'delete') w.payload = await codec.encrypt(JSON.stringify({ fields: r.fields ?? {}, ...(r.unset ? { unset: r.unset } : {}), ...(r.full ? { full: r.full } : {}) }), { collection: r.collection, entityId: r.entityId });
    return w;
  }

  private log(e: SentLogEntry) {
    const l = [...this.st.sentLog, e].slice(-this.cfg.sentLogMax);
    this.deps.state.patch({ sentLog: l });
  }

  // ---------- pull ----------
  private async pullAll(tr: SyncTransport): Promise<{ pulled: number; applied: number }> {
    let pulled = 0, applied = 0;
    const names = () => this.allowedCollections().map((c) => c.name);
    // storico delle collezioni appena attivate
    if (this.st.cursor === null) { if (this.st.backfill.length) this.deps.state.patch({ backfill: [] }); }
    else if (this.st.backfill.length) {
      const only = this.st.backfill.filter((n) => names().includes(n));
      let cur: string | null = null;
      for (let guard = 0; guard < 100000; guard++) {
        const r = await tr.pull(cur, { limit: this.cfg.pullPage, collections: only });
        const a = await this.applyWire(r.changes);
        pulled += r.changes.length; applied += a;
        cur = r.nextCursor;
        if (!r.hasMore) break;
      }
      this.deps.state.patch({ backfill: [] });
    }
    for (let guard = 0; guard < 100000; guard++) {
      const cursor = this.st.cursor;
      const r = await tr.pull(cursor, { limit: this.cfg.pullPage, collections: names() });
      if (r.reset) { this.resetForResync(); continue; }
      const a = await this.applyWire(r.changes);
      pulled += r.changes.length; applied += a;
      this.deps.state.patch({ cursor: r.nextCursor });
      this.markHeavy();
      if (!r.hasMore) break;
    }
    return { pulled, applied };
  }

  /** Il cursore e' scaduto (tombstone dimenticate dal server): si riparte da zero, il server vince sull'unione. */
  private resetForResync() {
    for (const c of this.allowedCollections()) {
      this.snaps.set(c.name, newSnapshot()); this.seeded.delete(c.name);
    }
    const names = this.allowedCollections().map((c) => c.name);
    this.deps.state.patch({ cursor: null, meta: {}, baseline: {}, idMap: {}, seedPending: names, backfill: [] });
  }

  private seedPendingCollections() {
    for (const name of [...this.st.seedPending]) {
      const def = this.defOf(name);
      if (!def || !this.isAllowed(def) || !this.snaps.has(name) || !this.ready(def.store)) continue;
      this.seeded.add(name);
      this.capture(name, this.seedAbsorb.get(name) ?? new Set());
      this.seedAbsorb.delete(name);
    }
    this.deps.state.patch({ seedPending: this.st.seedPending.filter((n) => !this.seeded.has(n)) });
  }

  /** Decifra, ordina per HLC e applica le modifiche arrivate dal server. Ritorna quante ne ha applicate. */
  async applyWire(changes: WireChange[]): Promise<number> {
    if (!changes.length) return 0;
    const codec = this.codec();
    const decoded: { name: string; ch: Incoming }[] = [];
    const me = this.st.deviceId;
    for (const c of changes) {
      if (this.appliedSet.has(c.id)) { this.stats.skippedDuplicates++; continue; }
      if (c.deviceId === me) { this.remember(c.id); continue; }
      const def = this.defOf(c.collection);
      if (!def || !this.isAllowed(def) || !this.snaps.has(def.name)) continue;
      if (c.schemaV > def.schemaV) { this.deps.state.patch({ skippedSchema: { ...this.st.skippedSchema, [def.name]: Math.max(c.schemaV, this.st.skippedSchema[def.name] ?? 0) } }); continue; }
      let fields: Wire | undefined, unset: string[] | undefined, full: Wire | undefined;
      if (c.op !== 'delete') {
        try {
          if (c.codec !== codec.id && c.codec !== 'identity') throw new Error('codec');
          const plain = c.codec === 'identity' ? c.payload ?? '{}' : await codec.decrypt(c.payload ?? '', { collection: c.collection, entityId: c.entityId });
          const p = JSON.parse(plain) as { fields?: Wire; unset?: string[]; full?: Wire };
          fields = p.fields ?? {}; unset = p.unset; full = p.full;
        } catch { this.stats.undecodable++; continue; }
      }
      decoded.push({ name: def.name, ch: { id: c.id, entityId: c.entityId, op: c.op, fields, unset, full, hlc: c.hlc, base: c.base } });
    }
    const byCol = new Map<string, Incoming[]>();
    for (const d of decoded) { const l = byCol.get(d.name) ?? []; l.push(d.ch); byCol.set(d.name, l); }
    let applied = 0;
    for (const [name, list] of byCol) {
      list.sort((a, b) => (a.hlc < b.hlc ? -1 : a.hlc > b.hlc ? 1 : 0));
      applied += this.applyCollection(this.defOf(name) as CollectionDef, list);
    }
    this.flush();
    return applied;
  }

  private remember(id: string) { this.appliedSet.add(id); if (this.appliedSet.size > this.cfg.appliedRing * 2) this.appliedSet = new Set([...this.appliedSet].slice(-this.cfg.appliedRing)); }

  private applyCollection(def: CollectionDef, list: Incoming[]): number {
    const name = def.name;
    const snap = this.snaps.get(name) as Snapshot;
    const binding = this.deps.bindings[def.store];
    if (!binding || !this.ready(def.store)) return 0;
    if (this.seeded.has(name)) this.capture(name); // prima le modifiche locali ancora in debounce
    const metas = (this.st.meta[name] ??= {});
    const wires = new Map<string, Wire | undefined>();
    const touched = new Set<string>();
    const copies = new Map<string, Wire>();
    const newConflicts: ConflictEntry[] = [];
    let idx: Map<string, { ref: unknown; bucket: string }> | undefined;
    const localWire = (id: string): Wire | undefined => {
      if (wires.has(id)) return wires.get(id);
      let e: { ref: unknown; bucket: string } | undefined = snap.ents.get(id);
      if (!(e && e.ref !== undefined) && !this.seeded.has(name)) { idx ??= def.adapter.index(binding.getState(), snap.slots); e = idx.get(id); }
      if (e && e.ref !== undefined) return def.adapter.toWire(e.ref, e.bucket, id);
      return undefined;
    };
    let applied = 0;
    for (const ch of list) {
      try { this.clock.receive(ch.hlc); } catch (e) { if (e instanceof ClockSkewError) { this.stats.clockSkew++; continue; } throw e; }
      this.remember(ch.id);
      const id = ch.entityId;
      const pr = this.outbox.peek(name, id);
      const mr = mergeRemote(def, localWire(id), metas[id], ch, pr ? { fields: Object.keys(pr.fields ?? {}), deleted: pr.op === 'delete' } : undefined);
      if (mr.ignored) continue;
      if (mr.meta) metas[id] = mr.meta; else delete metas[id];
      if (mr.changed) { wires.set(id, mr.wire); touched.add(id); applied++; this.stats.applied++; }
      for (const c of mr.conflicts) {
        if (!def.conflictCopy || !mr.wire) continue;
        const copyId = derivedId('cc', id, c.field, c.loserHlc);
        if (copies.has(copyId) || snap.ents.has(copyId)) continue;
        copies.set(copyId, def.conflictCopy(mr.wire, c.field, c.loserValue));
        const preview = typeof c.loserValue === 'string' ? c.loserValue.slice(0, 120) : '';
        newConflicts.push({ id: copyId, collection: name, entityId: id, field: c.field, copyId, at: this.now(), preview });
      }
    }
    const upserts = new Map<string, Wire>();
    const deletes = new Set<string>();
    for (const [id, w] of wires) { if (w) upserts.set(id, w); else deletes.add(id); }
    for (const [id, w] of copies) upserts.set(id, w);
    if (!upserts.size && !deletes.size) return applied;
    const res = def.adapter.apply(binding.getState(), upserts, deletes, {
      bucketOf: (id) => snap.ents.get(id)?.bucket,
      slots: (b) => snap.slots.get(b) ?? [],
    });
    if (res.patch) {
      this.applying = true;
      try { binding.setState(res.patch); } finally { this.applying = false; }
    }
    // tabella degli slot per gli adattatori posizionali
    if (def.adapter.positional) {
      for (const id of deletes) { const e = snap.ents.get(id); if (e) snap.slots.set(e.bucket, (snap.slots.get(e.bucket) ?? []).filter((s) => s.id !== id)); }
      for (const a of res.assigned) {
        const e = snap.ents.get(a.id);
        if (e && e.bucket !== a.bucket) snap.slots.set(e.bucket, (snap.slots.get(e.bucket) ?? []).filter((s) => s.id !== a.id));
        const cur = snap.slots.get(a.bucket) ?? [];
        const at = cur.findIndex((s) => s.id === a.id);
        if (at >= 0) snap.slots.set(a.bucket, cur.map((s, i) => (i === at ? { id: a.id, key: a.key } : s))); // stessa posizione dell'array
        else snap.slots.set(a.bucket, [...cur, { id: a.id, key: a.key }]);
      }
    }
    const absorb = new Set([...upserts.keys(), ...deletes].filter((id) => !copies.has(id)));
    if (this.seeded.has(name)) {
      this.capture(name, absorb); // assorbe nello snapshot; le copie in conflitto escono come normali creazioni locali
      this.markHeavy(name);
    } else {
      const s = this.seedAbsorb.get(name) ?? new Set<string>();
      for (const id of absorb) s.add(id);
      this.seedAbsorb.set(name, s);
    }
    if (newConflicts.length) {
      const have = new Set(this.st.conflicts.map((c) => c.id));
      const add = newConflicts.filter((c) => !have.has(c.id));
      if (add.length) this.deps.state.patch({ conflicts: [...this.st.conflicts, ...add].slice(-200) });
    }
    this.log({ at: this.now(), dir: 'ricezione', collection: name, category: def.category, count: applied, ok: true });
    return applied;
  }

  // ---------- manutenzione ----------
  private purgeTombstones() {
    const now = this.now();
    const meta = this.st.meta;
    for (const name of Object.keys(meta)) {
      const def = this.defOf(name);
      purgeTombstones(meta[name], now, (def ? ttlDaysOf(def) : 90) * 86400000);
    }
  }

  /** "Disattiva e cancella": toglie tutto da questo telefono (coda, metadati, cursore) e, se il server lo permette, anche dal server. */
  async deactivateAndWipe(): Promise<{ ok: boolean; message: string; serverWiped: boolean }> {
    const tr = this.deps.getTransport();
    let serverWiped = false, message = '';
    if (tr.deleteAllData && tr.isConnected()) {
      try { await tr.deleteAllData(); serverWiped = true; } catch (e) { message = e instanceof TransportError ? friendly(e) : 'Il server non ha risposto.'; return { ok: false, message: message + ' I dati sul telefono non sono stati toccati.', serverWiped: false }; }
    }
    for (const name of [...this.snaps.keys()]) this.dropCollection(name);
    this.outbox.clear();
    this.appliedSet.clear();
    this.deps.state.patch({ enabled: {}, cursor: null, backfill: [], seedPending: [], outbox: [], meta: {}, baseline: {}, idMap: {}, applied: [], conflicts: [], devices: [], massHold: {}, skippedSchema: {} });
    this.setStatus({ phase: this.phaseIdle() });
    return { ok: true, serverWiped, message: serverWiped ? 'Dati cancellati dal server e dal registro locale.' : 'Sincronizzazione disattivata su questo telefono. Nessun server collegato: non c\'era nulla da cancellare online.' };
  }

  /** Conflitti: elimina l'elemento (copia) o lo marca risolto. La modifica vera sullo store la fa il chiamante. */
  markConflict(id: string, resolved: ConflictEntry['resolved']) {
    this.deps.state.patch({ conflicts: this.st.conflicts.map((c) => (c.id === id ? { ...c, resolved } : c)) });
  }
  heldCollections() { return Object.keys(this.st.massHold); }
  hlcWallOf(h: string) { return hlcWall(h); }
}

type Incoming = { id: string; entityId: string; op: ChangeRecord['op']; fields?: Wire; unset?: string[]; full?: Wire; hlc: string; base?: string };

export function friendly(e: TransportError): string {
  switch (e.kind) {
    case 'network': return 'Connessione assente o instabile. Riprovo da solo.';
    case 'auth': return 'Accesso al server scaduto: serve accedere di nuovo.';
    case 'rate-limit': return 'Il server chiede di rallentare. Riprovo tra poco.';
    case 'unavailable': return 'Nessun server collegato.';
    default: return 'Il server ha avuto un problema. Riprovo da solo.';
  }
}
export type { Json };

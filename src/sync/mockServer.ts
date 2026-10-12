/**
 * Server finto in memoria per i test e per la modalita' di sviluppo. Simula il contratto descritto in docs/sync.md:
 * registro append-only con cursore (serverSeq), invio idempotente per changeId, validazione con gli schemi condivisi
 * (src/schemas), limiti di dimensione, rate limit, compattazione delle tombstone e dispositivi.
 * MockServerTransport aggiunge l'iniezione di guasti: perdita di richieste e di risposte, consegne doppie,
 * risposte duplicate, riordino, rete assente, ritardi.
 */
import { LIMITS, wireChangeSchema } from '../schemas/change.ts';
import { hlcWall } from './clock.ts';
import { TransportError, type AuthState, type PullOpts, type PullResult, type PushResult, type RejectReason, type SyncTransport, type TransportConfig } from './transport.ts';
import type { DeviceInfo, WireChange } from './types.ts';

export type ServerOptions = { now?: () => number; maxPayloadBytes?: number; maxPushBatch?: number; rateLimitPerMinute?: number; tombstoneTtlMs?: number };

export class MockServer {
  log: WireChange[] = [];
  private seen = new Map<string, number>();
  private seq = 0;
  /** il cursore piu' basso ancora valido: i client piu' vecchi devono risincronizzare */
  minSeq = 0;
  devices = new Map<string, { name: string; lastSeen: number }>();
  private hits = new Map<string, number[]>();
  stats = { pushes: 0, pulls: 0, applied: 0, duplicates: 0, rejected: 0 };
  readonly now: () => number;
  readonly opts: Required<Omit<ServerOptions, 'now'>>;

  constructor(o: ServerOptions = {}) {
    this.now = o.now ?? Date.now;
    this.opts = {
      maxPayloadBytes: o.maxPayloadBytes ?? LIMITS.maxPayloadBytes,
      maxPushBatch: o.maxPushBatch ?? LIMITS.maxPushBatch,
      rateLimitPerMinute: o.rateLimitPerMinute ?? Infinity,
      tombstoneTtlMs: o.tombstoneTtlMs ?? LIMITS.tombstoneTtlDays * 86400000,
    };
  }

  private touch(deviceId: string, name?: string) {
    const d = this.devices.get(deviceId);
    this.devices.set(deviceId, { name: name ?? d?.name ?? deviceId, lastSeen: this.now() });
  }
  private rate(deviceId: string) {
    const t = this.now();
    const arr = (this.hits.get(deviceId) ?? []).filter((x) => t - x < 60000);
    arr.push(t); this.hits.set(deviceId, arr);
    if (arr.length > this.opts.rateLimitPerMinute) throw new TransportError('rate-limit', 'Troppe richieste', 60000 - (t - arr[0]));
  }

  registerDevice(id: string, name: string) { this.touch(id, name); }

  push(deviceId: string, changes: WireChange[]): PushResult {
    this.rate(deviceId); this.touch(deviceId); this.stats.pushes++;
    if (changes.length > this.opts.maxPushBatch) throw new TransportError('server', 'Batch troppo grande');
    const acked: string[] = [];
    const rejected: PushResult['rejected'] = [];
    for (const raw of changes) {
      const reject = (reason: RejectReason, retryable = false) => { rejected.push({ id: String((raw as { id?: unknown })?.id), reason, retryable }); this.stats.rejected++; };
      if (typeof raw?.payload === 'string' && raw.payload.length > this.opts.maxPayloadBytes) { reject('too-large'); continue; }
      const p = wireChangeSchema.safeParse(raw);
      if (!p.success) { reject('invalid'); continue; }
      const c = p.data as WireChange;
      if (c.deviceId !== deviceId) { reject('forbidden'); continue; }
      if (hlcWall(c.hlc) - this.now() > LIMITS.maxClockDriftMs) { reject('invalid'); continue; }
      if (this.seen.has(c.id)) { acked.push(c.id); this.stats.duplicates++; continue; }
      this.seq += 1;
      const stored: WireChange = { ...c, serverSeq: this.seq };
      this.log.push(stored); this.seen.set(c.id, this.seq); acked.push(c.id); this.stats.applied++;
    }
    return { acked, rejected, serverCursor: String(this.seq) };
  }

  pull(deviceId: string, cursor: string | null, opts: PullOpts = {}): PullResult {
    this.rate(deviceId); this.touch(deviceId); this.stats.pulls++;
    const from = cursor ? Number(cursor) : 0;
    if (cursor && from < this.minSeq) return { changes: [], nextCursor: String(this.seq), hasMore: false, reset: true };
    const limit = Math.min(opts.limit ?? LIMITS.maxPullPage, LIMITS.maxPullPage);
    const want = opts.collections ? new Set(opts.collections) : null;
    const out: WireChange[] = [];
    let last = from;
    // il log e' ordinato per serverSeq: ricerca binaria del punto di partenza
    let lo = 0, hi = this.log.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if ((this.log[mid].serverSeq as number) <= from) lo = mid + 1; else hi = mid; }
    let i = lo;
    for (; i < this.log.length && out.length < limit; i++) {
      const c = this.log[i];
      last = c.serverSeq as number;
      if (!want || want.has(c.collection)) out.push(c);
    }
    return { changes: out.map((c) => ({ ...c })), nextCursor: String(last), hasMore: i < this.log.length };
  }

  listDevices(): DeviceInfo[] { return [...this.devices].map(([id, d]) => ({ id, name: d.name, lastSeen: d.lastSeen })); }

  deleteAll() { this.log = []; this.seen.clear(); this.minSeq = this.seq; }

  /** Dimentica le entita' eliminate da piu' del TTL (tutte le loro voci). I client con cursore piu' vecchio dovranno risincronizzare. */
  compact(): number {
    const now = this.now();
    const latest = new Map<string, WireChange>();
    for (const c of this.log) { const k = c.collection + '\u0000' + c.entityId; const p = latest.get(k); if (!p || c.hlc > p.hlc) latest.set(k, c); }
    const dead = new Set<string>();
    for (const [k, c] of latest) if (c.op === 'delete' && hlcWall(c.hlc) + this.opts.tombstoneTtlMs < now) dead.add(k);
    if (!dead.size) return 0;
    let maxRemoved = 0;
    this.log = this.log.filter((c) => { if (dead.has(c.collection + '\u0000' + c.entityId)) { maxRemoved = Math.max(maxRemoved, c.serverSeq as number); return false; } return true; });
    this.minSeq = Math.max(this.minSeq, maxRemoved);
    return dead.size;
  }
}

// ---------- transport con guasti ----------
export type Faults = {
  /** probabilita' 0..1 che la richiesta si perda prima di arrivare al server */
  dropRequest?: number;
  /** la richiesta arriva e viene applicata, ma la risposta si perde */
  dropResponse?: number;
  /** come dropResponse ma solo per il push */
  dropPushResponse?: number;
  /** la stessa richiesta di push viene consegnata due volte al server */
  duplicateDelivery?: number;
  /** il pull restituisce anche copie duplicate delle modifiche */
  duplicateResponse?: number;
  /** il pull restituisce le modifiche in ordine casuale */
  shuffle?: boolean;
  /** rete assente */
  offline?: boolean;
  /** i prossimi n tentativi falliscono */
  failNext?: number;
  /** ritardo simulato per richiesta (ms), accumulato in stats.latencyMs */
  latencyMs?: number;
  authExpired?: boolean;
};

/** PRNG deterministico (mulberry32) per test ripetibili. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class MockServerTransport implements SyncTransport {
  readonly name = 'mock-server';
  faults: Faults;
  stats = { requests: 0, failures: 0, latencyMs: 0 };
  private connected = false;
  private rnd: () => number;
  readonly auth = {
    state: (): AuthState => (this.faults.authExpired ? 'expired' : this.connected ? 'ok' : 'none'),
    signOut: async () => { this.connected = false; },
  };

  server: MockServer;
  cfg: TransportConfig;
  constructor(server: MockServer, cfg: TransportConfig, faults: Faults = {}, seed = 1) {
    this.server = server; this.cfg = cfg;
    this.faults = faults;
    this.rnd = seededRandom(seed);
  }

  async connect(cfg?: TransportConfig) {
    if (cfg) this.cfg = cfg;
    if (this.faults.offline) return { ok: false, message: 'Server non raggiungibile.' };
    this.connected = true;
    this.server.registerDevice(this.cfg.deviceId, this.cfg.deviceName);
    return { ok: true, message: 'Collegato al server finto (solo per test).' };
  }
  isConnected() { return this.connected; }

  private gate() {
    this.stats.requests++;
    const f = this.faults;
    this.stats.latencyMs += f.latencyMs ?? 0;
    if (f.authExpired) throw new TransportError('auth', 'Sessione scaduta');
    if (f.offline) { this.stats.failures++; throw new TransportError('network', 'Rete assente'); }
    if (f.failNext && f.failNext > 0) { f.failNext--; this.stats.failures++; throw new TransportError('network', 'Guasto simulato'); }
    if (f.dropRequest && this.rnd() < f.dropRequest) { this.stats.failures++; throw new TransportError('network', 'Richiesta persa'); }
  }

  async push(changes: WireChange[]): Promise<PushResult> {
    this.gate();
    const id = this.cfg.deviceId;
    const res = this.server.push(id, JSON.parse(JSON.stringify(changes)));
    if (this.faults.duplicateDelivery && this.rnd() < this.faults.duplicateDelivery) this.server.push(id, JSON.parse(JSON.stringify(changes)));
    const dr = (this.faults.dropResponse ?? 0) + (this.faults.dropPushResponse ?? 0);
    if (dr && this.rnd() < dr) { this.stats.failures++; throw new TransportError('network', 'Risposta persa'); }
    return res;
  }

  async pull(cursor: string | null, opts?: PullOpts): Promise<PullResult> {
    this.gate();
    const r = this.server.pull(this.cfg.deviceId, cursor, opts);
    if (this.faults.dropResponse && this.rnd() < this.faults.dropResponse) { this.stats.failures++; throw new TransportError('network', 'Risposta persa'); }
    let changes = r.changes;
    if (this.faults.duplicateResponse && changes.length) changes = changes.concat(changes.filter(() => this.rnd() < (this.faults.duplicateResponse as number)).map((c) => ({ ...c })));
    if (this.faults.shuffle) changes = [...changes].sort(() => this.rnd() - 0.5);
    return { ...r, changes };
  }

  async devices() { this.gate(); return this.server.listDevices().map((d) => ({ ...d, current: d.id === this.cfg.deviceId })); }
  async deleteAllData() { this.gate(); this.server.deleteAll(); }
}

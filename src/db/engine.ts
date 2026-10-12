import { checksum } from './checksum.ts';
import { prepareStored, specFor } from './migrations.ts';
import type { DbNoticeKind, KvBackend, Notify } from './types.ts';

/**
 * Engine di persistenza: sta tra zustand/persist e un KvBackend.
 *  - lettura: UNA sola query all'avvio, poi ogni store prende il suo valore dalla cache (idratazione in parallelo);
 *  - scrittura: coalescente e con debounce (un solo write per store ogni `debounceMs`, al massimo dopo `maxWaitMs`),
 *    la serializzazione JSON avviene al momento del flush (non a ogni set());
 *  - errori: mai persi in silenzio. Se un write fallisce i dati restano in memoria e si riprova con backoff;
 *  - recupero: valore illeggibile -> quarantena + ultima copia interna valida + riparazione per campo.
 */
export type StorageValueLike = { state: Record<string, unknown>; version?: number };

export type EngineOptions = {
  backend: KvBackend;
  /** esegue la migrazione dal vecchio storage prima della prima lettura */
  beforeFirstRead?: (backend: KvBackend) => Promise<void>;
  notify?: Notify;
  debounceMs?: number;
  maxWaitMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (h: unknown) => void;
  /** esegue il flush quando l'app e' libera (InteractionManager sul telefono) */
  runIdle?: (fn: () => void) => void;
  now?: () => number;
  retryDelaysMs?: number[];
};

const DISK_FULL = /SQLITE_FULL|database or disk is full|ENOSPC|no space left|QuotaExceeded|quota/i;

type Pending = { value: StorageValueLike | null };

export class KvEngine {
  readonly backend: KvBackend;
  private o: EngineOptions;
  private pending = new Map<string, Pending>();
  private cache: Record<string, string> | null = null;
  private bad = new Set<string>();
  private partial = new Set<string>();
  private flushCount = 0;
  /** checksum dell'ultimo testo noto su disco per store: evita riscritture identiche (es. subito dopo l'idratazione) */
  private known = new Map<string, string>();
  private readyP: Promise<void> | null = null;
  private readyDone = false;
  private timer: unknown = null;
  private firstPendingAt = 0;
  private flushing: Promise<void> | null = null;
  private retryIdx = 0;
  private lastNotice = new Map<string, number>();
  private epoch = 0;
  stats = { pieces: 0, serializedPieces: 0, flushes: 0, entriesWritten: 0, failures: 0, lastFlushMs: 0, lastSerializeMs: 0, lastBytes: 0, recovered: 0, quarantined: 0 };

  constructor(o: EngineOptions) { this.o = o; this.backend = o.backend; }

  private now() { return (this.o.now ?? Date.now)(); }

  private notify(kind: DbNoticeKind, level: 'info' | 'warn' | 'error', message: string, store?: string) {
    const key = kind + '|' + (store ?? '');
    const t = this.now();
    if ((this.lastNotice.get(key) ?? 0) > t - 60_000) return;
    this.lastNotice.set(key, t);
    try { this.o.notify?.({ kind, level, message, store }); } catch { /* il notificatore non deve mai rompere la persistenza */ }
  }

  /** Apre il backend, migra dal vecchio storage, carica tutto. Idempotente. */
  ready(): Promise<void> {
    if (!this.readyP) {
      this.readyP = (async () => {
        await this.backend.init();
        if (this.o.beforeFirstRead) {
          try { await this.o.beforeFirstRead(this.backend); } catch (e) {
            // una migrazione fallita non blocca l'app: riprovera' al prossimo avvio, i vecchi dati sono intatti
            this.notify('write_failed', 'warn', 'Non sono riuscito a spostare i dati nel nuovo archivio: riprovo al prossimo avvio. I tuoi dati non sono stati toccati.');
            void e;
          }
        }
        const { values, bad, partial } = await this.backend.readAll();
        this.readyDone = true;
        this.cache = values;
        for (const b of bad) this.bad.add(b);
        for (const p of partial ?? []) this.partial.add(p);
      })();
      this.readyP.catch(() => { this.readyP = null; });
    }
    return this.readyP;
  }

  // ---- lettura ----

  /** Valore di uno store pronto per zustand ({state, version}) oppure null. Non lancia mai. */
  async getItem(name: string): Promise<{ state: Record<string, unknown>; version: number } | null> {
    try { await this.ready(); } catch {
      this.notify('db_corrupt_reset', 'error', 'L\'archivio dei dati non si apre: l\'app parte con i dati vuoti ma NON sovrascrive nulla finché non lo ripari. Prova a riavviare o ripristina un backup.');
      return null;
    }
    const pend = this.pending.get(name);
    if (pend) return pend.value ? { state: pend.value.state, version: pend.value.version ?? 0 } : null;
    const raw = this.cache?.[name];
    if (this.cache) delete this.cache[name]; // libero memoria: serve una volta sola (restano i bad)
    if (raw !== undefined) this.known.set(name, checksum(raw));
    if (raw !== undefined && !this.bad.has(name)) {
      const r = this.interpret(name, raw);
      if (r.ok) {
        this.backend.noteHydrated?.(name, r.value.state);
        if (this.partial.delete(name)) this.notify('recovered_repair', 'warn', 'Alcuni dati erano illeggibili e sono stati scartati; il resto è stato mantenuto. Il contenuto scartato è conservato per la diagnosi.', name.replace(/^lp2-/, ''));
        return r.value;
      }
      await this.safeQuarantine(name, raw, r.reason);
    } else if (!this.bad.has(name)) {
      return null;
    }
    // valore corrotto: provo l'ultima copia interna valida
    if (this.bad.has(name)) { this.bad.delete(name); }
    try {
      const bak = await this.backend.readBackup(name);
      if (bak) {
        const r = this.interpret(name, bak);
        if (r.ok) {
          this.stats.recovered++;
          this.notify('recovered_backup', 'warn', 'Un archivio era danneggiato: ho ripristinato l\'ultima copia valida. Potresti aver perso le modifiche più recenti di quella sezione.', name.replace(/^lp2-/, ''));
          this.set(name, r.value);
          this.backend.noteHydrated?.(name, r.value.state);
          return r.value;
        }
      }
    } catch { /* ignore */ }
    this.notify('quarantined', 'error', 'Una sezione dei dati era danneggiata e non recuperabile: l\'ho messa da parte per la diagnosi e riparto da zero per quella sezione. Se hai un backup, ripristinalo da Sicurezza.', name.replace(/^lp2-/, ''));
    return null;
  }

  private interpret(name: string, raw: string): { ok: true; value: { state: Record<string, unknown>; version: number } } | { ok: false; reason: string } {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return { ok: false, reason: 'JSON non valido' }; }
    const prep = prepareStored(name, parsed);
    if (!prep.ok) return { ok: false, reason: prep.reason };
    if (prep.report.dropped.length || prep.report.filtered) {
      // riparato: salvo il blob originale in quarantena per diagnosi e tengo i campi validi
      void this.safeQuarantine(name, raw, `riparato: campi scartati [${prep.report.dropped.join(',')}], elementi scartati ${prep.report.filtered}`);
      this.stats.recovered++;
      this.notify('recovered_repair', 'warn', 'Alcuni dati non erano validi e sono stati scartati; il resto è stato mantenuto. Il vecchio contenuto è conservato per la diagnosi.', name.replace(/^lp2-/, ''));
      this.set(name, prep.value); // riscrivo la versione pulita
    } else if (prep.migratedFrom !== undefined) {
      this.set(name, prep.value); // riscrivo alla versione di schema corrente
    }
    if (prep.future) this.notify('future_version', 'warn', 'Questi dati sono stati salvati da una versione più recente di LifePilot. Li uso così come sono, ma aggiorna l\'app per evitare problemi.', name.replace(/^lp2-/, ''));
    return { ok: true, value: prep.value };
  }

  private async safeQuarantine(name: string, raw: string, reason: string) {
    this.stats.quarantined++;
    try { await this.backend.quarantine(name, raw, reason); } catch { /* disco pieno: pazienza, il blob resta nella cache fino al riavvio */ }
  }

  // ---- scrittura ----

  /** Chiamata da zustand a ogni modifica: sincrona e leggera. */
  set(name: string, value: StorageValueLike) {
    this.pending.set(name, { value });
    this.schedule();
  }

  remove(name: string) {
    this.pending.set(name, { value: null });
    this.schedule();
  }

  private schedule() {
    const setT = this.o.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    const clrT = this.o.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
    const debounce = this.o.debounceMs ?? 400;
    const maxWait = this.o.maxWaitMs ?? 3000;
    const t = this.now();
    if (!this.firstPendingAt) this.firstPendingAt = t;
    if (this.timer !== null) clrT(this.timer);
    const wait = Math.max(0, Math.min(debounce, this.firstPendingAt + maxWait - t));
    this.timer = setT(() => {
      this.timer = null;
      const run = () => { void this.flush(); };
      if (this.o.runIdle) this.o.runIdle(run); else run();
    }, wait);
  }

  /** Scrive subito tutto quello che e' in attesa (chiamare quando l'app va in background). */
  flush(opts: { full?: boolean } = {}): Promise<void> {
    const clrT = this.o.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
    if (this.timer !== null) { clrT(this.timer); this.timer = null; }
    const run = async () => {
      if (this.flushing) await this.flushing.catch(() => undefined);
      if (!this.pending.size) { this.firstPendingAt = 0; return; }
      // se gia' pronto non cedo il controllo: alla chiusura della pagina (web) la scrittura deve partire subito
      if (!this.readyDone) await this.ready().catch(() => undefined);
      const epoch = this.epoch;
      const batch = this.pending;
      this.pending = new Map();
      this.firstPendingAt = 0;
      const t0 = this.now();
      const entries: Record<string, string> = {};
      const versions: Record<string, number> = {};
      const shardedItems: { name: string; state: Record<string, unknown>; version: number }[] = [];
      const removals: string[] = [];
      const sums: Record<string, string> = {};
      let bytes = 0;
      for (const [name, p] of batch) {
        if (!p.value) { removals.push(name); continue; }
        if (this.backend.writeStores && this.backend.isSharded?.(name)) { shardedItems.push({ name, state: p.value.state, version: p.value.version ?? specFor(name).version }); bytes += 1; continue; }
        try {
          const s = JSON.stringify({ state: p.value.state, version: p.value.version ?? specFor(name).version });
          const sum = checksum(s);
          if (this.known.get(name) === sum) continue; // identico a quello gia' su disco
          entries[name] = s; versions[name] = p.value.version ?? specFor(name).version; bytes += s.length; sums[name] = sum;
        } catch {
          this.notify('write_failed', 'error', 'Una sezione dei dati non si può salvare (contenuto non serializzabile).', name.replace(/^lp2-/, ''));
        }
      }
      this.stats.lastSerializeMs = this.now() - t0;
      try {
        if (epoch !== this.epoch) return; // nel frattempo "Elimina tutti i dati": non riscrivo
        this.flushCount++;
        // rete di sicurezza contro mutazioni "sul posto" che non cambiano il riferimento: verifica completa quando l'app va in background e ogni tanto
        const verify = !!opts.full || this.flushCount % 25 === 0;
        if (shardedItems.length) { const r = await this.backend.writeStores!(shardedItems, { verify }); this.stats.pieces = r.pieces; this.stats.serializedPieces = r.serialized; }
        if (Object.keys(entries).length) await this.backend.writeMany(entries, versions);
        if (removals.length) await this.backend.remove(removals);
        this.stats.flushes++; this.stats.entriesWritten += Object.keys(entries).length + shardedItems.length; this.stats.lastBytes = bytes; this.stats.lastFlushMs = this.now() - t0;
        for (const [n, sum] of Object.entries(sums)) this.known.set(n, sum);
        for (const n of removals) this.known.delete(n);
        this.retryIdx = 0;
      } catch (e) {
        this.stats.failures++;
        // niente perso: rimetto in coda cio' che non e' stato nel frattempo sostituito da una versione piu' nuova
        for (const [name, p] of batch) if (!this.pending.has(name)) this.pending.set(name, p);
        const msg = e instanceof Error ? e.message : String(e);
        if (DISK_FULL.test(msg)) this.notify('disk_full', 'error', 'Spazio esaurito sul telefono: le ultime modifiche non sono state salvate. Libera spazio (Sicurezza > Spazio occupato) e riproverò da solo.');
        else this.notify('write_failed', 'error', 'Non riesco a salvare le ultime modifiche. Le tengo in memoria e riprovo: non chiudere l\'app finché non torna normale.');
        const delays = this.o.retryDelaysMs ?? [2000, 5000, 15000, 60000];
        const d = delays[Math.min(this.retryIdx++, delays.length - 1)];
        const setT = this.o.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
        if (this.timer === null) this.timer = setT(() => { this.timer = null; void this.flush(); }, d);
      }
    };
    const p = run().finally(() => { if (this.flushing === p) this.flushing = null; });
    this.flushing = p;
    return p;
  }

  hasPending() { return this.pending.size > 0; }
  pendingCount() { return this.pending.size; }

  // ---- operazioni di servizio ----

  /** Tutti i dati correnti (JSON per store), inclusi quelli non ancora scritti. Per backup e ricerca. */
  async snapshot(): Promise<Record<string, string>> {
    await this.flush();
    await this.ready();
    return (await this.backend.readAll()).values;
  }

  /** Sostituisce TUTTI i dati (ripristino da backup). Scrive subito e invalida la cache. */
  async replaceAll(entries: Record<string, string>, versions: Record<string, number> = {}) {
    await this.flush();
    await this.ready();
    this.epoch++;
    this.pending = new Map();
    const { values } = await this.backend.readAll();
    const stale = Object.keys(values).filter((k) => !(k in entries));
    if (stale.length) await this.backend.remove(stale);
    await this.backend.writeMany(entries, versions);
    this.known.clear();
    this.cache = (await this.backend.readAll()).values;
  }

  /** Cancella tutto (Elimina tutti i dati). Scarta anche le scritture in attesa. */
  async clearAll() {
    this.epoch++;
    this.pending = new Map();
    const clrT = this.o.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
    if (this.timer !== null) { clrT(this.timer); this.timer = null; }
    await this.ready().catch(() => undefined);
    await this.backend.clear();
    this.cache = {};
    this.bad.clear();
    this.known.clear();
  }

  /** Ricarica la cache dal disco (dopo un ripristino, prima di `persist.rehydrate()`). */
  async reloadCache() {
    await this.ready();
    const { values, bad } = await this.backend.readAll();
    this.cache = values; this.bad = new Set(bad); this.known.clear(); this.partial.clear();
  }
}

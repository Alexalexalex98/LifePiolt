/**
 * Interfaccia verso il server. L'engine non sa nulla di Supabase o di HTTP: parla solo con un SyncTransport.
 * Oggi esistono: DisconnectedTransport (predefinito, non fa nulla) e MockServerTransport (src/sync/mockServer.ts, per i test).
 * Il transport reale (es. Supabase) si registra con registerTransport(nome, factory) senza toccare il resto.
 */
import type { DeviceInfo, WireChange } from './types.ts';

export type AuthState = 'none' | 'ok' | 'expired';
export type RejectReason = 'invalid' | 'too-large' | 'forbidden' | 'schema' | 'duplicate-device' | 'quota';

export type PushResult = {
  /** changeId accettati (anche quelli gia' noti: l'invio e' idempotente) */
  acked: string[];
  rejected: { id: string; reason: RejectReason; retryable: boolean }[];
  serverCursor: string;
};
export type PullResult = {
  changes: WireChange[];
  nextCursor: string;
  hasMore: boolean;
  /** il cursore e' piu' vecchio della memoria del server (tombstone dimenticate): serve una risincronizzazione completa */
  reset?: boolean;
};
export type PullOpts = { limit?: number; collections?: string[] };

export type TransportErrorKind = 'network' | 'auth' | 'rate-limit' | 'server' | 'unavailable';
export class TransportError extends Error {
  kind: TransportErrorKind;
  retryAfterMs?: number;
  constructor(kind: TransportErrorKind, message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'TransportError';
    this.kind = kind; this.retryAfterMs = retryAfterMs;
  }
}

export type TransportConfig = {
  url?: string;
  /** chiave pubblica (anon key): NON e' un segreto, ma sta comunque nel portachiavi */
  anonKey?: string;
  deviceId: string;
  deviceName: string;
};

export interface SyncTransport {
  readonly name: string;
  readonly auth: {
    state(): AuthState;
    signIn?(credentials: Record<string, string>): Promise<void>;
    signOut?(): Promise<void>;
  };
  connect(cfg: TransportConfig): Promise<{ ok: boolean; message: string }>;
  isConnected(): boolean;
  push(changes: WireChange[]): Promise<PushResult>;
  pull(cursor: string | null, opts?: PullOpts): Promise<PullResult>;
  /** elenco dei dispositivi dell'account (nome, ultimo accesso: lo sa solo il server) */
  devices?(): Promise<DeviceInfo[]>;
  /** cancella dal server tutti i dati sincronizzati di questo account */
  deleteAllData?(): Promise<void>;
}

/** Nessun server collegato: ogni operazione dice la verita'. */
export class DisconnectedTransport implements SyncTransport {
  readonly name = 'disconnected';
  readonly auth = { state: (): AuthState => 'none' };
  async connect() { return { ok: false, message: 'Nessun server collegato: la sincronizzazione si attiva quando colleghi un server.' }; }
  isConnected() { return false; }
  async push(): Promise<PushResult> { throw new TransportError('unavailable', 'Nessun server collegato'); }
  async pull(): Promise<PullResult> { throw new TransportError('unavailable', 'Nessun server collegato'); }
}

type Factory = (cfg: TransportConfig) => SyncTransport;
const factories = new Map<string, Factory>();
export function registerTransport(name: string, factory: Factory) { factories.set(name, factory); }
export function unregisterTransport(name: string) { factories.delete(name); }
export function listTransports(): string[] { return [...factories.keys()]; }
export function createTransport(name: string, cfg: TransportConfig): SyncTransport {
  const f = factories.get(name);
  return f ? f(cfg) : new DisconnectedTransport();
}

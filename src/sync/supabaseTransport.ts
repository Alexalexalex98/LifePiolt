/**
 * Transport reale verso Supabase (piano gratuito). Parla solo con le funzioni SQL di supabase/migrations/0002
 * (sync_push, sync_pull, sync_delete_all): il merge resta sul telefono, il server conserva e smista.
 * Modulo puro: il client si riceve da fuori (vedi bindings.ts), cosi' si prova con un finto.
 */
import { TransportError, type AuthState, type PullOpts, type PullResult, type PushResult, type SyncTransport, type TransportConfig } from './transport.ts';
import type { DeviceInfo, WireChange } from './types.ts';

type Res<T = unknown> = { data: T | null; error: { message?: string; code?: string; status?: number; details?: string } | null; status?: number };
export type SupabaseLike = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<Res>;
  from(table: string): { select(cols: string): PromiseLike<Res<Record<string, unknown>[]>> };
  auth: {
    getSession(): Promise<{ data: { session: { user?: { email?: string } } | null } }>;
    signInWithOtp(a: { email: string; options?: Record<string, unknown> }): PromiseLike<Res>;
    verifyOtp(a: { email: string; token: string; type: 'email' }): PromiseLike<Res>;
    signOut(): PromiseLike<unknown>;
  };
};

const retryAfter = (d: unknown): number | undefined => { const r = (d as { retry_after?: number } | null)?.retry_after; return typeof r === 'number' ? r * 1000 : undefined; };

/** Traduce gli errori di rete e di PostgREST negli errori del motore (rete e server si ritentano, auth no). */
export function mapError(e: NonNullable<Res['error']> | unknown, data?: unknown): TransportError {
  const x = (e ?? {}) as { message?: string; code?: string; status?: number };
  const st = x.status ?? 0; const code = x.code ?? '';
  if ((data as { error?: string } | null)?.error === 'rate_limited' || st === 429) return new TransportError('rate-limit', 'Troppe richieste: riprovo tra poco', retryAfter(data) ?? 60000);
  if (code === 'PT401' || st === 401 || st === 403 || /jwt|unauthorized/i.test(x.message ?? '')) return new TransportError('auth', 'Accesso scaduto: accedi di nuovo');
  if (code === 'PT413' || code === 'PT400') return new TransportError('server', x.message || 'Richiesta rifiutata dal server');
  if (st === 0 && /fetch|network|failed|timeout/i.test(x.message ?? '')) return new TransportError('network', 'Nessuna connessione');
  if (st >= 500 || code === 'PGRST002') return new TransportError('unavailable', 'Server non disponibile (potrebbe essere in pausa: riprova tra un minuto)');
  return new TransportError('server', x.message || 'Errore del server');
}

export class SupabaseTransport implements SyncTransport {
  readonly name = 'supabase';
  private email: string | null = null;
  private authState: AuthState = 'none';
  private connected = false;
  private cfg: TransportConfig;
  private client: SupabaseLike;
  private platform: string;
  constructor(client: SupabaseLike, cfg: TransportConfig, platform = 'app') { this.client = client; this.cfg = cfg; this.platform = platform; }

  readonly auth = {
    state: (): AuthState => this.authState,
    /** `{email}` invia il codice a 6 cifre; `{email, token}` lo verifica e apre la sessione. */
    signIn: async (c: Record<string, string>): Promise<void> => {
      const email = (c.email ?? '').trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new TransportError('auth', 'Scrivi un indirizzo email valido');
      if (!c.token) {
        const r = await this.client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
        if (r.error) throw r.error.status === 429 ? new TransportError('rate-limit', 'Hai chiesto troppi codici: aspetta un minuto', 60000) : new TransportError('network', r.error.message || 'Non riesco a inviare il codice');
        return;
      }
      const r = await this.client.auth.verifyOtp({ email, token: c.token.trim(), type: 'email' });
      if (r.error) throw new TransportError('auth', 'Codice non valido o scaduto');
      this.email = email; this.authState = 'ok';
    },
    signOut: async (): Promise<void> => { await this.client.auth.signOut(); this.authState = 'none'; this.email = null; this.connected = false; },
  };
  account(): string | null { return this.email; }

  async connect(cfg?: TransportConfig): Promise<{ ok: boolean; message: string }> {
    if (cfg) this.cfg = cfg;
    if (!this.cfg.url || !this.cfg.anonKey) return { ok: false, message: 'Inserisci indirizzo e chiave pubblica del server.' };
    try {
      const { data } = await this.client.auth.getSession();
      if (!data.session) { this.authState = 'none'; this.connected = false; return { ok: false, message: 'Server raggiunto: accedi con la tua email per sincronizzare.' }; }
      this.email = data.session.user?.email ?? null; this.authState = 'ok'; this.connected = true;
      return { ok: true, message: 'Collegato al server.' };
    } catch (e) { return { ok: false, message: mapError(e).message }; }
  }
  isConnected() { return this.connected && this.authState === 'ok'; }

  private async call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    if (this.authState !== 'ok') throw new TransportError('auth', 'Accedi per sincronizzare');
    let r: Res;
    try { r = await this.client.rpc(fn, args); } catch (e) { throw mapError(e); }
    if (r.error || (r.data as { error?: string } | null)?.error) {
      const err = mapError(r.error ?? { status: r.status }, r.data);
      if (err.kind === 'auth') this.authState = 'expired';
      throw err;
    }
    return r.data as T;
  }

  /** Chiamata a una funzione del server con la sessione dell'utente (account_save, account_get): niente di generico, il nome lo decide l'app. */
  async rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> { return this.call<T>(fn, args); }

  async push(changes: WireChange[]): Promise<PushResult> {
    const d = await this.call<PushResult>('sync_push', { batch: { v: 1, deviceId: this.cfg.deviceId, deviceName: this.cfg.deviceName, platform: this.platform, changes } });
    return { acked: d.acked ?? [], rejected: d.rejected ?? [], serverCursor: String(d.serverCursor ?? '0') };
  }
  async pull(cursor: string | null, opts: PullOpts = {}): Promise<PullResult> {
    const d = await this.call<PullResult>('sync_pull', { p_cursor: cursor ? Number(cursor) : null, p_limit: opts.limit ?? 500, p_collections: opts.collections ?? null, p_device: this.cfg.deviceId });
    return { changes: d.changes ?? [], nextCursor: String(d.nextCursor ?? cursor ?? '0'), hasMore: !!d.hasMore, ...(d.reset ? { reset: true } : {}) };
  }
  async devices(): Promise<DeviceInfo[]> {
    const r = await this.client.from('devices').select('id,nome,ultimo_accesso');
    if (r.error) throw mapError(r.error);
    return (r.data ?? []).map((x) => ({ id: String(x.id), name: String(x.nome ?? x.id), lastSeen: Date.parse(String(x.ultimo_accesso)) || 0, current: x.id === this.cfg.deviceId }));
  }
  async deleteAllData(): Promise<void> { await this.call('sync_delete_all', {}); }
}

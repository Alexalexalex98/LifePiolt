import type { ProxyRequest, ProxyResponse, ServerProxyClient } from '../types.ts';

/**
 * L'app NON chiama mai i fornitori (OpenAI, Anthropic, Google, Suno...) e non contiene chiavi API.
 * Parla solo con il NOSTRO server: POST {baseUrl}/v1/ai/route con il token dell'utente. Le chiavi stanno solo sul server.
 */
export class NotConnectedClient implements ServerProxyClient {
  isConfigured() { return false; }
  async route(_req: ProxyRequest): Promise<ProxyResponse> {
    void _req;
    return { ok: false, error: { code: 'not_connected', message: 'Il server delle AI non è ancora collegato.' } };
  }
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export class HttpProxyClient implements ServerProxyClient {
  constructor(private baseUrl: string, private getToken: () => string | null, private fetchImpl: FetchLike) {}
  isConfigured() { return !!this.baseUrl && !!this.getToken(); }
  async route(req: ProxyRequest): Promise<ProxyResponse> {
    const token = this.getToken();
    if (!this.baseUrl || !token) return { ok: false, error: { code: 'not_connected', message: 'Il server delle AI non è ancora collegato.' } };
    try {
      const res = await this.fetchImpl(`${this.baseUrl.replace(/\/+$/, '')}/v1/ai/route`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(req) });
      const body = (await res.json()) as ProxyResponse;
      if (!res.ok && !body?.error) return { ok: false, error: { code: res.status === 401 ? 'unauthorized' : res.status === 429 ? 'rate_limited' : 'provider_down', message: `Errore ${res.status}` } };
      return body;
    } catch {
      return { ok: false, error: { code: 'provider_down', message: 'Non riesco a raggiungere il server.' } };
    }
  }
}

/** Con baseUrl vuoto restituisce il client "non collegato". */
export function createProxyClient(opts: { baseUrl?: string; getToken?: () => string | null; fetchImpl?: FetchLike }): ServerProxyClient {
  if (!opts.baseUrl || !opts.fetchImpl) return new NotConnectedClient();
  return new HttpProxyClient(opts.baseUrl, opts.getToken ?? (() => null), opts.fetchImpl);
}

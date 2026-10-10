import type { ProxyRequest, ProxyResponse, ServerProxyClient } from '../types.ts';

/** Client finto per i test: risposte e errori scriptati per fornitore, registra le chiamate. */
export class MockProxyClient implements ServerProxyClient {
  calls: ProxyRequest[] = [];
  private script: Record<string, ProxyResponse | ((r: ProxyRequest) => ProxyResponse)>;
  private configured: boolean;
  constructor(script: Record<string, ProxyResponse | ((r: ProxyRequest) => ProxyResponse)> = {}, configured = true) { this.script = script; this.configured = configured; }
  isConfigured() { return this.configured; }
  async route(req: ProxyRequest): Promise<ProxyResponse> {
    this.calls.push(req);
    const s = this.script[req.kind === 'rewrite' ? 'rewrite' : req.provider];
    if (!s) return { ok: true, text: `risposta di ${req.provider}`, usage: { tokensIn: 100, tokensOut: 100, units: 1, cost: 0.01 } };
    return typeof s === 'function' ? s(req) : s;
  }
}

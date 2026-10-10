import type { ProxyRequest, ProxyResponse, ServerProxyClient } from '../types.ts';

export type AdapterOutcome = { type: 'ok'; res: ProxyResponse } | { type: 'retry'; message: string } | { type: 'fail'; message: string; code: string };

/** Chiama il server e classifica l'esito: 'retry' = vale la pena provare il fornitore successivo. */
export async function callProvider(client: ServerProxyClient, req: ProxyRequest): Promise<AdapterOutcome> {
  let res: ProxyResponse;
  try { res = await client.route(req); } catch (e) { return { type: 'retry', message: e instanceof Error ? e.message : 'errore' }; }
  if (res.ok) return { type: 'ok', res };
  const code = res.error?.code ?? 'provider_down';
  const message = res.error?.message ?? 'Errore sconosciuto';
  if (code === 'provider_down' || code === 'rate_limited') return { type: 'retry', message };
  return { type: 'fail', message, code };
}

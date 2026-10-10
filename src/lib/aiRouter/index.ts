/**
 * Router AI di Theia. Contratto con l'assistente (non cambiare le firme).
 * Theia NON pensa, DELEGA: cio' che si fa in locale resta in locale; si delega solo cio' che serve davvero a un altro modello,
 * dopo limiti, privacy, riscrittura fedele e consenso. Oggi nessun fornitore e' collegato: la risposta e' 'not_connected' con anteprima onesta.
 * Risultati speciali: kind 'local' (lo gestisce l'assistente sul telefono) e kind 'clarify' (status 'answered', domanda in message e opzioni in text, una per riga).
 */
import { routeWithRuntime } from './runtime.ts';
import type { RouteRequest, RouteResult } from './types.ts';

export type { RouteImage, RouteRequest, RouteResult } from './types.ts';

export async function routeRequest(req: RouteRequest): Promise<RouteResult> {
  return routeWithRuntime(req);
}

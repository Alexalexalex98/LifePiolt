/**
 * Event bus di dominio: sincrono, tipizzato, con handler registrati per modulo.
 * Modulo PURO (nessun import di react-native o alias '@/'): testabile con node.
 *
 * Regole:
 *  - `emit` chiama gli handler nell'ordine (order crescente, poi di registrazione); un handler che lancia (o la cui promise
 *    viene rifiutata) NON ferma gli altri: l'errore va al sink (log) e l'emissione continua;
 *  - gli handler si registrano da src/domain/handlers.ts (caricato all'avvio): gli store e le funzioni di dominio non importano
 *    mai gli handler, quindi non ci sono cicli di import;
 *  - i nomi eventi sono "<soggetto>.<verbo al passato>".
 */

export type DomainEvents = {
  'bill.created': { id: string };
  'bill.paid': { id: string; fullyPaid: boolean; recorded: boolean };
  'bill.reopened': { id: string };
  'bill.deleted': { id: string };
  'event.added': { day: string; title?: string; ref?: string };
  'event.updated': { day: string; title?: string; ref?: string };
  'event.removed': { day: string; title?: string; ref?: string };
  'task.completed': { id: string };
  'goal.progressed': { id: string; pct?: number };
  'booking.confirmed': { id: string; kind: 'seminar' | 'service'; title: string; host: string; price: number; startsAt: number; restored?: boolean };
  'booking.cancelled': { id: string; kind: 'seminar' | 'service'; title: string };
  'booking.attended': { id: string; kind: 'seminar' | 'service'; title: string; host: string; price: number };
  'interview.accepted': { appId: string };
  'club.subscribed': { clubId: string; clubName: string; tier: 'follower' | 'free' | 'premium' };
  'mood.logged': { mood: string };
  'location.habit.detected': { place: string; kind: string };
  /** Cambio di fuso orario, ora legale o orologio: le notifiche programmate vanno ricalcolate. */
  'clock.changed': { reason: 'timezone' | 'dst' | 'manual' | 'unknown' };
  /** L'app torna in primo piano o un task in background e' partito: manutenzione periodica. */
  'maintenance.due': { source: 'foreground' | 'background' | 'boot' };
};

export type EventName = keyof DomainEvents;
export type Handler<E extends EventName> = (payload: DomainEvents[E], ctx: { event: E; module: string }) => void | Promise<void>;

export type ErrorSink = (error: unknown, where: { event: string; module: string; handler: string }) => void;

type Entry = { module: string; name: string; order: number; seq: number; fn: Handler<never> };
export type EmitReport = { event: string; delivered: number; failed: number };

const MAX_DEPTH = 8;
let seq = 0;
let depth = 0;
const table = new Map<string, Entry[]>();
const modules = new Set<string>();
let sink: ErrorSink = () => undefined;

/** Dove finiscono gli errori degli handler (in app: il log). Non deve lanciare. */
export function setErrorSink(fn: ErrorSink) { sink = fn; }

function report(error: unknown, where: { event: string; module: string; handler: string }) {
  try { sink(error, where); } catch { /* il sink non deve rompere l'emissione */ }
}

/** Registra un handler. `order` piu' basso = prima (default 100). Restituisce la funzione per toglierlo. */
export function on<E extends EventName>(event: E, module: string, fn: Handler<E>, opts: { order?: number; name?: string } = {}): () => void {
  const e: Entry = { module, name: opts.name || fn.name || 'handler', order: opts.order ?? 100, seq: seq++, fn: fn as unknown as Handler<never> };
  const list = table.get(event) ?? [];
  list.push(e);
  list.sort((a, b) => a.order - b.order || a.seq - b.seq);
  table.set(event, list);
  return () => { const l = table.get(event); if (l) table.set(event, l.filter((x) => x !== e)); };
}

/** Registra un modulo di handler UNA volta sola (idempotente: sicuro con ricaricamenti a caldo). Ritorna true se l'ha eseguito. */
export function registerModule(name: string, setup: () => void): boolean {
  if (modules.has(name)) return false;
  modules.add(name);
  try { setup(); } catch (e) { report(e, { event: '(setup)', module: name, handler: 'registerModule' }); }
  return true;
}

export const handlerCount = (event?: EventName) => (event ? table.get(event)?.length ?? 0 : [...table.values()].reduce((n, l) => n + l.length, 0));
export const handlersOf = (event: EventName) => (table.get(event) ?? []).map((h) => `${h.module}:${h.name}`);
export const registeredModules = () => [...modules];

/** Solo per i test. */
export function resetBus() { table.clear(); modules.clear(); depth = 0; seq = 0; sink = () => undefined; }

/**
 * Emette un evento in modo sincrono. Gli handler async partono subito: la loro promise e' agganciata al sink
 * (un rifiuto non e' mai "non gestito"). Profondita' massima 8 (un handler che riemette in loop viene interrotto e segnalato).
 */
export function emit<E extends EventName>(event: E, payload: DomainEvents[E]): EmitReport {
  const rep: EmitReport = { event, delivered: 0, failed: 0 };
  if (depth >= MAX_DEPTH) {
    report(new Error('Troppi eventi annidati'), { event, module: '(bus)', handler: 'emit' });
    rep.failed = 1;
    return rep;
  }
  const list = table.get(event);
  if (!list || !list.length) return rep;
  depth++;
  try {
    for (const h of list.slice()) {
      const where = { event, module: h.module, handler: h.name };
      try {
        const r = (h.fn as unknown as Handler<E>)(payload, { event, module: h.module }) as unknown;
        if (r && typeof (r as Promise<void>).then === 'function') {
          (r as Promise<void>).then(undefined, (err: unknown) => report(err, where));
        }
        rep.delivered++;
      } catch (err) {
        rep.failed++;
        report(err, where);
      }
    }
  } finally { depth--; }
  return rep;
}

/**
 * Operazioni composte con SNAPSHOT/ROLLBACK semplice su piu' store.
 * Modulo PURO: gli store si registrano per nome (registerStore) e devono solo avere getState/setState (come zustand).
 *
 *   runOperation('bill.pay', [
 *     { name: 'bolletta', stores: ['fin'], run: (c) => c.set('tok', fin.markInvoicePaid(...)) },
 *     { name: 'calendario', stores: ['life'], run: () => removeBillFromCalendar(id) },
 *   ], { key: 'bill.pay:42', events: (c) => [['bill.paid', {...}]] });
 *
 *  - prima del primo passo che tocca uno store ne salva lo stato; se un passo lancia, gli store toccati tornano com'erano
 *    (setState dallo snapshot) e l'errore e' riportato con il nome del passo;
 *  - gli eventi di dominio si emettono SOLO dopo il successo (un rollback non lascia effetti collaterali);
 *  - `key` rende l'operazione idempotente: una seconda esecuzione con la stessa chiave non rifa nulla (skipped).
 */
import { emit, type DomainEvents, type EventName } from './events.ts';

export type StoreLike = { getState: () => unknown; setState: (partial: never, replace?: boolean) => void };

const stores = new Map<string, StoreLike>();
/** Accetta qualunque store zustand (tipi di setState troppo diversi per un'unica firma): vengono usati solo getState/setState. */
export function registerStore(name: string, store: unknown) { stores.set(name, store as StoreLike); }
export const registeredStores = () => [...stores.keys()];
export function resetOperations() { stores.clear(); done.clear(); running.clear(); onOpError = () => undefined; }

export type OpContext = { get: <T = unknown>(key: string) => T | undefined; set: (key: string, value: unknown) => void };
export type Step = { name: string; stores?: string[] | '*'; run: (ctx: OpContext) => void };
export type EventSpec = { [E in EventName]: [E, DomainEvents[E]] }[EventName];
export type OpOptions = {
  /** chiave di idempotenza: se gia' completata con successo, l'operazione non viene rieseguita */
  key?: string;
  /** eventi da emettere dopo il successo */
  events?: (ctx: OpContext) => EventSpec[];
};
export type OpResult<T = Record<string, unknown>> =
  | { ok: true; skipped: boolean; value: T }
  | { ok: false; error: string; failedStep: string; rolledBack: string[] };

let onOpError: (name: string, step: string, error: unknown, rolledBack: string[]) => void = () => undefined;
/** In app: scrive nel log gli errori delle operazioni. */
export function setOperationErrorSink(fn: typeof onOpError) { onOpError = fn; }

const done = new Map<string, number>();
const running = new Set<string>();
const DONE_MAX = 300;

export const isDone = (key: string) => done.has(key);
export const forgetKey = (key: string) => { done.delete(key); };

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

export function runOperation<T = Record<string, unknown>>(name: string, steps: Step[], opts: OpOptions = {}): OpResult<T> {
  const key = opts.key;
  if (key) {
    if (done.has(key)) return { ok: true, skipped: true, value: {} as T };
    if (running.has(key)) return { ok: true, skipped: true, value: {} as T };
    running.add(key);
  }
  const bag: Record<string, unknown> = {};
  const ctx: OpContext = { get: <V,>(k: string) => bag[k] as V | undefined, set: (k, v) => { bag[k] = v; } };
  const snaps = new Map<string, unknown>();
  const snapshot = (names: string[]) => {
    for (const n of names) {
      if (snaps.has(n)) continue;
      const s = stores.get(n);
      if (!s) throw new Error(`Store non registrato: ${n}`);
      snaps.set(n, s.getState());
    }
  };
  try {
    for (const st of steps) {
      try {
        snapshot(st.stores === '*' ? [...stores.keys()] : st.stores ?? []);
        st.run(ctx);
      } catch (err) {
        const rolledBack: string[] = [];
        for (const n of [...snaps.keys()].reverse()) {
          try { stores.get(n)!.setState(snaps.get(n) as never, true); rolledBack.push(n); } catch (e2) { onOpError(name, `rollback:${n}`, e2, rolledBack); }
        }
        onOpError(name, st.name, err, rolledBack);
        return { ok: false, error: msg(err), failedStep: st.name, rolledBack };
      }
    }
    if (key) { done.set(key, Date.now()); if (done.size > DONE_MAX) done.delete(done.keys().next().value as string); }
    if (opts.events) {
      let list: EventSpec[] = [];
      try { list = opts.events(ctx); } catch (e) { onOpError(name, 'events', e, []); }
      for (const [ev, payload] of list) emit(ev as EventName, payload as never);
    }
    return { ok: true, skipped: false, value: bag as T };
  } finally {
    if (key) running.delete(key);
  }
}

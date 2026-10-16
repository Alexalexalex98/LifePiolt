/** Doppio tocco sull'icona della sezione in cui sei: la pagina torna in cima e si aggiorna. Le pagine si iscrivono qui. */
const subs = new Map<string, Set<() => void>>();
const norm = (id: string) => (id === 'index' ? 'home' : id);
export function onPageRefresh(id: string, fn: () => void): () => void {
  const k = norm(id);
  const set = subs.get(k) ?? new Set();
  set.add(fn); subs.set(k, set);
  return () => { set.delete(fn); };
}
export function triggerPageRefresh(id: string): boolean {
  const set = subs.get(norm(id));
  if (!set || !set.size) return false;
  set.forEach((fn) => fn());
  return true;
}
/** Due tocchi ravvicinati (entro `ms`) contano come doppio tocco. */
export const isDoubleTap = (last: number, now: number, ms = 350) => last > 0 && now - last <= ms;

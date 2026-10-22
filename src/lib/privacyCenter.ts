/**
 * Centro Privacy: le categorie di dati dell'app, il consenso per ciascuna (per mandarla all'AI esterna) e la logica pura per decidere cosa esce.
 * Base: GDPR (UE) e nLPD (Svizzera): consenso specifico, informato, revocabile e dimostrabile (registro delle scelte).
 */
export type Mode = 'ask' | 'always' | 'never';
export type CatId = 'agenda' | 'finance' | 'health' | 'fitness' | 'travel' | 'network';
export const CATS: { id: CatId; label: string; what: string; special?: boolean }[] = [
  { id: 'agenda', label: 'Agenda, task e note', what: 'task, impegni, note, obiettivi, nomi dei file, turni' },
  { id: 'finance', label: 'Finanze', what: 'estratto conto, movimenti, budget, bollette, tasse, investimenti, LifePoints', special: true },
  { id: 'health', label: 'Salute e umore', what: 'sonno, passi, umore, allenamenti registrati, sedute di mente', special: true },
  { id: 'fitness', label: 'Fitness e cibo', what: 'programmi, peso, pasti, frigo, piano alimentare', special: true },
  { id: 'travel', label: 'Viaggi', what: 'città, hotel, itinerari salvati, budget di viaggio' },
  { id: 'network', label: 'LifeNetwork', what: 'post, prenotazioni, seminari, profilo, notifiche' },
];

export const modeOf = (m: Record<string, Mode | undefined> | undefined, cat: string): Mode => m?.[cat] ?? 'ask';

/** Divide le categorie volute in: da mandare subito, da chiedere, bloccate. Funzione pura. */
export function gate(cats: string[], modes: Record<string, Mode | undefined> | undefined): { send: string[]; ask: string[]; blocked: string[] } {
  const r = { send: [] as string[], ask: [] as string[], blocked: [] as string[] };
  for (const c of new Set(cats)) { const m = modeOf(modes, c); (m === 'always' ? r.send : m === 'never' ? r.blocked : r.ask).push(c); }
  return r;
}

export type ConsentEntry = { ts: number; cat: string; mode: Mode | 'file'; note?: string };
/** Registro delle scelte (per poter dimostrare quando e cosa hai deciso): tiene le ultime 200. */
export const pushConsent = (log: ConsentEntry[] | undefined, e: ConsentEntry): ConsentEntry[] => [...(log ?? []), e].slice(-200);

export const labelOf = (id: string) => CATS.find((c) => c.id === id)?.label ?? id;

/** JSON di una parte dell'app per l'esportazione: senza funzioni e senza file incorporati troppo grandi. */
export const exportJson = (state: unknown): string => JSON.stringify(state, (_k, v) => (typeof v === 'function' ? undefined : typeof v === 'string' && v.startsWith('data:') && v.length > 2000 ? '[file non incluso]' : v), 2);

/**
 * Hybrid Logical Clock (HLC): orologio logico ibrido che resta monotono anche se l'ora del telefono torna indietro
 * o se due dispositivi hanno orologi diversi. Formato testuale ordinabile come stringa:
 *   <ms su 13 cifre>.<contatore base36 su 4 cifre>.<id nodo>
 * Il confronto tra HLC e' quindi un semplice confronto di stringhe (a < b).
 */
export type Hlc = string;

export class ClockSkewError extends Error {
  remoteWall: number;
  localWall: number;
  constructor(remoteWall: number, localWall: number) {
    super(`Orologio remoto troppo avanti (${remoteWall - localWall} ms)`);
    this.name = 'ClockSkewError';
    this.remoteWall = remoteWall; this.localWall = localWall;
  }
}

const WALL_W = 13;
const CNT_W = 4;
const CNT_MAX = 36 ** CNT_W - 1;

export function formatHlc(wall: number, counter: number, node: string): Hlc {
  return `${String(wall).padStart(WALL_W, '0')}.${counter.toString(36).padStart(CNT_W, '0')}.${node}`;
}
export function parseHlc(h: Hlc): { wall: number; counter: number; node: string } {
  const a = h.indexOf('.'), b = h.indexOf('.', a + 1);
  if (a !== WALL_W || b !== a + 1 + CNT_W) throw new Error('HLC non valido: ' + h);
  return { wall: Number(h.slice(0, a)), counter: parseInt(h.slice(a + 1, b), 36), node: h.slice(b + 1) };
}
export const isHlc = (h: unknown): h is Hlc => { if (typeof h !== 'string') return false; try { const p = parseHlc(h); return Number.isFinite(p.wall) && Number.isFinite(p.counter); } catch { return false; } };
export const compareHlc = (a: Hlc, b: Hlc) => (a < b ? -1 : a > b ? 1 : 0);
export const maxHlc = (...hs: (Hlc | undefined)[]): Hlc | undefined => hs.reduce<Hlc | undefined>((m, h) => (h && (!m || h > m) ? h : m), undefined);
export const hlcWall = (h: Hlc) => Number(h.slice(0, WALL_W));

export type Clock = {
  /** nuovo timestamp per un evento locale */
  tick(): Hlc;
  /** integra un timestamp ricevuto (lancia ClockSkewError se e' troppo nel futuro) */
  receive(remote: Hlc): Hlc;
  /** ultimo timestamp emesso (da salvare per sopravvivere ai riavvii) */
  last(): Hlc;
};

export function createClock(o: { node: string; now?: () => number; maxDriftMs?: number; initial?: Hlc }): Clock {
  const now = o.now ?? Date.now;
  const maxDrift = o.maxDriftMs ?? 24 * 3600 * 1000;
  let wall = 0, counter = 0;
  if (o.initial && isHlc(o.initial)) { const p = parseHlc(o.initial); wall = p.wall; counter = p.counter; }
  const emit = (): Hlc => {
    if (counter > CNT_MAX) { wall += 1; counter = 0; }
    return formatHlc(wall, counter, o.node);
  };
  return {
    tick() {
      const pt = Math.floor(now());
      if (pt > wall) { wall = pt; counter = 0; } else counter += 1;
      return emit();
    },
    receive(remote) {
      const r = parseHlc(remote);
      const pt = Math.floor(now());
      if (r.wall - pt > maxDrift) throw new ClockSkewError(r.wall, pt);
      const w = Math.max(wall, r.wall, pt);
      if (w === wall && w === r.wall) counter = Math.max(counter, r.counter) + 1;
      else if (w === wall) counter += 1;
      else if (w === r.wall) counter = r.counter + 1;
      else counter = 0;
      wall = w;
      return emit();
    },
    last: () => formatHlc(wall, counter, o.node),
  };
}

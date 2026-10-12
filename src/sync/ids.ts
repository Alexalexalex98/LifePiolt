/**
 * Identificatori e hash per la sincronizzazione. Modulo puro (nessun alias '@/', nessuna dipendenza nativa).
 *  - uuidv7: ID ordinabili nel tempo (48 bit di millisecondi + casualita'), usati per changeId e id di nuove entita';
 *  - hash53: hash non crittografico (cyrb53) per id derivati e impronte: NON e' sicurezza, solo identita' stabile;
 *  - stableStringify / deepEqual: confronto di valori JSON indipendente dall'ordine delle chiavi.
 */
export type Rand = (n: number) => Uint8Array;

/** Sorgente casuale di default: crypto.getRandomValues se esiste, altrimenti Math.random (solo per ambienti senza crypto). */
export const defaultRand: Rand = (n) => {
  const out = new Uint8Array(n);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(out);
  else for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
};

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/** UUID versione 7 (RFC 9562): ordinabile per tempo di creazione. */
export function uuidv7(now: number = Date.now(), rand: Rand = defaultRand): string {
  const b = rand(16);
  const ms = Math.max(0, Math.floor(now));
  const hi = Math.floor(ms / 0x10000);
  b[0] = (hi >>> 24) & 0xff; b[1] = (hi >>> 16) & 0xff; b[2] = (hi >>> 8) & 0xff; b[3] = hi & 0xff;
  b[4] = (ms >>> 8) & 0xff; b[5] = ms & 0xff;
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = hex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Hash a 53 bit (cyrb53), restituito in base 36. */
export function hash53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** ID derivato e stabile da parti di contenuto (stesso input = stesso id su ogni dispositivo). */
export function derivedId(prefix: string, ...parts: (string | number | undefined)[]): string {
  return `${prefix}_${hash53(parts.map((p) => String(p ?? '')).join('\u001f'))}`;
}

export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return v === undefined ? 'null' : JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}';
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    if (a.length !== bb.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], bb[i])) return false;
    return true;
  }
  const ao = a as Record<string, unknown>, bo = b as Record<string, unknown>;
  const ak = Object.keys(ao).filter((k) => ao[k] !== undefined), bk = Object.keys(bo).filter((k) => bo[k] !== undefined);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (!deepEqual(ao[k], bo[k])) return false;
  return true;
}

/** Copia profonda JSON (undefined scartato). */
export const cloneJson = <T,>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

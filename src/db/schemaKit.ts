/**
 * Validazione leggera dello stato salvato, senza dipendenze: controlla il TIPO dei campi di primo livello
 * e la forma base degli elementi. Lo scopo non e' bloccare, ma RIPARARE: tenere i campi validi,
 * scartare quelli non validi (lo store ripartira' dal suo valore predefinito per quel campo).
 */
export type Kind = 'array' | 'object' | 'string' | 'number' | 'boolean' | 'any';
export type FieldSpec = Kind | {
  kind: Kind;
  nullable?: boolean;
  /** array: forma degli elementi; quelli che non la rispettano vengono scartati. */
  items?: 'object' | 'string' | 'number';
  /** object usato come mappa: tipo dei valori (i valori non validi vengono scartati). */
  values?: 'array' | 'object' | 'string' | 'number';
  /** array che non puo' essere vuoto (es. mesi finanziari): se e' vuoto il campo si scarta. */
  nonEmpty?: boolean;
};
export type Schema = Record<string, FieldSpec>;

export type RepairReport = { dropped: string[]; filtered: number; fatal: boolean };

export const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function kindOk(v: unknown, k: Kind): boolean {
  switch (k) {
    case 'array': return Array.isArray(v);
    case 'object': return isPlainObject(v);
    case 'string': return typeof v === 'string';
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'boolean': return typeof v === 'boolean';
    default: return true;
  }
}

const elemOk = (v: unknown, k: 'object' | 'string' | 'number' | 'array') => (k === 'object' ? isPlainObject(v) : k === 'array' ? Array.isArray(v) : kindOk(v, k));

/** Ripara `state` secondo `schema`. Ritorna lo stato pulito (copia superficiale) e cosa e' stato scartato. */
export function repairState(state: unknown, schema?: Schema): { state: Record<string, unknown>; report: RepairReport } {
  const report: RepairReport = { dropped: [], filtered: 0, fatal: false };
  if (!isPlainObject(state)) { report.fatal = true; return { state: {}, report }; }
  const out: Record<string, unknown> = { ...state };
  if (!schema) return { state: out, report };
  for (const [key, spec0] of Object.entries(schema)) {
    if (!(key in out)) continue;
    const v = out[key];
    const spec = typeof spec0 === 'string' ? { kind: spec0 } : spec0;
    if (v === null || v === undefined) {
      if (!spec.nullable) { delete out[key]; report.dropped.push(key); }
      continue;
    }
    if (!kindOk(v, spec.kind)) { delete out[key]; report.dropped.push(key); continue; }
    if (spec.kind === 'array') {
      let arr = v as unknown[];
      if (spec.items) {
        const items = spec.items;
        const kept = arr.filter((e) => elemOk(e, items));
        if (kept.length !== arr.length) { report.filtered += arr.length - kept.length; arr = kept; out[key] = arr; }
      }
      if (spec.nonEmpty && arr.length === 0) { delete out[key]; report.dropped.push(key); }
    } else if (spec.kind === 'object' && spec.values) {
      const values = spec.values;
      const m = v as Record<string, unknown>;
      let bad = 0;
      const kept: Record<string, unknown> = {};
      for (const [k2, v2] of Object.entries(m)) { if (elemOk(v2, values)) kept[k2] = v2; else bad++; }
      if (bad) { report.filtered += bad; out[key] = kept; }
    }
  }
  return { state: out, report };
}

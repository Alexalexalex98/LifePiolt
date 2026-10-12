/**
 * Tipi condivisi del livello "local-first sync". Modulo puro (nessun alias '@/').
 * I contratti verso il server (ChangeRecord/WireChange) hanno lo schema zod gemello in src/schemas/change.ts.
 */
import type { Hlc } from './clock.ts';

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type Wire = Record<string, Json>;

export type ChangeOp = 'create' | 'update' | 'delete';

/** Record dell'outbox locale: contenuto in chiaro (resta sul telefono; viene cifrato solo al momento dell'invio). */
export type ChangeRecord = {
  /** changeId: idempotenza (uuidv7) */
  id: string;
  collection: string;
  /** versione dello schema della collezione con cui e' stato scritto */
  schemaV: number;
  entityId: string;
  op: ChangeOp;
  /** campi cambiati (create: tutti) */
  fields?: Wire;
  /** campi rimossi */
  unset?: string[];
  /** solo collezioni con fullUpdates (note): wire completo dell'entita' dopo la modifica, serve a ricrearla se e' stata eliminata in concorrenza */
  full?: Wire;
  hlc: Hlc;
  /** ultima versione dell'entita' vista dall'autore: serve a riconoscere le modifiche concorrenti */
  base?: Hlc;
  deviceId: string;
  /** contatore locale crescente per dispositivo */
  seq: number;
  /** tentativi di invio falliti */
  attempts?: number;
  /** locale: l'entita' era stata eliminata prima di questa creazione (la tombstone va comunque inviata) */
  afterDelete?: boolean;
  /** locale: e' gia' stata consegnata almeno una volta al transport (il server potrebbe averla applicata anche senza risposta): non si modifica piu' */
  tried?: boolean;
};

/** Cio' che viaggia verso il server: busta in chiaro + payload passato dal codec (cifrato E2E dove disponibile). */
export type WireChange = {
  v: 1;
  id: string;
  collection: string;
  schemaV: number;
  entityId: string;
  op: ChangeOp;
  hlc: Hlc;
  base?: Hlc;
  deviceId: string;
  seq: number;
  /** id del codec che ha prodotto payload ('identity' = nessuna cifratura) */
  codec: string;
  /** JSON {fields, unset} dopo codec.encrypt; assente per op 'delete' */
  payload?: string;
  /** assegnato dal server in pull */
  serverSeq?: number;
};

export type EntityMeta = {
  /** HLC di base: vale per tutti i campi senza override */
  b?: Hlc;
  /** HLC per campo (override) */
  f?: Record<string, Hlc>;
  /** tombstone: HLC dell'eliminazione */
  d?: Hlc;
};

export type PolicyKind = 'lww' | 'server-wins' | 'set';
export type FieldPolicy = 'lww' | 'server' | 'union' | 'manual';

export type ConflictEntry = {
  id: string;
  collection: string;
  entityId: string;
  field: string;
  /** id della copia in conflitto (entita' creata per non perdere testo) */
  copyId: string;
  at: number;
  /** anteprima corta del testo perso/versione alternativa (solo sul telefono) */
  preview: string;
  resolved?: 'current' | 'copy' | 'both';
};

export type SentLogEntry = { at: number; dir: 'invio' | 'ricezione'; collection: string; category: string; count: number; ok: boolean };

export type DeviceInfo = { id: string; name: string; lastSeen: number; current?: boolean };

export type SyncPhase = 'disconnected' | 'idle' | 'syncing' | 'offline' | 'error' | 'paused';

export type SyncStatus = {
  phase: SyncPhase;
  pending: number;
  blocked: number;
  lastError?: string;
  lastOkAt?: number;
  retryAt?: number;
};

export type MassHold = { collection: string; count: number; total: number; at: number };

/** Punto di ingresso del livello di sincronizzazione local-first. Vedi docs/sync.md. */
export { applyTransport, ensureEngine, getEngine, getTransport, resolveConflict, setCategory, setPayloadCodec, startSync, syncNow } from './bindings';
export { identityCodec, type PayloadCodec } from './codec';
export { SyncEngine, type SyncResult } from './engine';
export { categoryEligibility, COLLECTIONS, EXCLUDED, syncCategories } from './registry';
export { createTransport, DisconnectedTransport, listTransports, registerTransport, type SyncTransport } from './transport';

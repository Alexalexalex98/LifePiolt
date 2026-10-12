/**
 * Contratto di sincronizzazione condiviso tra app e server (Edge Functions / SQL).
 * Questo file NON importa nulla da src/sync e dall'app: si puo' copiare o importare cosi' com'e' sul server (richiede solo zod).
 * Dettagli, versioni e compatibilita': docs/sync.md.
 */
import { z } from 'zod';

/** Versione del protocollo (busta WireChange e forma di push/pull). */
export const SYNC_PROTOCOL_VERSION = 1;

export const LIMITS = {
  /** dimensione massima del payload (stringa, dopo cifratura) di una singola modifica */
  maxPayloadBytes: 64 * 1024,
  /** modifiche per richiesta di push */
  maxPushBatch: 200,
  /** modifiche per risposta di pull */
  maxPullPage: 500,
  /** richieste per minuto e per dispositivo (indicativo: il server risponde 429 con retryAfter) */
  rateLimitPerMinute: 60,
  /** tombstone conservate dal server (giorni); oltre, i client piu' vecchi devono risincronizzare */
  tombstoneTtlDays: 90,
  /** deriva massima ammessa dell'orologio di un client rispetto al server (ms) */
  maxClockDriftMs: 24 * 3600 * 1000,
} as const;

/** HLC: <ms 13 cifre>.<contatore base36 4 cifre>.<nodo> (ordinabile come stringa). */
export const hlcSchema = z.string().regex(/^\d{13}\.[0-9a-z]{4}\.[A-Za-z0-9_-]{1,64}$/, 'HLC non valido');
export const idSchema = z.string().min(1).max(128);
export const collectionNameSchema = z.string().regex(/^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/, 'nome collezione non valido');

export const changeOpSchema = z.enum(['create', 'update', 'delete']);

/** Una modifica come viaggia verso il server. Il contenuto e' in `payload` (cifrato E2E dove il codec lo permette). */
export const wireChangeSchema = z.object({
  v: z.literal(1),
  id: z.string().uuid(),
  collection: collectionNameSchema,
  schemaV: z.number().int().min(1).max(1000),
  entityId: z.string().min(1).max(256),
  op: changeOpSchema,
  hlc: hlcSchema,
  base: hlcSchema.optional(),
  deviceId: idSchema,
  seq: z.number().int().min(0),
  codec: z.string().min(1).max(64),
  payload: z.string().max(LIMITS.maxPayloadBytes).optional(),
  /** assegnato dal server, solo in pull */
  serverSeq: z.number().int().min(1).optional(),
}).strict().refine((c) => c.op === 'delete' || typeof c.payload === 'string', { message: 'payload obbligatorio per create/update' });
export type WireChangeDto = z.infer<typeof wireChangeSchema>;

/** Contenuto in chiaro del payload (prima della cifratura). */
export const payloadContentSchema = z.object({
  fields: z.record(z.string(), z.unknown()).default({}),
  unset: z.array(z.string()).optional(),
  /** solo per collezioni con aggiornamenti completi (es. note): intera entita' dopo la modifica */
  full: z.record(z.string(), z.unknown()).optional(),
});
export type PayloadContent = z.infer<typeof payloadContentSchema>;

export const pushRequestSchema = z.object({
  v: z.literal(1),
  deviceId: idSchema,
  changes: z.array(z.unknown()).max(LIMITS.maxPushBatch),
});
export const rejectReasonSchema = z.enum(['invalid', 'too-large', 'forbidden', 'schema', 'duplicate-device', 'quota']);
export const pushResponseSchema = z.object({
  acked: z.array(z.string().uuid()),
  rejected: z.array(z.object({ id: z.string(), reason: rejectReasonSchema, retryable: z.boolean() })),
  serverCursor: z.string(),
});
export const pullRequestSchema = z.object({
  v: z.literal(1),
  deviceId: idSchema,
  cursor: z.string().nullable(),
  limit: z.number().int().min(1).max(LIMITS.maxPullPage).optional(),
  collections: z.array(collectionNameSchema).optional(),
});
export const pullResponseSchema = z.object({
  changes: z.array(wireChangeSchema),
  nextCursor: z.string(),
  hasMore: z.boolean(),
  reset: z.boolean().optional(),
});
export const deviceInfoSchema = z.object({ id: idSchema, name: z.string().max(80), lastSeen: z.number() });

/** Record dell'outbox locale (con contenuto in chiaro): usato dai test e dagli strumenti di diagnostica, non va al server. */
export const changeRecordSchema = z.object({
  id: z.string(),
  collection: collectionNameSchema,
  schemaV: z.number().int(),
  entityId: z.string().min(1),
  op: changeOpSchema,
  fields: z.record(z.string(), z.unknown()).optional(),
  unset: z.array(z.string()).optional(),
  full: z.record(z.string(), z.unknown()).optional(),
  hlc: hlcSchema,
  base: hlcSchema.optional(),
  deviceId: z.string(),
  seq: z.number().int(),
  attempts: z.number().int().optional(),
});

/**
 * Schemi (versionati) dei campi di ogni collezione sincronizzabile. Sono permissivi sui campi sconosciuti (passthrough):
 * un client piu' nuovo puo' aggiungere campi senza rompere i piu' vecchi. Si cambia `v` solo per modifiche NON retrocompatibili.
 * Il server li usa per validare i payload IN CHIARO (codec 'identity'); con la cifratura E2E il server non puo' validarli.
 */
import { z } from 'zod';

const str = z.string();
const num = z.number();
const obj = <T extends z.ZodRawShape>(shape: T) => z.object(shape).passthrough();

export const COLLECTION_SCHEMAS = {
  'life.events': { v: 1, fields: obj({ day: str.regex(/^\d{4}-\d{2}-\d{2}$/), time: str, title: str, important: z.boolean().optional(), place: str.optional(), reminder: z.boolean().optional(), dur: num.optional(), ref: str.optional(), color: str.optional() }) },
  'life.tasks': { v: 1, fields: obj({ t: str, done: z.boolean().optional(), urgent: z.boolean().optional(), due: str.optional(), doneAt: str.optional(), recurring: z.enum(['none', 'daily', 'weekly']).optional(), subtasks: z.array(z.unknown()).optional() }) },
  'life.goals': { v: 1, fields: obj({ t: str, p: num }) },
  'life.notes': { v: 1, fields: obj({ text: str, date: str.optional() }) },
  'life.drive': { v: 1, fields: obj({ n: str, s: str.optional(), folder: str.optional(), date: str.optional() }) },
  'life.vacations': { v: 1, fields: obj({ dest: str }) },
  'health.workouts': { v: 1, fields: obj({ type: str, date: str, duration: num, calories: num.optional() }) },
  'health.mindSessions': { v: 1, fields: obj({ type: str, date: str, duration: num }) },
  'health.moods': { v: 1, fields: obj({ date: str, mood: str, day: str.optional() }) },
  'travel.saved': { v: 1, fields: obj({ city: str }) },
  'interests.selected': { v: 1, fields: obj({}) },
  'interests.custom': { v: 1, fields: obj({ label: str }) },
  'network.posts': { v: 1, fields: obj({ author: str, text: str, likes: num.optional() }) },
  'network.ideas': { v: 1, fields: obj({ title: str }) },
  'network.following': { v: 1, fields: obj({}) },
  'network.votes': { v: 1, fields: obj({ a: str, b: str, v: num }) },
  'network.ledger': { v: 1, fields: obj({ type: z.enum(['spend', 'topup']), desc: str, amount: num, date: str }) },
  'network.bookings': { v: 1, fields: obj({ provider: str }) },
  'network.enrollments': { v: 1, fields: obj({ title: str }) },
  'chat.chats': { v: 1, fields: obj({ type: z.enum(['dm', 'group', 'club']), name: str }) },
  'chat.messages': { v: 1, fields: obj({ chatId: str, from: str, ts: num }) },
  'club.clubs': { v: 1, fields: obj({ name: str, owner: str }) },
} as const;

export type CollectionName = keyof typeof COLLECTION_SCHEMAS;

/** Valida i campi di una modifica create. Per update i campi sono parziali: si valida solo il tipo di quelli presenti. */
export function validateFields(collection: string, schemaV: number, fields: unknown, partial: boolean): { ok: true } | { ok: false; error: string } {
  const entry = (COLLECTION_SCHEMAS as Record<string, { v: number; fields: z.ZodObject<z.ZodRawShape> }>)[collection];
  if (!entry) return { ok: false, error: 'collezione sconosciuta' };
  if (schemaV > entry.v) return { ok: false, error: 'schema piu\' nuovo del supportato' };
  const r = (partial ? entry.fields.partial() : entry.fields).safeParse(fields);
  return r.success ? { ok: true } : { ok: false, error: r.error.issues[0]?.message ?? 'campi non validi' };
}

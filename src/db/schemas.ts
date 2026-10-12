import type { Schema } from './schemaKit.ts';
import type { ShardSpec } from './shardPlan.ts';

const arrObj = { kind: 'array', items: 'object' } as const;
const arrStr = { kind: 'array', items: 'string' } as const;
const mapArr = { kind: 'object', values: 'array' } as const;
const mapObj = { kind: 'object', values: 'object' } as const;

/** Schemi leggeri per gli store piu' critici (campi di primo livello). Gli altri validano solo la forma base. */
export const SCHEMAS: Record<string, Schema> = {
  life: { tasks: arrObj, goals: arrObj, automations: arrObj, notes: arrObj, drive: arrObj, events: mapArr, vacRange: { kind: 'object', nullable: true }, vacations: arrObj, trash: arrObj, freeBuffer: 'number', chat: mapArr, activeCat: 'string' },
  finance: { categories: 'any', insights: arrObj, savingsPct: 'number', months: { kind: 'array', items: 'object', nonEmpty: true }, budget: 'object', bills: arrObj, invoices: arrObj, billPrefs: 'object', tax: 'object', cash: 'number', orders: arrObj, trades: arrObj, plans: 'object' },
  chat: { chats: mapObj, messages: mapArr, settings: 'object', blocked: arrStr },
  network: {
    lifePoints: 'number', ledger: arrObj, identity: 'object', reports: 'object', receivedDaily: 'object', receivedPayments: 'object', following: arrStr, mutedAuthors: arrStr, mutedTopics: arrStr,
    posts: arrObj, communities: arrObj, likedPosts: arrStr, comments: mapArr, providers: arrObj, bookings: arrObj, ideas: arrObj, seminars: arrObj, enrollments: arrObj, votes: 'object',
    clubs: 'object', bio: 'string', myCard: 'object', notifications: arrObj, conversations: mapArr, groups: arrObj, convSeen: 'object', groupSeen: 'object', cards: arrObj, prefs: 'object', suggested: arrStr,
  },
  health: { series: 'object', dates: 'object', sources: 'object', lastLog: 'object', workouts: arrObj, mindSessions: arrObj, moods: arrObj, wearable: 'object', lastSync: { kind: 'number', nullable: true }, syncError: { kind: 'string', nullable: true } },
  club: { seeded: 'boolean', clubs: mapObj, memberships: mapObj, progress: mapObj, notes: 'object', comments: arrObj, votes: arrObj, ratings: 'object' },
  identity: { identity: 'object', businesses: arrObj, design: { kind: 'object', nullable: true }, role: 'string', cardBusinessId: { kind: 'string', nullable: true }, declared: arrObj, requests: arrObj, qaVotes: arrObj, profileVoted: arrStr, since: 'number' },
  sharing: { choices: 'object' },
  jobs: { jobs: arrObj, applications: arrObj, practice: arrObj, practicals: arrObj, library: arrObj },
};

/** Store con dati personali sensibili: cifrati anche per valore quando SQLCipher non c'e'. */
export const SENSITIVE_STORES = ['finance', 'health', 'identity', 'chat', 'sharing', 'life', 'jobs'];

/**
 * Campi grandi salvati in righe separate (scrittura incrementale). Solo i campi che crescono nel tempo:
 * messaggi, note/task/eventi, post, notifiche, movimenti, serie di salute. Il formato logico dello store non cambia.
 */
export const SHARDS: Record<string, ShardSpec> = {
  chat: { messages: 'record' },
  life: { tasks: 'whole', notes: 'whole', events: 'whole', drive: 'whole', goals: 'whole', trash: 'whole', chat: 'record' },
  network: { posts: 'whole', ledger: 'whole', notifications: 'whole', conversations: 'record', comments: 'record', ideas: 'whole', communities: 'whole' },
  finance: { months: 'whole', invoices: 'whole', bills: 'whole', trades: 'whole' },
  health: { series: 'record', dates: 'record', workouts: 'whole', moods: 'whole', mindSessions: 'whole' },
  club: { clubs: 'record', comments: 'whole', progress: 'record' },
  assistant: { log: 'whole' },
};

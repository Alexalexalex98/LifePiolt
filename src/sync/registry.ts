/**
 * Registro delle collezioni sincronizzabili. Per ognuna: store di origine, adattatore verso "entita' con id stabile",
 * categoria del catalogo dati (src/lib/dataCatalog.ts), livello di sensibilita' e politica di conflitto.
 * NON importa gli store (solo tipi): il collegamento agli store reali e' in src/sync/bindings.ts.
 *
 * Regola di privacy: una collezione e' sincronizzabile solo se la sua categoria del catalogo esiste, non e' "critico"
 * e non e' una voce bloccata come "sempre segreta". Il resto e' opt-in per categoria (predefinito: solo sul telefono).
 */
import { CATALOG, itemOf, isLocked, type Sensitivity } from '../lib/dataCatalog.ts';
import { bucketedAdapter, listAdapter, nestedAdapter, recordAdapter, setAdapter, type Adapter } from './adapters.ts';
import { derivedId } from './ids.ts';
import type { PolicyDef } from './policy.ts';
import type { Json, Wire } from './types.ts';

export interface CollectionDef extends PolicyDef {
  /** nome univoco "store.collezione" */
  name: string;
  /** nome dello store (chiave di bindings) */
  store: string;
  /** id del catalogo dati: l'utente abilita la sincronizzazione per categoria */
  category: string;
  /** versione dello schema dei campi della collezione */
  schemaV: number;
  /** etichetta leggibile (italiano) */
  label: string;
  /** se true: mai inviata senza un codec di cifratura end-to-end */
  requiresE2E?: boolean;
  tombstoneTtlDays?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: Adapter<any>;
  /** crea il wire della "copia in conflitto" a partire dall'entita' vincente */
  conflictCopy?: (winner: Wire, field: string, loserValue: Json) => Wire;
}

export type ExcludedEntry = { store: string; what: string; category?: string; reason: string };

/** Cio' che NON si sincronizza, con il motivo (mostrato anche nella documentazione). */
export const EXCLUDED: ExcludedEntry[] = [
  { store: 'finance', what: 'Movimenti, conti, saldi (months)', category: 'fin_accounts', reason: 'Dato critico: resta sempre sul telefono.' },
  { store: 'finance', what: 'Bollette e fatture (bills, invoices)', category: 'fin_accounts', reason: 'Contengono importi e coordinate di pagamento: trattate come critiche.' },
  { store: 'finance', what: 'Dichiarazione e documenti fiscali (tax)', category: 'fin_tax', reason: 'Dato critico.' },
  { store: 'network', what: 'Carte di credito (cards)', category: 'fin_cards', reason: 'Dato critico.' },
  { store: 'life', what: 'Documenti d\'identita\' e file allegati (contenuto)', category: 'doc_id', reason: 'Dato critico; di LifeDrive si sincronizzano solo i metadati, mai il contenuto.' },
  { store: 'health', what: 'Dati sanitari clinici', category: 'health_clinical', reason: 'Dato critico.' },
  { store: 'life', what: 'Automazioni e preferenze (automations)', category: 'plan_auto', reason: 'Voce "sempre segreta" nel catalogo.' },
  { store: 'interests', what: 'Citta\' di casa e ricerche recenti', category: 'loc_home', reason: 'Voci bloccate: servono solo ai calcoli sul telefono.' },
  { store: 'health', what: 'Serie di passi, sonno, peso (series)', category: 'health_activity', reason: 'Derivano da Apple Health, che ha la sua sincronizzazione; non duplicate.' },
  { store: 'club', what: 'Iscrizioni e abbonamenti ai club (memberships)', category: 'club_member', reason: 'Voce bloccata nel catalogo: nessun canale la invia.' },
  { store: 'app', what: 'Account, impostazioni, privacy', reason: 'Dati di account o per-dispositivo: con il server restano a carico dell\'account, non di questo livello.' },
  { store: 'chat/network', what: 'Allegati multimediali (foto, audio, video)', reason: 'Servono un archivio file e la cifratura dei file: fuori da questo passo.' },
];

// ---------- helper di mappatura ----------
const omitKeys = (o: object, omit: readonly string[]): Wire => {
  const w: Wire = {};
  for (const k of Object.keys(o)) { const v = (o as Record<string, unknown>)[k]; if (v !== undefined && !omit.includes(k)) w[k] = v as Json; }
  return w;
};
const pickKeys = (o: object | undefined, keys: readonly string[]): Record<string, unknown> => {
  const r: Record<string, unknown> = {};
  if (o) for (const k of keys) if (k in o) r[k] = (o as Record<string, unknown>)[k];
  return r;
};
/** Mappatura generica entita' <-> wire: l'id esce dal wire, i campi "solo locali" (omit) non viaggiano e si conservano. */
function entity<E extends object>(o: { idKey?: string; numId?: boolean; omit?: string[]; idOf?: (e: E) => string }) {
  const idKey = o.idKey ?? 'id';
  const omit = o.omit ?? [];
  return {
    idOf: o.idOf ?? ((e: E) => String((e as Record<string, unknown>)[idKey])),
    toWire: (e: E): Wire => omitKeys(e, [idKey, ...omit]),
    fromWire: (id: string, w: Wire, existing?: E): E => ({ ...pickKeys(existing, omit), ...w, ...(o.idOf ? {} : { [idKey]: o.numId ? Number(id) : id }) }) as E,
  };
}

// ---------- forme di stato (strutturali, nessun import di store) ----------
type Obj = Record<string, unknown>;
const listOf = <K extends string>(key: K, e: ReturnType<typeof entity<Obj>>) =>
  listAdapter<Record<K, Obj[]>, Obj>({ get: (s) => s[key], set: (list) => ({ [key]: list }) as Partial<Record<K, Obj[]>>, ...e });

const eventAdapter = bucketedAdapter<{ events: Record<string, Obj[]> }, Obj>({
  get: (s) => s.events, set: (events) => ({ events }),
  bucketOf: (w) => String(w.day),
  // eventi senza id nello store: id assegnato e conservato in una tabella laterale (store sync), chiave = contenuto
  keyOf: (e, day) => `${day}|${e.time}|${e.title}|${e.ref ?? ''}`,
  toWire: (e, day) => ({ day, ...omitKeys(e, []) }),
  fromWire: (_id, w) => omitKeys(w, ['day']) as Obj,
});

const moodAdapter = listOf('moods', entity<Obj>({ idOf: (e) => derivedId('mood', e.date as string) }));

const chatMsgs = entity<Obj>({ omit: ['media'] });
const chatMessages = bucketedAdapter<{ messages: Record<string, Obj[]> }, Obj>({
  get: (s) => s.messages, set: (messages) => ({ messages }),
  bucketOf: (w) => String(w.chatId),
  idOf: chatMsgs.idOf,
  toWire: (e) => chatMsgs.toWire(e),
  fromWire: chatMsgs.fromWire,
});

const chatRec = entity<Obj>({ omit: ['draft', 'lastRead', 'markedUnread'] });
const ledger = bucketedAdapter<{ ledger: Obj[] }, Obj>({
  get: (s) => ({ '': s.ledger }), set: (r) => ({ ledger: r[''] ?? [] }), roots: (s) => [s.ledger],
  keyOf: (e) => `${e.date}|${e.type}|${e.desc}|${e.amount}`,
  toWire: (e) => omitKeys(e, []), fromWire: (_id, w) => ({ ...w }) as Obj,
});

const driveEnt = entity<Obj>({ omit: ['uri'] });
const clubEnt = entity<Obj>({});

const mapOf = <K extends string>(key: K, e: ReturnType<typeof entity<Obj>>) =>
  recordAdapter<Record<K, Record<string, Obj>>, Obj>({
    get: (s) => s[key], set: (rec) => ({ [key]: rec }) as Partial<Record<K, Record<string, Obj>>>,
    toWire: (o) => e.toWire(o), fromWire: (id, w, ex) => e.fromWire(id, w, ex),
  });

const DEFAULT_TTL_DAYS = 90;

export const COLLECTIONS: CollectionDef[] = [
  // --- Piano e vita quotidiana (store life) ---
  { name: 'life.events', store: 'life', category: 'plan_agenda', schemaV: 1, label: 'Impegni del piano', policy: 'lww', required: ['day', 'time', 'title'], adapter: eventAdapter },
  { name: 'life.tasks', store: 'life', category: 'plan_tasks', schemaV: 1, label: 'Task', policy: 'lww', required: ['t'], adapter: listOf('tasks', entity<Obj>({})) },
  { name: 'life.goals', store: 'life', category: 'plan_goals', schemaV: 1, label: 'Obiettivi', policy: 'lww', required: ['t'], adapter: listOf('goals', entity<Obj>({})) },
  {
    name: 'life.notes', store: 'life', category: 'plan_notes', schemaV: 1, label: 'Note', policy: 'lww', required: ['text'],
    fieldPolicies: { text: 'manual' }, fullUpdates: true,
    adapter: listOf('notes', entity<Obj>({})),
    conflictCopy: (winner, field, loser) => ({ ...winner, [field]: loser }),
  },
  { name: 'life.drive', store: 'life', category: 'doc_drive', schemaV: 1, label: 'Documenti di LifeDrive (solo elenco)', policy: 'lww', required: ['n'], adapter: listOf('drive', driveEnt) },
  { name: 'life.vacations', store: 'life', category: 'loc_trips', schemaV: 1, label: 'Vacanze', policy: 'lww', required: ['dest'], adapter: listOf('vacations', entity<Obj>({})) },
  // --- Salute non clinica ---
  { name: 'health.workouts', store: 'health', category: 'health_activity', schemaV: 1, label: 'Allenamenti', policy: 'lww', required: ['type', 'date'], adapter: listOf('workouts', entity<Obj>({})) },
  { name: 'health.mindSessions', store: 'health', category: 'health_activity', schemaV: 1, label: 'Sessioni di mindfulness', policy: 'lww', required: ['type', 'date'], adapter: listOf('mindSessions', entity<Obj>({})) },
  { name: 'health.moods', store: 'health', category: 'plan_mood', schemaV: 1, label: 'Umore', policy: 'lww', required: ['date', 'mood'], adapter: moodAdapter },
  // --- Viaggi e interessi ---
  { name: 'travel.saved', store: 'travel', category: 'loc_trips', schemaV: 1, label: 'Viaggi salvati', policy: 'lww', required: ['city'], adapter: listOf('saved', entity<Obj>({})) },
  { name: 'interests.selected', store: 'interests', category: 'pub_interests', schemaV: 1, label: 'Interessi scelti', policy: 'set', adapter: setAdapter<{ selected: string[] }>({ get: (s) => s.selected, set: (selected) => ({ selected }) }) },
  { name: 'interests.custom', store: 'interests', category: 'pub_interests', schemaV: 1, label: 'Interessi personali', policy: 'lww', required: ['label'], adapter: listOf('custom', entity<Obj>({})) },
  // --- LifeNetwork ---
  { name: 'network.posts', store: 'network', category: 'net_posts', schemaV: 1, label: 'Post', policy: 'lww', required: ['author', 'text'], fieldPolicies: { likes: 'server' }, adapter: listOf('posts', entity<Obj>({ numId: true, omit: ['uri', 'uris'] })) },
  { name: 'network.ideas', store: 'network', category: 'net_posts', schemaV: 1, label: 'Idee', policy: 'lww', required: ['title'], fieldPolicies: { raised: 'server' }, adapter: listOf('ideas', entity<Obj>({ numId: true })) },
  { name: 'network.following', store: 'network', category: 'net_follow', schemaV: 1, label: 'Chi segui', policy: 'set', adapter: setAdapter<{ following: string[] }>({ get: (s) => s.following, set: (following) => ({ following }) }) },
  { name: 'network.votes', store: 'network', category: 'net_posts', schemaV: 1, label: 'Voti', policy: 'server-wins', adapter: nestedAdapter<{ votes: Record<string, Record<string, number>> }>({ get: (s) => s.votes, set: (votes) => ({ votes }) }) },
  { name: 'network.ledger', store: 'network', category: 'net_points', schemaV: 1, label: 'Movimenti LifePoints', policy: 'lww', required: ['desc', 'amount'], adapter: ledger },
  { name: 'network.bookings', store: 'network', category: 'net_enroll', schemaV: 1, label: 'Prenotazioni', policy: 'lww', requiresE2E: true, required: ['provider'], adapter: listOf('bookings', entity<Obj>({})) },
  { name: 'network.enrollments', store: 'network', category: 'net_enroll', schemaV: 1, label: 'Iscrizioni', policy: 'lww', requiresE2E: true, required: ['title'], adapter: listOf('enrollments', entity<Obj>({})) },
  // --- Chat (solo con cifratura end-to-end) ---
  { name: 'chat.chats', store: 'chat', category: 'chat_msgs', schemaV: 1, label: 'Conversazioni', policy: 'lww', requiresE2E: true, required: ['type', 'name'], adapter: mapOf('chats', chatRec) },
  { name: 'chat.messages', store: 'chat', category: 'chat_msgs', schemaV: 1, label: 'Messaggi', policy: 'lww', requiresE2E: true, required: ['chatId', 'from', 'ts'], fieldPolicies: { reactions: 'union', starredBy: 'union', importedBy: 'union', hiddenFor: 'union' }, adapter: chatMessages },
  // --- LifeClub ---
  { name: 'club.clubs', store: 'club', category: 'club_public', schemaV: 1, label: 'LifeClub', policy: 'lww', required: ['name', 'owner'], adapter: mapOf('clubs', clubEnt) },
];

export const collectionOf = (name: string) => COLLECTIONS.find((c) => c.name === name);
export const collectionsForCategory = (cat: string) => COLLECTIONS.filter((c) => c.category === cat);
export const collectionsOfStore = (store: string) => COLLECTIONS.filter((c) => c.store === store);
export const ttlDaysOf = (c: CollectionDef) => c.tombstoneTtlDays ?? DEFAULT_TTL_DAYS;

export type Eligibility = { eligible: boolean; reason?: string };
/** Una categoria si puo' sincronizzare solo se esiste nel catalogo, non e' critica e non e' una voce bloccata "sempre segreta". */
export function categoryEligibility(id: string): Eligibility {
  const it = itemOf(id);
  if (!it) return { eligible: false, reason: 'Categoria sconosciuta.' };
  if (it.sensitivity === 'critico') return { eligible: false, reason: 'Dato critico: resta sempre sul telefono.' };
  if (isLocked(it) && !it.options[0].shared) return { eligible: false, reason: it.lockedReason ?? 'Resta sempre sul telefono.' };
  return { eligible: true };
}

export type SyncCategory = { id: string; label: string; sensitivity: Sensitivity; what: string; collections: CollectionDef[]; requiresE2E: boolean };
/** Le categorie che l'utente puo' abilitare (una per voce di catalogo con almeno una collezione), in ordine di catalogo. */
export function syncCategories(): SyncCategory[] {
  return CATALOG.filter((it) => COLLECTIONS.some((c) => c.category === it.id) && categoryEligibility(it.id).eligible).map((it) => {
    const cols = collectionsForCategory(it.id);
    return { id: it.id, label: it.label, sensitivity: it.sensitivity, what: it.what, collections: cols, requiresE2E: cols.some((c) => c.requiresE2E) };
  });
}

/** Problemi del registro (usato dai test): nomi duplicati, categorie inesistenti o non sincronizzabili. */
export function registryProblems(): string[] {
  const out: string[] = [];
  const names = new Set<string>();
  for (const c of COLLECTIONS) {
    if (names.has(c.name)) out.push('nome duplicato ' + c.name);
    names.add(c.name);
    const e = categoryEligibility(c.category);
    if (!e.eligible) out.push(`${c.name}: categoria ${c.category} non sincronizzabile (${e.reason})`);
  }
  return out;
}

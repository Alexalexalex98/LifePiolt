/**
 * Annunci, servizi, seminari e idee online (modulo PURO, nessun alias '@/'): conversione tra gli elementi dell'app e le righe del server (social_listings),
 * e unione delle liste. Il pubblico di ogni contenuto lo applica il server; qui si tiene solo l'elenco aggiornato.
 */
import { hashId } from './socialCore.ts';

export type Kind = 'service' | 'seminar' | 'idea' | 'offer';
export type Vis = 'public' | 'followers' | 'not_followers';
export type RemoteListing = { id: string; author_id: string; author_name: string; kind: Kind; title: string; body: string; payload: Record<string, unknown>; audience: Vis; created_at: string };
type Item = Record<string, unknown> & { remoteId?: string; authorId?: string; visibility?: Vis };

const LOCAL_ONLY: Record<string, string[]> = {
  idea: ['id', 'remoteId', 'authorId', 'visibility', 'author', 'raised', 'settled', 'similarTo'],
  seminar: ['id', 'remoteId', 'authorId', 'visibility', 'host', 'joined'],
  service: ['remoteId', 'authorId', 'visibility', 'name', 'rating'],
};
const isHttp = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\//.test(u);
/** Chi è l'autore (nome) di un elemento locale. */
export const authorOf = (kind: 'idea' | 'seminar' | 'service', it: Record<string, unknown>): string => String(kind === 'idea' ? it.author : kind === 'seminar' ? it.host : it.name ?? '');

/** Cosa si manda al server: titolo, descrizione e il resto dell'elemento senza ciò che resta solo sul telefono (id, raccolto, file locali). */
export function toListing(kind: 'idea' | 'seminar' | 'service', it: Record<string, unknown>): { kind: Kind; title: string; body: string; payload: Record<string, unknown> } {
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(it)) {
    if (LOCAL_ONLY[kind]!.includes(k)) continue;
    if ((k === 'uri' || k === 'cover' || k === 'poster') && !isHttp(v)) continue;
    if (k === 'uris') { const u = (Array.isArray(v) ? v : []).filter(isHttp); if (u.length) payload[k] = u; continue; }
    if (k === 'media' && !isHttp(it.uri)) { payload.media = null; continue; }
    if (v !== undefined) payload[k] = v;
  }
  const title = kind === 'service' ? `${String(it.name ?? '')} · ${String(it.role ?? '')}`.trim() : String(it.title ?? '');
  const body = kind === 'idea' || kind === 'seminar' ? String(it.desc ?? '') : '';
  return { kind: kind === 'service' ? 'service' : kind, title: title.slice(0, 120) || 'Senza titolo', body: body.slice(0, 4000), payload };
}

/** L'elemento locale ricavato da una riga del server. L'id locale è un numero negativo stabile, così non si scontra con quelli creati sul telefono. */
export function fromListing(l: RemoteListing): Item {
  const base = { remoteId: l.id, authorId: l.author_id, visibility: l.audience, ...l.payload } as Item;
  if (l.kind === 'idea') return { ...base, id: hashId(l.id), title: l.title, desc: l.body, author: l.author_name, raised: 0, similarTo: null } as Item;
  if (l.kind === 'seminar') return { ...base, id: hashId(l.id), title: l.title, desc: l.body, host: l.author_name } as Item;
  return { ...base, name: l.author_name, rating: Number((l.payload as { rating?: number }).rating ?? 0) } as Item;
}

/** Unisce la lista locale con i contenuti che il server mostra a questo utente: i suoi restano com'è; quelli degli altri si aggiornano, arrivano o spariscono
 *  (per esempio se l'autore li chiude a chi non lo segue). Gli elementi senza id del server (di esempio o creati qui) non si toccano. */
export function mergeListings<T extends Item>(local: T[], remote: RemoteListing[], kind: 'idea' | 'seminar' | 'service', me: string): T[] {
  const lk = kind === 'service' ? 'service' : kind;
  const mineIds = new Set(remote.filter((r) => r.kind === lk && r.author_name === me).map((r) => r.id));
  const theirs = remote.filter((r) => r.kind === lk && !mineIds.has(r.id));
  const byId = new Map(theirs.map((r) => [r.id, r]));
  const kept = local.filter((it) => !it.remoteId || authorOf(kind, it) === me || byId.has(it.remoteId)).map((it) => {
    if (!it.remoteId || authorOf(kind, it) === me) return it;
    const r = byId.get(it.remoteId)!;
    return { ...it, ...fromListing(r) } as T;
  });
  const have = new Set(kept.map((it) => it.remoteId).filter(Boolean));
  const fresh = theirs.filter((r) => !have.has(r.id)).map((r) => fromListing(r) as T);
  return [...fresh, ...kept];
}

/** Cosa è cambiato rispetto a prima, per decidere cosa pubblicare, aggiornare o togliere dal server (solo elementi miei). */
export function diffMine<T extends Item>(prev: T[], cur: T[], kind: 'idea' | 'seminar' | 'service', me: string): { publish: T[]; update: T[]; remove: string[] } {
  const mine = (it: T) => authorOf(kind, it) === me;
  const publish = cur.filter((it) => mine(it) && !it.remoteId);
  const update = cur.filter((it) => {
    if (!mine(it) || !it.remoteId) return false;
    const o = prev.find((x) => x.remoteId === it.remoteId); if (!o) return false;
    return JSON.stringify(toListing(kind, o)) !== JSON.stringify(toListing(kind, it)) || (o.visibility ?? 'public') !== (it.visibility ?? 'public');
  });
  const remove = prev.filter((o) => mine(o) && o.remoteId && !cur.some((it) => it.remoteId === o.remoteId)).map((o) => o.remoteId as string);
  return { publish, update, remove };
}

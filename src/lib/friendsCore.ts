/** Regole degli amici e dei messaggi online (modulo PURO, provato con i test). */
export type FriendStatus = 'accepted' | 'pending_in' | 'pending_out' | 'blocked';
export type Friend = { id: string; name: string; /** nome con cui compare la chat (unico tra gli amici) */ chat: string; status: FriendStatus; /** da quando è un amico su questo telefono (ms) */ since: number };
export type RemoteFriend = { id: string; name: string; status: FriendStatus; since?: string };
export type DmRow = { id: string; sender: string; recipient: string; body: string; client_id?: string | null; created_at: string };

export const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;
/** Il codice come lo scrive una persona: maiuscolo, senza spazi o trattini; false se non può essere valido. */
export function normalizeCode(raw: string): string | null {
  const c = raw.toUpperCase().replace(/[\s-]/g, '');
  return CODE_RE.test(c) ? c : null;
}
export const showCode = (c: string) => (c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c);

/** Due amici con lo stesso nome non devono finire nella stessa chat: al secondo si aggiunge un pezzetto dell'identificativo. */
export function chatNameFor(name: string, id: string, taken: { id: string; chat: string }[]): string {
  const base = name.trim() || 'Utente';
  return taken.some((t) => t.chat === base && t.id !== id) ? `${base} ${id.slice(0, 4)}` : base;
}

/** Unisce la lista del server a quella sul telefono: tiene il nome della chat e la data di inizio già decisi. */
export function mergeFriends(local: Friend[], remote: RemoteFriend[], now: number): Friend[] {
  const out: Friend[] = [];
  for (const r of remote) {
    const old = local.find((l) => l.id === r.id);
    const chat = old?.chat ?? chatNameFor(r.name, r.id, [...local, ...out]);
    out.push({ id: r.id, name: r.name, chat, status: r.status, since: old && old.status === 'accepted' ? old.since : r.status === 'accepted' ? now : old?.since ?? now });
  }
  return out;
}

export type Incoming = { remoteId: string; friend: Friend; mine: boolean; text: string; ts: number };
/** Cosa fare con i messaggi arrivati: salta quelli già visti, quelli che ho mandato io da questo telefono e quelli di chi non è (più) un amico. */
export function planIncoming(rows: DmRow[], me: string, friends: Friend[], seen: Set<string>, sentClientIds: Set<string>): { todo: Incoming[]; seenNow: string[] } {
  const todo: Incoming[] = []; const seenNow: string[] = [];
  for (const r of [...rows].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))) {
    if (seen.has(r.id)) continue;
    const mine = r.sender === me;
    seenNow.push(r.id);
    if (mine && r.client_id && sentClientIds.has(r.client_id)) continue;
    const friend = friends.find((f) => f.id === (mine ? r.recipient : r.sender));
    if (!friend || friend.status !== 'accepted') continue;
    todo.push({ remoteId: r.id, friend, mine, text: r.body, ts: Date.parse(r.created_at) || Date.now() });
  }
  return { todo, seenNow };
}

export type LocalMsg = { id: string; from: string; kind: string; text?: string; ts: number; deletedForAll?: boolean };
/** Messaggi scritti da me a un amico e non ancora mandati al server (solo testo, solo da quando siete amici). */
export function planOutgoing(msgs: LocalMsg[], me: string, since: number, sent: Set<string>): { send: LocalMsg[]; unsupported: number } {
  const send: LocalMsg[] = []; let unsupported = 0;
  for (const m of msgs) {
    if (m.from !== me || m.deletedForAll || sent.has(m.id) || m.ts < since) continue;
    if (m.kind === 'text' && m.text?.trim()) send.push(m); else if (m.kind !== 'text') unsupported += 1;
  }
  return { send, unsupported };
}
export const ERR_TEXT: Record<string, string> = {
  codice_non_valido: 'Codice non valido, oppure la persona non è disponibile.',
  troppe_richieste: 'Hai mandato troppe richieste: riprova tra un po\'.',
  profilo_pubblico_mancante: 'Prima serve il profilo pubblico: apri Impostazioni → Account → Prova il collegamento social.',
};

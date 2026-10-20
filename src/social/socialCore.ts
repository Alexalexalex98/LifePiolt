/**
 * Layer sociale pubblico (modulo PURO, nessun import dall'app): conversione tra i post dell'app e le righe del server,
 * e controllo di sicurezza dei comandi condivisi di Theia. Il server e' in supabase/migrations/0004_social.sql.
 */
export type RemotePost = {
  id: string; author_id: string; author_name: string; body: string; media: 'photo' | 'video' | null; media_url: string | null; media_urls: string[] | null;
  poster_url: string | null; tag: string | null; fx: unknown; caption_mode: 'photo' | 'below' | null; comments_off: boolean; hide_likes: boolean;
  likes_count: number; comments_count: number; created_at: string; edited_at: string | null;
};
export type LocalPostLike = {
  id: number; remoteId?: string; author: string; text: string; media: 'photo' | 'video' | null; tag?: string; likes: number; ts?: number; uri?: string; poster?: string; uris?: string[];
  captionMode?: 'photo' | 'below'; fx?: unknown; commentsOff?: boolean; hideLikes?: boolean; editedAt?: number;
};

/** Numero stabile (negativo, per non scontrarsi con gli id locali) ricavato dall'id del server: serve come chiave nelle liste. */
export function hashId(uuid: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < uuid.length; i++) { h ^= uuid.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return -((h >>> 0) % 2147483000) - 1;
}
const isRemoteUrl = (u?: string | null): u is string => !!u && /^https?:\/\//.test(u);

export function toLocalPost(r: RemotePost): LocalPostLike {
  const urls = (r.media_urls ?? []).filter(isRemoteUrl);
  return {
    id: hashId(r.id), remoteId: r.id, author: r.author_name, text: r.body, media: r.media ?? null, likes: r.likes_count, ts: Date.parse(r.created_at),
    ...(r.tag ? { tag: r.tag } : {}), ...(isRemoteUrl(r.media_url) ? { uri: r.media_url } : {}), ...(isRemoteUrl(r.poster_url) ? { poster: r.poster_url } : {}),
    ...(urls.length > 1 ? { uris: urls } : {}), ...(r.caption_mode ? { captionMode: r.caption_mode } : {}), ...(r.fx ? { fx: r.fx } : {}),
    ...(r.comments_off ? { commentsOff: true } : {}), ...(r.hide_likes ? { hideLikes: true } : {}), ...(r.edited_at ? { editedAt: Date.parse(r.edited_at) } : {}),
  };
}

/** Riga da inviare al server. author_name lo imposta il server dal profilo pubblico. I file locali (file://) non si inviano: prima si caricano. */
export function toInsertRow(p: LocalPostLike, authorId: string, urls: { media?: string; poster?: string; list?: string[] }): Record<string, unknown> {
  return {
    author_id: authorId, author_name: p.author, body: p.text, media: p.media, media_url: urls.media ?? (isRemoteUrl(p.uri) ? p.uri : null),
    media_urls: urls.list ?? (p.uris ?? []).filter(isRemoteUrl), poster_url: urls.poster ?? (isRemoteUrl(p.poster) ? p.poster : null), tag: p.tag ?? null,
    fx: p.fx ?? null, caption_mode: p.captionMode ?? null, comments_off: !!p.commentsOff, hide_likes: !!p.hideLikes,
  };
}

/**
 * Unisce i post del server nell'elenco locale: aggiunge quelli nuovi, aggiorna mi piace e modifiche di quelli già presenti,
 * non tocca i post locali senza id del server e toglie quelli che l'autore ha eliminato dal server.
 */
export function mergeRemote<T extends LocalPostLike>(local: T[], remote: RemotePost[], opts: { deletedIds?: string[] } = {}): T[] {
  const del = new Set(opts.deletedIds ?? []);
  const byRemote = new Map(remote.map((r) => [r.id, r]));
  const have = new Set(local.map((p) => p.remoteId).filter(Boolean) as string[]);
  const out = local.filter((p) => !p.remoteId || !del.has(p.remoteId)).map((p) => {
    const r = p.remoteId ? byRemote.get(p.remoteId) : undefined;
    if (!r) return p;
    const e = toLocalPost(r);
    return { ...p, likes: e.likes, text: e.text, ...(e.editedAt ? { editedAt: e.editedAt } : {}), ...(e.commentsOff !== undefined ? { commentsOff: e.commentsOff } : {}), ...(e.hideLikes !== undefined ? { hideLikes: e.hideLikes } : {}) };
  });
  const fresh = remote.filter((r) => !have.has(r.id)).map((r) => toLocalPost(r) as unknown as T);
  return [...fresh, ...out];
}

/* ---------- comandi condivisi di Theia: cosa si puo' eseguire ---------- */
export type SharedCmd = { id: string; pattern: string; kind: 'page' | 'cmd'; target: string; score: number };
/** Mai da un comando preso da altri: soldi, messaggi, acquisti, cancellazioni, persone. Si eseguirebbe con l'identità di chi lo usa. */
const FORBIDDEN = /\b(invia|manda|paga|pagare|pagamento|trasferisci|bonifico|lifepoints?|\blp\b|chf|euro|eur|vendi|compra|acquista|investi|prelievo|ritira|elimina|cancella|rimuovi|togli|svuota|resetta|segui|smetti|blocca|segnala|scrivi|messaggio|condividi|pubblica|prenota|ordina|iscriviti|disdici|password|pin|iban|carta)\b/i;
export const SAFE_PAGE = /^[A-Za-z][A-Za-z0-9]{1,40}$/;
const SAFE_CMD_START = /^(add task|add note|add |apri|open|mostra|show|vai|go|help|cosa sai)/i;
/** Un comando condiviso si usa solo se: ha abbastanza voti favorevoli, apre una pagina oppure è un comando innocuo (nessuna parola vietata). */
export function isSafeShared(c: SharedCmd, minScore = 2): boolean {
  if (c.score < minScore) return false;
  if (c.kind === 'page') return SAFE_PAGE.test(c.target);
  return c.target.length <= 200 && SAFE_CMD_START.test(c.target.trim()) && !FORBIDDEN.test(c.target) && !FORBIDDEN.test(c.pattern);
}
/** Prima di condividere: niente indirizzi, email, numeri lunghi o frasi troppo specifiche. Restituisce il motivo se non va bene. */
export function shareBlock(pattern: string, kind: 'page' | 'cmd', target: string): string | null {
  if (pattern.length < 3 || pattern.length > 120) return 'La frase è troppo corta o troppo lunga.';
  if (/@|https?:|www\./i.test(pattern) || /\d{5,}/.test(pattern)) return 'La frase contiene un indirizzo o un numero lungo: non si condivide.';
  const c: SharedCmd = { id: '', pattern, kind, target, score: 99 };
  if (!isSafeShared(c)) return 'Questo comando riguarda soldi, messaggi o cancellazioni: resta solo sul tuo telefono.';
  return null;
}

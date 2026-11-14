/** Persone (modulo PURO, nessun alias '@/'): codice univoco, QR, nome utente, come si cerca, a chi si mostra un contenuto. Le stesse regole le applica il server (qui servono a validare e a mostrare). */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
/** «k7m4-9qxr» → «K7M4-9QXR» (senza spazi e trattini). */
export const normalizeCode = (s: string): string => s.toUpperCase().replace(/[\s-]/g, '');
export const isCode = (s: string): boolean => CODE_RE.test(normalizeCode(s));
/** Per leggerlo meglio: K7M4-9QXR */
export const formatCode = (code: string): string => { const c = normalizeCode(code); return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c; };

/** Cosa c'è dentro il QR del profilo: solo un indirizzo con il codice, mai dati personali. */
export const qrPayload = (code: string): string => `lifepilot://u/${normalizeCode(code)}`;
/** Legge un QR (o un codice incollato): indirizzo dell'app, link web o codice nudo. Restituisce il codice, o null. */
export function parseQr(text: string): string | null {
  const t = text.trim();
  const m = t.match(/^(?:lifepilot:\/\/u\/|https?:\/\/[^/\s]+\/u\/)([A-Za-z0-9-]{8,9})\/?(?:[?#].*)?$/i);
  const c = normalizeCode(m ? m[1]! : t);
  return CODE_RE.test(c) ? c : null;
}

const RESERVED = ['admin', 'lifepilot', 'theia', 'support', 'assistenza', 'staff'];
/** Nome utente: 3-20 caratteri, minuscole, numeri, punto e trattino basso; non inizia con un simbolo, niente due punti di fila. */
export const cleanUsername = (s: string): string => s.trim().replace(/^@/, '').toLowerCase();
export function usernameProblem(s: string): string | null {
  const u = cleanUsername(s);
  if (!u) return null; // vuoto = nessun nome utente, va bene
  if (u.length < 3) return 'Servono almeno 3 caratteri';
  if (u.length > 20) return 'Al massimo 20 caratteri';
  if (!/^[a-z0-9][a-z0-9._]*$/.test(u)) return 'Solo lettere, numeri, punto e trattino basso (non all\'inizio)';
  if (u.includes('..')) return 'Non due punti di seguito';
  if (RESERVED.includes(u)) return 'Questo nome non è disponibile';
  return null;
}

/** Come interpretare quello che scrivi nella ricerca. */
export type QueryKind = 'code' | 'username' | 'name' | 'short';
export function queryKind(q: string): QueryKind {
  const t = q.trim();
  if (isCode(t)) return 'code';
  if (t.startsWith('@')) return t.length >= 3 ? 'username' : 'short';
  return t.length >= 3 ? 'name' : 'short';
}

/** A chi si mostra un contenuto. I post hanno solo i primi due; annunci, servizi, seminari e idee hanno tutti e tre. */
export type Audience = 'public' | 'followers' | 'not_followers';
export const AUDIENCES: { k: Audience; n: string; d: string }[] = [
  { k: 'public', n: 'Tutti', d: 'Lo vede chiunque abbia l\'app.' },
  { k: 'followers', n: 'Solo chi mi segue', d: 'Lo vedono solo le persone che ti seguono.' },
  { k: 'not_followers', n: 'Tutti tranne chi mi segue', d: 'Pensato per chi ti conosce già: lo vedono solo le persone che ancora non ti seguono (per esempio un\'offerta per nuovi clienti).' },
];
export const POST_AUDIENCES: Audience[] = ['public', 'followers'];
/** La stessa regola del server: l'autore vede sempre i suoi contenuti. */
export function canSee(audience: Audience, isAuthor: boolean, follows: boolean): boolean {
  if (isAuthor || audience === 'public') return true;
  return audience === 'followers' ? follows : !follows;
}

/** Anteprima di un profilo: solo le informazioni principali. */
export type Card = { user_id: string; display_name: string; username: string | null; avatar_url: string | null; bio: string | null; followers: number; following: number; follow: 'accepted' | 'pending' | null; follow_approval: boolean; me: boolean };
export type Me = { user_id: string; display_name: string; username: string | null; code: string; discoverable: boolean; follow_approval: boolean; can_change_username_at: string | null };
export const initials = (name: string): string => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

export function peopleError(e: unknown): string {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e ?? '');
  if (/nome_utente_occupato/.test(m)) return 'Questo nome utente è già preso: provane un altro.';
  if (/nome_utente_troppo_presto/.test(m)) return 'Puoi cambiare il nome utente una volta ogni 30 giorni.';
  if (/nome_utente_non_valido/.test(m)) return 'Nome utente non valido: 3-20 caratteri tra lettere, numeri, punto e trattino basso.';
  if (/troppe_ricerche/.test(m)) return 'Troppe ricerche di fila: riprova tra un minuto.';
  if (/codice_non_valido/.test(m)) return 'Codice non valido: controlla che sia di 8 caratteri.';
  if (/non_visibile/.test(m)) return 'Questo profilo non è visibile. Se lo conosci, chiedigli il suo codice o il suo QR.';
  if (/profilo_pubblico_mancante/.test(m)) return 'Prima completa il tuo profilo con nome e cognome.';
  return 'Non sono riuscita a farlo: controlla la connessione e riprova.';
}

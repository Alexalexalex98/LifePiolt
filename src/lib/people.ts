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
export type Reputation = { votes: number; score: number | null; confidence: 'nessuna' | 'bassa' | 'media' | 'alta' };
export type Counts = { service: number; seminar: number; idea: number; offer: number };
export type Card = {
  user_id: string; display_name: string; username: string | null; avatar_url: string | null; bio: string | null; followers: number; following: number; follow: 'accepted' | 'pending' | null; follow_approval: boolean; me: boolean;
  /** dettagli dell'anteprima (solo numeri e informazioni principali) */
  since?: string; verified?: boolean; posts?: number; listings?: Counts; reputation?: Reputation; my_vote?: number | null;
};
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
  if (/non_puoi_votare/.test(m)) return 'Puoi votare solo le persone che segui.';
  if (/voto_gia_dato/.test(m)) return 'Hai già dato il tuo voto: lo puoi cambiare dopo 30 giorni.';
  if (/voto_a_se_stessi/.test(m)) return 'Non puoi votare te stesso.';
  if (/troppi_voti/.test(m)) return 'Hai dato molti voti oggi: riprova domani.';
  if (/profilo_pubblico_mancante/.test(m)) return 'Prima completa il tuo profilo con nome e cognome.';
  if (/social_eta_minima/.test(m)) return 'La parte social è disponibile dai 16 anni. Il resto dell\'app lo puoi usare già da ora.';
  if (/social_sospeso/.test(m)) return 'Il social è sospeso per il tuo account: se pensi sia un errore, scrivici dal centro assistenza.';
  if (/regole_non_accettate/.test(m)) return 'Per pubblicare il LifeClub devi prima accettare le regole.';
  if (/club_adulti_solo_maggiorenni/.test(m)) return 'I LifeClub per adulti possono essere creati solo da chi ha almeno 18 anni.';
  if (/silenziato/.test(m)) return 'Il creatore ti ha silenziato in questo LifeClub.';
  if (/troppi_commenti/.test(m)) return 'Hai scritto molti commenti: riprova tra un po\'.';
  if (/non_autorizzato|non_trovato/.test(m)) return 'Questo contenuto non è disponibile per te.';
  if (/club_troppo_grande|troppi_corsi|troppe_lezioni/.test(m)) return 'Il LifeClub è troppo grande per essere pubblicato: togli qualcosa e riprova.';
  return 'Non sono riuscita a farlo: controlla la connessione e riprova.';
}

export const CONFIDENCE_TEXT: Record<Reputation['confidence'], string> = { nessuna: 'Nessun voto ancora', bassa: 'Affidabilità bassa', media: 'Affidabilità media', alta: 'Affidabilità alta' };
/** «4,3» (virgola, una cifra dopo): il voto si mostra sempre con il numero di voti e l'affidabilità accanto. */
export const scoreText = (r: Reputation | undefined): string => (r && r.score != null ? r.score.toFixed(1).replace('.', ',') : '–');
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const sinceText = (iso: string | undefined): string => { const d = iso ? new Date(iso) : null; return d && !Number.isNaN(d.getTime()) ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : ''; };
/** «2 servizi · 1 seminario · 3 idee» (solo ciò che c'è). */
export function listingsText(c: Counts | undefined): string {
  if (!c) return '';
  const one = (n: number, s: string, p: string) => (n ? `${n} ${n === 1 ? s : p}` : '');
  return [one(c.service, 'servizio', 'servizi'), one(c.seminar, 'seminario', 'seminari'), one(c.idea, 'idea', 'idee'), one(c.offer, 'offerta', 'offerte')].filter(Boolean).join(' · ');
}

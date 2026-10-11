/**
 * Collegamenti delle notifiche: un solo formato `ref` per portare l'utente ESATTAMENTE dove la notifica indica
 * (come Instagram: il "mi piace" apre il post, il commento apre il post sul commento, il follow apre il profilo...).
 * Modulo PURO (nessun import di react-native o alias '@/'): testabile con node.
 *
 * Formato: `<tipo>:<arg1>:<arg2>...` con ogni argomento codificato (':' e '%' diventano %3A e %25),
 * quindi gli id dei post ('standalone:12', 'community:3:1') e i nomi con ':' non rompono il formato.
 *
 *   post:<postId>                      apre il post
 *   comment:<postId>:<commentId>       apre il post e scorre sul commento (animazione breve)
 *   like:<postId>[:<attore>[:<commentId>]]   apre il post (o evidenzia il commento a cui e' stato messo mi piace)
 *   follow:<utente>                    profilo di chi ti segue, con "Segui anche tu"
 *   mention:<postId>:<commentId>       come comment
 *   reply:<postId>:<commentId>         come comment
 *   idea:<id>  community:<id>          profilo dell'idea / della community
 *   chat:<chatId>[:<messageId>]        conversazione, scorre al messaggio
 *   seminar:<id>  service:<nome>  booking:<id>  job:<id>
 *   points:<txId>                      LifePoints
 *   event:<YYYY-MM-DD>:<indice>        il Plan sul giorno dell'impegno
 *   bill:<id>                          dettaglio bolletta (se la schermata non esiste: Plan)
 *   reminder  system
 */

export type RefKind =
  | 'post' | 'comment' | 'like' | 'follow' | 'mention' | 'reply' | 'idea' | 'community' | 'chat'
  | 'seminar' | 'service' | 'booking' | 'job' | 'points' | 'event' | 'bill' | 'reminder' | 'system';

/** [minimo, massimo] di argomenti per tipo. */
const ARITY: Record<RefKind, [number, number]> = {
  post: [1, 1], comment: [2, 2], like: [1, 3], follow: [1, 1], mention: [2, 2], reply: [2, 2],
  idea: [1, 1], community: [1, 1], chat: [1, 2], seminar: [1, 1], service: [1, 1], booking: [1, 1], job: [1, 1],
  points: [1, 1], event: [2, 2], bill: [1, 1], reminder: [0, 1], system: [0, 1],
};
export const REF_KINDS = Object.keys(ARITY) as RefKind[];

const isRefKind = (k: string): k is RefKind => Object.prototype.hasOwnProperty.call(ARITY, k);

const enc = (s: string) => s.replace(/%/g, '%25').replace(/:/g, '%3A');
const dec = (s: string) => {
  try { return s.replace(/%3A/gi, ':').replace(/%25/g, '%'); } catch { return s; }
};

export type Parsed = { kind: RefKind; args: string[] };

/** Costruisce un ref. Argomenti vuoti/mancanti in coda vengono tolti; quelli vuoti in mezzo restano (es. like senza attore). */
export function buildRef(kind: RefKind, ...args: (string | number | null | undefined)[]): string {
  const parts = args.map((a) => (a === null || a === undefined ? '' : String(a)));
  while (parts.length && parts[parts.length - 1] === '') parts.pop();
  return [kind, ...parts.map(enc)].join(':');
}

/** Legge un ref; null se il tipo e' sconosciuto o gli argomenti sono troppo pochi/troppi. */
export function parseRef(ref: string | null | undefined): Parsed | null {
  if (typeof ref !== 'string' || !ref.trim()) return null;
  const [k, ...rest] = ref.trim().split(':');
  const kind = k.toLowerCase();
  if (!isRefKind(kind)) return null;
  const args = rest.map(dec);
  const [min, max] = ARITY[kind];
  // argomenti vuoti in coda tollerati (es. "chat:dm:Anna:")
  while (args.length > min && args[args.length - 1] === '') args.pop();
  if (args.length < min || args.length > max) return null;
  if (min > 0 && args.slice(0, min).some((a) => a === '')) return null;
  return { kind, args };
}

const POST_ID = /^(standalone:\d+|community:\d+:\d+)$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const INDEX = /^\d+$/;
/** Id di un post: 'standalone:12' o 'community:<idCommunity>:<indice>'. */
export const isPostId = (s: string) => POST_ID.test(s);

export type Focus = 'comment' | 'like' | 'follow';
export type Route = {
  valid: boolean;
  /** nome della rotta in src/app/(tabs) */
  page: string;
  params: Record<string, string>;
  /** destinazione da risolvere con i dati (es. 'job': candidato o azienda; 'booking': nome del servizio) */
  dynamic?: 'job' | 'booking' | 'bill';
  /** rotta di riserva se `page` non esiste ancora */
  fallback?: { page: string; params: Record<string, string> };
};

const invalid: Route = { valid: false, page: 'notificationsPage', params: {} };
const ok = (page: string, params: Record<string, string> = {}, extra: Partial<Route> = {}): Route => ({ valid: true, page, params, ...extra });

/** Destinazione di un ref (rotta + parametri). Ref non valido -> { valid: false } che riporta all'elenco delle notifiche. */
export function routeFor(ref: string | null | undefined): Route {
  const p = parseRef(ref);
  if (!p) return invalid;
  const a = p.args;
  switch (p.kind) {
    case 'post':
      return isPostId(a[0]) ? ok('postPage', { key: a[0] }) : invalid;
    case 'comment': case 'mention': case 'reply':
      return isPostId(a[0]) && INDEX.test(a[1]) ? ok('postPage', { key: a[0], commentId: a[1], focus: 'comment' }) : invalid;
    case 'like': {
      if (!isPostId(a[0])) return invalid;
      const params: Record<string, string> = { key: a[0], focus: 'like' };
      if (a[1]) params.actor = a[1];
      if (a[2] !== undefined && a[2] !== '') {
        if (!INDEX.test(a[2])) return invalid;
        params.commentId = a[2];
        params.focus = 'comment';
      }
      return ok('postPage', params);
    }
    case 'follow': return ok('userProfile', { name: a[0], follow: '1' });
    case 'idea': return ok('ideaProfile', { id: a[0] });
    case 'community': return INDEX.test(a[0]) ? ok('communityProfile', { id: a[0] }) : invalid;
    case 'chat': return ok('conversationPage', a[1] ? { id: a[0], jump: a[1] } : { id: a[0] });
    case 'seminar': return ok('seminarPage', { id: a[0] });
    case 'service': return ok('servicePage', { name: a[0] });
    case 'booking': return ok('servicePage', { name: a[0] }, { dynamic: 'booking' });
    case 'job': return ok('interviewView', { id: a[0] }, { dynamic: 'job', fallback: { page: 'lifenetwork', params: {} } });
    case 'points': return ok('lifepointsPage', { tx: a[0] });
    case 'event':
      return DAY.test(a[0]) && INDEX.test(a[1]) ? ok('plan', { day: a[0], idx: a[1] }) : invalid;
    case 'bill': return ok('billDetail', { id: a[0] }, { dynamic: 'bill', fallback: { page: 'plan', params: {} } });
    case 'reminder': return ok('plan', {});
    case 'system': return ok('notificationsPage', {});
  }
}

/** Id del post a cui un ref si riferisce (post/comment/like/mention/reply), altrimenti null. */
export function postOf(ref: string | null | undefined): string | null {
  const p = parseRef(ref);
  if (!p) return null;
  return ['post', 'comment', 'like', 'mention', 'reply'].includes(p.kind) && isPostId(p.args[0]) ? p.args[0] : null;
}

/**
 * Destinazione comune di un gruppo di notifiche ("Marta e altre 4 persone hanno messo mi piace").
 * - tutti i ref uguali -> quel ref;
 * - stesso post ma ref diversi (like di persone diverse) -> `post:<id>`;
 * - altrimenti null (il gruppo si espande e ogni riga porta alla sua destinazione).
 */
export function commonRef(refs: (string | null | undefined)[]): string | null {
  const list = refs.filter((r): r is string => !!r);
  if (list.length === 0 || list.length !== refs.length) return null;
  if (list.every((r) => r === list[0])) return list[0];
  const posts = list.map(postOf);
  if (posts[0] && posts.every((x) => x === posts[0])) return buildRef('post', posts[0]);
  return null;
}

/** Dati allegati a una notifica di sistema (push locale): il tap li riceve e apre la destinazione. */
export type PushData = { ref?: string; kind?: string; nid?: number };
export function pushData(ref: string | null | undefined, kind: string | undefined, nid?: number): Record<string, unknown> {
  return { ...(kind ? { kind } : {}), ...(ref ? { ref } : {}), ...(nid !== undefined ? { nid } : {}) };
}
export function readPushData(data: unknown): PushData {
  if (!data || typeof data !== 'object') return {};
  const d = data as Record<string, unknown>;
  const ref = typeof d.ref === 'string' && d.ref ? d.ref : undefined;
  const kind = typeof d.kind === 'string' && d.kind ? d.kind : undefined;
  const nid = typeof d.nid === 'number' && Number.isFinite(d.nid) ? d.nid : undefined;
  // promemoria creati dalla programmazione degli impegni: day + idx -> event:<giorno>:<indice>
  if (!ref && typeof d.day === 'string' && typeof d.idx === 'number') return { ref: buildRef('event', d.day, d.idx), kind, nid };
  return { ref, kind, nid };
}

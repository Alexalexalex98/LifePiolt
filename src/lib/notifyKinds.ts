/**
 * Catalogo delle categorie di notifica: identità (etichetta, icona, colore), importanza, canale Android,
 * raggruppamento e regole per decidere quando emettere anche una notifica locale immediata.
 * Modulo PURO (nessun import di react-native o alias '@/'): testabile con node.
 * Le stringhe italiane qui sono le chiavi del catalogo di traduzione; t() si usa solo dentro le funzioni.
 */
import { t } from '../i18n/core.ts';

export type KindId = 'promemoria' | 'servizio' | 'seminario' | 'messaggio' | 'lavoro' | 'sociale' | 'lifepoints' | 'finanza' | 'salute' | 'sistema';
export type Importance = 'alta' | 'normale' | 'bassa';
export type AndroidImportanceName = 'MAX' | 'HIGH' | 'DEFAULT' | 'LOW' | 'MIN';

export type KindChannel = {
  id: string;
  name: string;
  description: string;
  importance: AndroidImportanceName;
  /** schema di vibrazione in ms (null = nessuna vibrazione) */
  vibration: number[] | null;
  /** true = suono predefinito, false = silenziosa */
  sound: boolean;
};

export type KindInfo = {
  id: KindId;
  label: string;
  /** descrizione breve mostrata nelle Impostazioni */
  hint: string;
  icon: string;
  color: string;
  importance: Importance;
  channel: KindChannel;
  /** true = le notifiche dello stesso tipo si raggruppano ("Anna e altre 3 persone...") */
  group: boolean;
  /** titolo di riserva per le notifiche push immediate */
  pushTitle: string;
};

export const KIND_ORDER: KindId[] = ['servizio', 'promemoria', 'seminario', 'messaggio', 'lavoro', 'lifepoints', 'sociale', 'finanza', 'salute', 'sistema'];

const ch = (id: KindId, name: string, description: string, importance: AndroidImportanceName, vibration: number[] | null, sound: boolean): KindChannel => ({ id: `lp-${id}`, name, description, importance, vibration, sound });

export const KINDS: Record<KindId, KindInfo> = {
  servizio: {
    id: 'servizio', label: 'Servizio', hint: 'Richieste, prenotazioni e pagamenti dei tuoi servizi', icon: 'award', color: '#4f8cff', importance: 'alta', group: false, pushTitle: 'Aggiornamento sul tuo servizio',
    channel: ch('servizio', 'Servizi', 'Richieste, prenotazioni e pagamenti dei tuoi servizi', 'HIGH', [0, 500, 200, 500, 200, 500], true),
  },
  promemoria: {
    id: 'promemoria', label: 'Promemoria', hint: 'Impegni in arrivo e orario di partenza', icon: 'bell', color: '#ffb84f', importance: 'alta', group: false, pushTitle: 'Promemoria',
    channel: ch('promemoria', 'Promemoria impegni', 'Avvisi prima degli impegni e orario di partenza', 'HIGH', [0, 250, 150, 250], true),
  },
  seminario: {
    id: 'seminario', label: 'Seminario', hint: 'Iscrizioni e inizio delle dirette', icon: 'video', color: '#b96bff', importance: 'alta', group: false, pushTitle: 'Novità sul seminario',
    channel: ch('seminario', 'Seminari', 'Iscrizioni e inizio delle dirette', 'HIGH', [0, 300, 150, 300], true),
  },
  messaggio: {
    id: 'messaggio', label: 'Messaggio', hint: 'Nuovi messaggi e chat', icon: 'ai', color: '#6ec9dd', importance: 'alta', group: false, pushTitle: 'Nuovo messaggio',
    channel: ch('messaggio', 'Messaggi', 'Nuovi messaggi', 'HIGH', [0, 200, 100, 200], true),
  },
  lavoro: {
    id: 'lavoro', label: 'Lavoro', hint: 'Candidature e offerte di lavoro', icon: 'briefcase', color: '#4fd1a5', importance: 'normale', group: false, pushTitle: 'Novità sul lavoro',
    channel: ch('lavoro', 'Lavoro', 'Candidature e offerte', 'DEFAULT', [0, 250, 120, 250], true),
  },
  sociale: {
    id: 'sociale', label: 'Sociale', hint: 'Mi piace, commenti e nuovi follower', icon: 'heart', color: '#ff5d7a', importance: 'bassa', group: true, pushTitle: 'Novità nella tua rete',
    channel: ch('sociale', 'Sociale', 'Mi piace, commenti e nuovi follower', 'DEFAULT', null, false),
  },
  lifepoints: {
    id: 'lifepoints', label: 'LifePoints', hint: 'Punti donati e contributi ricevuti', icon: 'sparkle', color: '#e0c97b', importance: 'bassa', group: false, pushTitle: 'LifePoints ricevuti',
    channel: ch('lifepoints', 'LifePoints', 'Punti donati e contributi', 'LOW', [0, 120], false),
  },
  finanza: {
    id: 'finanza', label: 'Finanza', hint: 'Scadenze, budget e movimenti', icon: 'lifefinance', color: '#8fd16b', importance: 'normale', group: false, pushTitle: 'Novità sulle finanze',
    channel: ch('finanza', 'Finanza', 'Scadenze, budget e movimenti', 'DEFAULT', [0, 200], true),
  },
  salute: {
    id: 'salute', label: 'Salute', hint: 'Obiettivi di salute e benessere', icon: 'lifehealth', color: '#ff8f6b', importance: 'normale', group: false, pushTitle: 'Novità sulla salute',
    channel: ch('salute', 'Salute', 'Obiettivi di salute e benessere', 'DEFAULT', [0, 200], true),
  },
  sistema: {
    id: 'sistema', label: 'Sistema', hint: 'Avvisi dell\'app', icon: 'info', color: '#8e98a8', importance: 'bassa', group: false, pushTitle: 'LifePilot',
    channel: ch('sistema', 'Sistema', 'Avvisi generali dell\'app', 'LOW', null, false),
  },
};

/** Valori del campo `type` di useNetwork.notify(type, text) -> categoria. Gli sconosciuti vanno su 'sistema'. */
export const TYPE_TO_KIND: Record<string, KindId> = {
  booking: 'servizio', service: 'servizio', servizio: 'servizio', request: 'servizio', richiesta: 'servizio', payment: 'servizio', pagamento: 'servizio', review: 'servizio',
  seminar: 'seminario', seminario: 'seminario', live: 'seminario', enroll: 'seminario', enrollment: 'seminario',
  message: 'messaggio', messaggio: 'messaggio', chat: 'messaggio', dm: 'messaggio',
  job: 'lavoro', lavoro: 'lavoro', application: 'lavoro', candidatura: 'lavoro', offer: 'lavoro',
  like: 'sociale', comment: 'sociale', follow: 'sociale', vote: 'sociale', share: 'sociale', mention: 'sociale',
  donation: 'lifepoints', daily: 'lifepoints', contribution: 'lifepoints', lifepoints: 'lifepoints', bonus: 'lifepoints', goal: 'lifepoints',
  reminder: 'promemoria', promemoria: 'promemoria', event: 'promemoria', depart: 'promemoria',
  finance: 'finanza', finanza: 'finanza', bill: 'finanza', budget: 'finanza',
  health: 'salute', salute: 'salute',
  system: 'sistema', sistema: 'sistema',
};

const isKind = (k: unknown): k is KindId => typeof k === 'string' && Object.prototype.hasOwnProperty.call(KINDS, k);

/** Categoria di una notifica: `kind` esplicito se valido, altrimenti dal `type`, altrimenti 'sistema'. */
export function kindOf(n: { type?: string; kind?: string }): KindId {
  if (isKind(n.kind)) return n.kind;
  const k = TYPE_TO_KIND[String(n.type ?? '').toLowerCase()];
  return k ?? 'sistema';
}

/** Categoria attiva?? Le preferenze mancanti valgono "attiva" (retrocompatibile). */
export function kindEnabled(prefs: Record<string, boolean> | undefined | null, kind: KindId): boolean {
  return !prefs || prefs[kind] !== false;
}

/** Categorie per cui si emette anche una notifica locale immediata. I mi piace e i commenti restano solo nell'app. */
const PUSH_KINDS: ReadonlySet<KindId> = new Set<KindId>(['servizio', 'seminario', 'messaggio', 'lavoro']);
/** Tipi LifePoints che meritano una notifica immediata: il punto giornaliero donato. */
const PUSH_LP_TYPES: ReadonlySet<string> = new Set(['donation', 'daily', 'bonus']);

export function decidePush(n: { type?: string; kind?: string; urgent?: boolean }, prefs?: Record<string, boolean> | null): { push: boolean; kind: KindId } {
  const kind = kindOf(n);
  if (!kindEnabled(prefs, kind)) return { push: false, kind };
  const type = String(n.type ?? '').toLowerCase();
  const push = PUSH_KINDS.has(kind) || (kind === 'lifepoints' && PUSH_LP_TYPES.has(type));
  return { push, kind };
}

/** Chi ha fatto l'azione: la parte del testo prima di " ha " / " ti ". */
export function actorOf(text: string): string {
  const m = /^(.+?)\s+(?:ha|ti|hanno|vi)\s/i.exec(text ?? '');
  return (m ? m[1] : '').trim();
}

/** Chiave per evitare doppioni (stessa notifica emessa due volte in poco tempo). */
export const dedupeKey = (type: string, text: string) => `${String(type).toLowerCase()}|${String(text).trim().toLowerCase()}`;

/** Titolo della notifica locale: "Servizio · Nuova richiesta di Marco". */
export function pushTitle(kind: KindId, type: string, text: string): string {
  const info = KINDS[kind];
  const label = t(info.label);
  const actor = actorOf(text);
  if (kind === 'servizio' && (String(type).toLowerCase() === 'booking' || /prenotat|richiest/i.test(text)) && actor) return t('Servizio · Nuova richiesta di {0}', actor);
  return `${label} · ${t(info.pushTitle)}`;
}

export type PushPayload = { title: string; body: string; kind: KindId; channelId: string; sound: boolean; passive: boolean };
export function buildPush(n: { type: string; text: string; kind?: string }): PushPayload {
  const kind = kindOf(n);
  const info = KINDS[kind];
  return { title: pushTitle(kind, n.type, n.text), body: n.text, kind, channelId: info.channel.id, sound: info.channel.sound, passive: info.importance === 'bassa' };
}

// ---------- raggruppamento ----------

export type GroupableNotif = { id: number; type: string; text: string; read: boolean; kind?: string };
export type NotifGroup<T extends GroupableNotif = GroupableNotif> = {
  key: string;
  type: string;
  kind: KindId;
  items: T[];
  ids: number[];
  actors: string[];
  unread: number;
  read: boolean;
  /** testo da mostrare: quello originale o il riepilogo del gruppo */
  text: string;
  first: T;
};

/** Frase riepilogativa per più persone che hanno fatto la stessa azione. */
export function groupSummary(type: string, actors: string[], count: number, fallback: string): string {
  const ty = String(type).toLowerCase();
  const n = actors.length;
  if (n === 0 || count < 2) return fallback;
  if (ty === 'like') {
    if (n === 1) return t('{0} ha messo mi piace a {1} tuoi contenuti', actors[0], count);
    if (n === 2) return t('{0} e {1} hanno messo mi piace', actors[0], actors[1]);
    return t('{0} e altre {1} persone hanno messo mi piace', actors[0], n - 1);
  }
  if (ty === 'comment') {
    if (n === 1) return t('{0} ha commentato {1} tuoi contenuti', actors[0], count);
    if (n === 2) return t('{0} e {1} hanno commentato', actors[0], actors[1]);
    return t('{0} e altre {1} persone hanno commentato', actors[0], n - 1);
  }
  if (ty === 'follow') {
    if (n === 1) return fallback;
    if (n === 2) return t('{0} e {1} hanno iniziato a seguirti', actors[0], actors[1]);
    return t('{0} e altre {1} persone hanno iniziato a seguirti', actors[0], n - 1);
  }
  return fallback;
}

/**
 * Raggruppa le notifiche (già ordinate dalla più recente) delle categorie con `group`: stesso tipo e stessa
 * categoria diventano un unico elemento. Le altre restano singole. L'ordine di prima comparsa è mantenuto.
 */
export function groupNotifs<T extends GroupableNotif>(list: T[]): NotifGroup<T>[] {
  const out: NotifGroup<T>[] = [];
  const byKey = new Map<string, NotifGroup<T>>();
  for (const n of list) {
    const kind = kindOf(n);
    const grouped = KINDS[kind].group;
    const key = grouped ? `g:${kind}:${String(n.type).toLowerCase()}` : `n:${n.id}`;
    let g = byKey.get(key);
    if (!g) {
      g = { key, type: n.type, kind, items: [], ids: [], actors: [], unread: 0, read: true, text: n.text, first: n };
      byKey.set(key, g);
      out.push(g);
    }
    g.items.push(n);
    g.ids.push(n.id);
    if (!n.read) { g.unread++; g.read = false; }
    const a = actorOf(n.text);
    if (a && !g.actors.some((x) => x.toLowerCase() === a.toLowerCase())) g.actors.push(a);
  }
  for (const g of out) g.text = g.items.length > 1 ? groupSummary(g.type, g.actors, g.items.length, g.first.text) : g.first.text;
  return out;
}

/** Conteggio delle notifiche non lette per categoria. */
export function unreadByKind(list: { type?: string; kind?: string; read: boolean }[]): Record<KindId, number> {
  const r = Object.fromEntries(KIND_ORDER.map((k) => [k, 0])) as Record<KindId, number>;
  for (const n of list) if (!n.read) r[kindOf(n)]++;
  return r;
}

/**
 * Logica pura della stanza live (seminari online e videochiamate dei servizi).
 * Nessuna dipendenza da React/Expo: testabile con node (tests/liveRoom.test.mjs).
 *
 * ONESTA': il video reale tra telefoni richiede un servizio WebRTC/streaming e un backend per i token
 * (vedi docs/live.md). Qui c'e' l'interfaccia `LiveTransport` e un'implementazione SIMULATA
 * (`createSimulatedTransport`): commenti e reazioni dei partecipanti sono dimostrativi, il video
 * del relatore e' la sua vera fotocamera solo in locale.
 */

export type LiveRole = 'host' | 'viewer';
export type LiveKind = 'seminar' | 'service';
/** broadcast = un relatore e tanti spettatori; call = videochiamata a due (servizi 1-a-1). */
export type LiveMode = 'broadcast' | 'call';
export const modeFor = (kind: LiveKind): LiveMode => (kind === 'service' ? 'call' : 'broadcast');

export const MIN = 60000;
/** La stanza si apre (sala d'attesa) 10 minuti prima dell'inizio. */
export const EARLY_ENTRY_MIN = 10;
export const MAX_COMMENT_LEN = 200;
export const COMMENT_CAP = 300;
export const OVERLAY_MAX = 6;
export const OVERLAY_TTL_MS = 12000;
export const REACTION_CAP = 40;

/* ---------- stato della stanza per orario ---------- */
export type RoomPhase = 'upcoming' | 'waiting' | 'live' | 'ended';
export type RoomTiming = { phase: RoomPhase; msToOpen: number; msToStart: number; msToEnd: number; canEnter: boolean };

/**
 * upcoming = prima dei 10 minuti d'anticipo; waiting = sala d'attesa (da 10 min prima all'inizio);
 * live = orario di svolgimento; ended = dopo la fine.
 */
export function roomTiming(startsAt: number, durationMin: number, now: number, earlyMin = EARLY_ENTRY_MIN): RoomTiming {
  const end = startsAt + durationMin * MIN;
  const open = startsAt - earlyMin * MIN;
  const phase: RoomPhase = now >= end ? 'ended' : now >= startsAt ? 'live' : now >= open ? 'waiting' : 'upcoming';
  return { phase, msToOpen: Math.max(0, open - now), msToStart: Math.max(0, startsAt - now), msToEnd: Math.max(0, end - now), canEnter: phase === 'waiting' || phase === 'live' };
}

/** "tra 2 g 3 h", "tra 12 min", "tra 45 s" */
export function countdownLabel(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `tra ${s} s`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `tra ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `tra ${h} h ${m % 60} min` : `tra ${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `tra ${d} g ${h % 24} h` : `tra ${d} g`;
}

/** "00:00" / "1:02:03" */
export function clockLabel(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(r)}` : `${p(m)}:${p(r)}`;
}

/** Promemoria "inizia tra X minuti" (null se non e' il momento o e' gia' iniziata). */
export function startReminder(startsAt: number, now: number, leadMin = EARLY_ENTRY_MIN): string | null {
  const ms = startsAt - now;
  if (ms <= 0 || ms > leadMin * MIN) return null;
  const m = Math.max(1, Math.ceil(ms / MIN));
  return m === 1 ? 'Inizia tra 1 minuto' : `Inizia tra ${m} minuti`;
}

/** Chiave in store/live.ts per seminario o servizio. */
export const liveKey = (kind: LiveKind, ref: string | number) => `${kind}:${ref}`;

/** Online per default se il dato lo prevede, altrimenti decide chi organizza (override). */
export function resolveOnline(override: boolean | undefined, dataMode: string | null | undefined): boolean {
  if (typeof override === 'boolean') return override;
  return dataMode === 'online';
}

/* ---------- rete ---------- */
export type NetAdvice = { level: 'ok' | 'warn' | 'bad'; text: string };
/** type = valore di expo-network (WIFI, CELLULAR, ...) in stringa; null = sconosciuto. */
export function networkAdvice(type: string | null | undefined, online: boolean): NetAdvice {
  if (!online) return { level: 'bad', text: 'Serve una connessione internet' };
  const k = String(type ?? '').toUpperCase();
  if (k === 'CELLULAR') return { level: 'warn', text: 'Sei con i dati mobili: la diretta video consuma molti dati. Meglio il Wi-Fi.' };
  if (k === 'WIFI' || k === 'ETHERNET') return { level: 'ok', text: 'Wi-Fi collegato: connessione consigliata per la diretta.' };
  return { level: 'ok', text: 'Per una diretta stabile usa il Wi-Fi.' };
}

/* ---------- commenti ---------- */
export type CommentKind = 'comment' | 'question' | 'system';
export type LiveComment = { id: string; author: string; text: string; ts: number; kind: CommentKind; pinned?: boolean; mine?: boolean };

/** Ripulisce un commento: spazi, lunghezza massima; null se vuoto. */
export function sanitizeComment(raw: string): string | null {
  const t = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return t.length > MAX_COMMENT_LEN ? t.slice(0, MAX_COMMENT_LEN - 1).trimEnd() + '…' : t;
}

/** Aggiunge un commento mantenendo al massimo `cap` voci (i piu' vecchi, non fissati, escono). */
export function pushComment(list: LiveComment[], c: LiveComment, cap = COMMENT_CAP): LiveComment[] {
  const next = [...list, c];
  if (next.length <= cap) return next;
  let extra = next.length - cap;
  return next.filter((x) => { if (extra > 0 && !x.pinned) { extra--; return false; } return true; });
}

/** Commenti da mostrare in sovraimpressione: ultimi `max` non scaduti (i system durano di meno). */
export function overlayComments(list: LiveComment[], now: number, opts?: { max?: number; ttlMs?: number }): LiveComment[] {
  const max = opts?.max ?? OVERLAY_MAX;
  const ttl = opts?.ttlMs ?? OVERLAY_TTL_MS;
  const alive = list.filter((c) => !c.pinned && now - c.ts < (c.kind === 'system' ? ttl / 2 : c.kind === 'question' ? ttl * 1.5 : ttl));
  return alive.slice(-max);
}
/** Opacita' di un commento in base all'eta': pieno, poi svanisce nell'ultimo 35%. */
export function commentOpacity(age: number, ttlMs = OVERLAY_TTL_MS): number {
  if (age <= 0) return 1;
  const fadeStart = ttlMs * 0.65;
  if (age <= fadeStart) return 1;
  return Math.max(0, 1 - (age - fadeStart) / (ttlMs - fadeStart));
}
export const pinnedComment = (list: LiveComment[]): LiveComment | null => [...list].reverse().find((c) => c.pinned) ?? null;
/** Fissa un solo commento alla volta (id null = togli). */
export const pinComment = (list: LiveComment[], id: string | null): LiveComment[] => list.map((c) => ({ ...c, pinned: id !== null && c.id === id }));

/* ---------- ruoli e permessi ---------- */
export type LiveAction = 'startStop' | 'pin' | 'muteUser' | 'removeUser' | 'comment' | 'question' | 'react' | 'raiseHand' | 'camera' | 'mic';
const HOST_ONLY: LiveAction[] = ['startStop', 'pin', 'muteUser', 'removeUser', 'camera', 'mic'];
const ALL: LiveAction[] = ['comment', 'question', 'react', 'raiseHand'];
/** In una videochiamata a due anche l'ospite gestisce camera e microfono. */
export function can(role: LiveRole, action: LiveAction, ctx?: { muted?: boolean; removed?: boolean; mode?: LiveMode }): boolean {
  if (ctx?.removed) return false;
  if (ctx?.muted && (action === 'comment' || action === 'question')) return false;
  if (HOST_ONLY.includes(action)) {
    if ((action === 'camera' || action === 'mic') && ctx?.mode === 'call') return true;
    return role === 'host';
  }
  return ALL.includes(action);
}

/* ---------- reazioni ---------- */
export type ReactionKind = 'heart' | 'like' | 'smile' | 'wow';
export const REACTIONS: { kind: ReactionKind; icon: string; label: string; color: string }[] = [
  { kind: 'heart', icon: 'heart', label: 'Cuore', color: '#ff5d7a' },
  { kind: 'like', icon: 'like', label: 'Mi piace', color: '#6ea8ff' },
  { kind: 'smile', icon: 'smile', label: 'Sorriso', color: '#ffd166' },
  { kind: 'wow', icon: 'wow', label: 'Wow', color: '#c9b6ff' },
];
export type LiveReaction = { id: string; kind: ReactionKind; ts: number; from: string };
export const capReactions = (list: LiveReaction[], cap = REACTION_CAP): LiveReaction[] => (list.length > cap ? list.slice(list.length - cap) : list);

/* ---------- trasporto ---------- */
export type NetState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed';
export type Participant = { id: string; name: string; muted: boolean; hand: boolean; demo: boolean };
export type RoomInfo = { id: string; title: string; host: string; kind: LiveKind; mode: LiveMode };
export type Me = { id: string; name: string; role: LiveRole };

export type LiveEvent =
  | { type: 'state'; state: NetState }
  | { type: 'comment'; comment: LiveComment }
  | { type: 'reaction'; reaction: LiveReaction }
  | { type: 'viewers'; count: number; peak: number }
  | { type: 'participants'; list: Participant[] }
  | { type: 'pinned'; id: string | null }
  | { type: 'removed'; id: string }
  | { type: 'ended' };

/**
 * Punto di innesto per un provider reale (LiveKit, Daily, Agora, Jitsi...): implementa questa interfaccia
 * e passala a useLiveRoom. Vedi docs/live.md.
 */
export interface LiveTransport {
  /** 'simulated' per la demo locale; il nome del provider per quello reale. */
  readonly provider: string;
  /** true se il video dei partecipanti viaggia davvero in rete. */
  readonly realVideo: boolean;
  connect(room: RoomInfo, me: Me): Promise<void>;
  disconnect(): Promise<void>;
  publishComment(text: string, kind?: CommentKind): LiveComment | null;
  publishReaction(kind: ReactionKind): void;
  raiseHand(on: boolean): void;
  /** Solo relatore: */
  pin(id: string | null): void;
  muteParticipant(id: string, muted: boolean): void;
  removeParticipant(id: string): void;
  endRoom(): void;
  /** Aggiorna lo stato di rete del telefono (offline -> 'reconnecting'). */
  setNetwork(online: boolean): void;
  subscribe(l: (e: LiveEvent) => void): () => void;
  getState(): NetState;
  /** Simulato: da chiamare ogni ~1 s. I provider reali possono ignorarlo. */
  tick?(now: number): void;
}

/* generatore pseudo-casuale deterministico (mulberry32) */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const DEMO_NAMES = ['Giulia', 'Marco', 'Sara', 'Luca', 'Elena', 'Davide', 'Chiara', 'Paolo'];
const DEMO_LINES = [
  'Buonasera a tutti', 'Si sente bene', 'Ottimo punto', 'Grazie per la spiegazione', 'Si vede benissimo',
  'Potresti ripetere l\'ultimo passaggio?', 'Molto utile', 'Condivideresti le slide?', 'Collegata dal telefono, tutto ok', 'Bellissimo argomento',
];
const DEMO_QUESTIONS = ['Come si inizia in pratica?', 'Quanto tempo serve ogni settimana?', 'Ci saranno altri incontri su questo tema?'];

export type SimOptions = { seed?: number; now?: () => number; demoCount?: number; commentEveryMs?: number; reactionEveryMs?: number };

/** Trasporto SIMULATO: nessuna rete. I partecipanti demo scrivono e reagiscono da soli (con rng deterministico). */
export function createSimulatedTransport(opts: SimOptions = {}): LiveTransport {
  const rng = makeRng(opts.seed ?? 7);
  const clock = opts.now ?? (() => Date.now());
  const commentEvery = opts.commentEveryMs ?? 4500;
  const reactionEvery = opts.reactionEveryMs ?? 2200;
  const listeners = new Set<(e: LiveEvent) => void>();
  let state: NetState = 'idle';
  let online = true;
  let room: RoomInfo | null = null;
  let me: Me | null = null;
  let people: Participant[] = [];
  let seq = 0;
  let nextComment = 0, nextReaction = 0, nextViewers = 0;
  let viewers = 0, peak = 0;
  let ended = false;

  const emit = (e: LiveEvent) => { listeners.forEach((l) => { try { l(e); } catch { /* un ascoltatore non deve rompere gli altri */ } }); };
  const setState = (s: NetState) => { if (state !== s) { state = s; emit({ type: 'state', state }); } };
  const id = (p: string) => `${p}${++seq}`;
  const sync = () => emit({ type: 'participants', list: [...people] });
  const active = () => people.filter((p) => !p.muted);

  const t: LiveTransport = {
    provider: 'simulated',
    realVideo: false,
    async connect(r, who) {
      room = r; me = who; ended = false; setState('connecting');
      const n = Math.min(opts.demoCount ?? 5, DEMO_NAMES.length);
      people = r.mode === 'call' ? [] : DEMO_NAMES.slice(0, n).map((name, i) => ({ id: `demo${i}`, name, muted: false, hand: false, demo: true }));
      viewers = r.mode === 'call' ? 1 : n + 3 + Math.floor(rng() * 6);
      peak = viewers;
      const now = clock();
      nextComment = now + 1500; nextReaction = now + 900; nextViewers = now + 6000;
      setState(online ? 'connected' : 'reconnecting');
      emit({ type: 'viewers', count: viewers, peak });
      sync();
    },
    async disconnect() { setState('closed'); },
    publishComment(text, kind = 'comment') {
      const clean = sanitizeComment(text);
      if (!clean || !me || state === 'closed' || state === 'idle') return null;
      const c: LiveComment = { id: id('c'), author: me.name, text: clean, ts: clock(), kind, mine: true };
      emit({ type: 'comment', comment: c });
      return c;
    },
    publishReaction(kind) {
      if (!me || state === 'closed' || state === 'idle') return;
      emit({ type: 'reaction', reaction: { id: id('r'), kind, ts: clock(), from: me.name } });
    },
    raiseHand(on) {
      if (!me || !room || me.role !== 'viewer') return;
      emit({ type: 'comment', comment: { id: id('h'), author: me.name, text: on ? 'ha alzato la mano' : 'ha abbassato la mano', ts: clock(), kind: 'system', mine: true } });
    },
    pin(pid) { if (me?.role === 'host') emit({ type: 'pinned', id: pid }); },
    muteParticipant(pid, muted) {
      if (me?.role !== 'host') return;
      people = people.map((p) => (p.id === pid ? { ...p, muted } : p));
      sync();
    },
    removeParticipant(pid) {
      if (me?.role !== 'host') return;
      const p = people.find((x) => x.id === pid);
      if (!p) return;
      people = people.filter((x) => x.id !== pid);
      viewers = Math.max(0, viewers - 1);
      emit({ type: 'removed', id: pid });
      emit({ type: 'viewers', count: viewers, peak });
      sync();
    },
    endRoom() { if (me?.role === 'host' && !ended) { ended = true; emit({ type: 'ended' }); setState('closed'); } },
    setNetwork(on) {
      online = on;
      if (state === 'connected' && !on) setState('reconnecting');
      else if (state === 'reconnecting' && on) setState('connected');
    },
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); }; },
    getState: () => state,
    tick(now) {
      if (state !== 'connected' || !room || !me || ended) return;
      const pool = active();
      if (now >= nextComment && pool.length) {
        nextComment = now + commentEvery * (0.6 + rng());
        const p = pool[Math.floor(rng() * pool.length)];
        const q = rng() < 0.18;
        const text = q ? DEMO_QUESTIONS[Math.floor(rng() * DEMO_QUESTIONS.length)] : DEMO_LINES[Math.floor(rng() * DEMO_LINES.length)];
        emit({ type: 'comment', comment: { id: id('c'), author: p.name, text, ts: now, kind: q ? 'question' : 'comment' } });
      }
      if (now >= nextReaction && pool.length) {
        nextReaction = now + reactionEvery * (0.5 + rng());
        const p = pool[Math.floor(rng() * pool.length)];
        const kinds = REACTIONS;
        emit({ type: 'reaction', reaction: { id: id('r'), kind: kinds[Math.floor(rng() * kinds.length)].kind, ts: now, from: p.name } });
      }
      if (now >= nextViewers && room.mode === 'broadcast') {
        nextViewers = now + 6000;
        viewers = Math.max(people.length, viewers + (rng() < 0.6 ? 1 : -1));
        peak = Math.max(peak, viewers);
        emit({ type: 'viewers', count: viewers, peak });
      }
    },
  };
  return t;
}

/* ---------- riepilogo ---------- */
export type LiveSummary = {
  id: string; key: string; kind: LiveKind; title: string; host: string; role: LiveRole;
  startedAt: number; endedAt: number; durationMs: number; peakViewers: number; comments: number; questions: number; reactions: number; demo: boolean;
};
export function summarize(input: { key: string; kind: LiveKind; title: string; host: string; role: LiveRole; startedAt: number; endedAt: number; peakViewers: number; comments: LiveComment[]; reactions: number; demo: boolean }): LiveSummary {
  const real = input.comments.filter((c) => c.kind !== 'system');
  return {
    id: `${input.key}@${input.startedAt}`, key: input.key, kind: input.kind, title: input.title, host: input.host, role: input.role,
    startedAt: input.startedAt, endedAt: input.endedAt, durationMs: Math.max(0, input.endedAt - input.startedAt), peakViewers: input.peakViewers,
    comments: real.filter((c) => c.kind === 'comment').length, questions: real.filter((c) => c.kind === 'question').length, reactions: input.reactions, demo: input.demo,
  };
}

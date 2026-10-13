import { create } from 'zustand';

import { uid, weekdayShortDate } from '@/lib/format';
import type { Participant } from '@/lib/booking';
import type { PaymentRecord, ReceiveMode } from '@/lib/payments';
import { REACH_BOOST, type ReachKind } from '@/lib/reach';
import { addSignal, type ThemeWeights } from '@/lib/relevance';
import type { Order, Product } from '@/lib/shop';
import { withdrawFee, type LpMove, type LpSource } from '@/lib/lpStatement';
import { persisted } from './persist';

export type Post = { id: number; author: string; text: string; media: 'photo' | 'video' | null; tag?: string; likes: number; ts?: number; uri?: string; uris?: string[]; /** quando è stato modificato dall'autore */ editedAt?: number };
export type CommPost = { author: string; text: string; media?: 'photo' | 'video' | null; likes: number; ts?: number; uri?: string; editedAt?: number };
export type Community = { id: number; name: string; topic: string; owner: string; openPosting: boolean; members: string[]; posts: CommPost[]; desc?: string; rules?: string; ts?: number };
export type Provider = { name: string; role: string; price: number; rating: number; tag: string; media: 'photo' | 'video' | null; slots: string[] };
export type Booking = { id: string; provider: string; role: string; slot: string; price: number };
export type Idea = { id: number; title: string; desc: string; author: string; raised: number; similarTo: number | null; rewardType: 'libero' | 'fisso'; fixedAmount: number | null; rewardDesc: string; target: number; ts?: number; /** durata della raccolta in giorni (max 90) */ days?: number; /** esito già registrato: pagata al titolare o rimborsata */ settled?: 'paid' | 'refunded'; media?: 'photo' | 'video' | null; uri?: string };
export type SeminarMode = 'online' | 'presenza';
/** I campi oltre a promoted sono opzionali solo per i dati salvati da versioni precedenti. */
export type Seminar = {
  id: number; title: string; host: string; price: number; promoted: boolean;
  ts?: number; startsAt?: number; durationMin?: number; mode?: SeminarMode; place?: string; seats?: number; joined?: number;
  desc?: string; learn?: string[]; audience?: string; included?: string; language?: string; cancelPolicy?: string;
};
/** Iscrizione a un seminario o prenotazione di un servizio: si paga solo dopo, con la conferma di partecipazione. */
export type Enrollment = {
  id: string; kind: 'seminar' | 'service'; ref: string; title: string; host: string; price: number;
  startsAt: number; durationMin: number; status: 'enrolled' | 'attended' | 'declined'; voted?: boolean; createdAt: number; slot?: string; /** LifePoints pagati al momento della prenotazione */ paid?: number; /** i LifePoints restano bloccati fino alla fine dell'evento */ held?: boolean; releasedAt?: number;
};
export type Ledger = { type: 'spend' | 'topup'; desc: string; amount: number; date: string; /** collegamento, es. 'enr:<id>' per un pagamento bloccato */ ref?: string };
export type Msg = { from: string; text: string; date: string };
export type GroupChat = { id: number; name: string; members: string[]; msgs: Msg[] };
export type Notif = { id: number; type: string; text: string; urgent: boolean; read: boolean; date: string; slot?: string; service?: string; addedToCalendar?: boolean; kind?: string; ref?: string };
export type Card = { id: number; brand: string; last4: string; holder: string; expiry: string };
export type Club = { fee: number; desc: string; communityId: number; members: string[] };
export type MyCard = {
  residence: string; showResidence: boolean; birthYear: number | string; showBirthYear: boolean; profession: string; showProfession: boolean;
  phone: string; showPhone: boolean; email: string; showEmail: boolean; schools: string; experience: string; companyComments: string;
};

export const topicList = ['Fitness', 'Cucina', 'Viaggi', 'Lingue', 'Mind', 'Genitori', 'Libri', 'Musica', 'Casa', 'Soldi', 'Lavoro', 'Tech'];

type NetState = {
  lifePoints: number;
  ledger: Ledger[];
  identity: { verified: boolean; country: string; birthYear: number | null };
  reports: Record<string, number>;
  receivedDaily: Record<string, number>;
  /** chi mi ha donato il LifePoint giornaliero (solo sul mio telefono) */
  receivedLog?: { from: string; date: string; /** post su cui è stato donato (chiave) */ ref?: string }[];
  /** chi ha donato il LifePoint giornaliero a ciascuna persona: lo vedono tutti */
  donorsLog?: Record<string, { from: string; date: string; ref?: string }[]>;
  /** LifePoints che ho già riconvertito in denaro */
  lpConverted?: number;
  /** movimenti LifePoints con data, per il rendiconto fiscale */
  lpMoves?: LpMove[];
  /** negozi: prodotti di tutti, ordini miei e sconti da contributo (per negozio) */
  products?: Product[];
  /** gli annunci di esempio sono già stati aggiunti */
  sampleShops?: boolean;
  orders?: Order[];
  shopCredits?: Record<string, number>;
  /** quanto ho versato a ogni idea (per il rimborso se non raggiunge l'obiettivo) */
  myContrib?: Record<number, number>;
  /** diffusione dei contenuti nel feed (non mostrata agli utenti) */
  reach?: Record<string, number>;
  /** pagamenti tra persone (inviati e ricevuti) e come preferisco ricevere */
  payments?: PaymentRecord[];
  receiveMode?: ReceiveMode;
  /** partecipanti ai miei seminari (chiave `seminar:<id>`): li vede solo chi organizza */
  participants?: Record<string, Participant[]>;
  /** temi che interessano a chi usa l'app (non mostrati): servono a ordinare le proposte */
  themeWeights?: ThemeWeights;
  receivedPayments: Record<string, number>;
  following: string[];
  mutedAuthors: string[];
  mutedTopics: string[];
  dailyPoint: { lastGiven: string | null; to: string | null };
  dailyHistory: { date: string; to: string }[];
  posts: Post[];
  communities: Community[];
  likedPosts: string[];
  /** Post salvati (segnalibro): opzionale per i dati di versioni precedenti. */
  savedPosts?: string[];
  comments: Record<string, { author: string; text: string }[]>;
  providers: Provider[];
  bookings: Booking[];
  ideas: Idea[];
  hideIdeas: boolean;
  mutedIdeaAuthors: string[];
  seminars: Seminar[];
  enrollments: Enrollment[];
  votes: Record<string, Record<number, number>>;
  clubs: Record<string, Club>;
  bio: string;
  myCard: MyCard;
  notifications: Notif[];
  conversations: Record<string, Msg[]>;
  groups: GroupChat[];
  convSeen: Record<string, number>;
  groupSeen: Record<string, number>;
  cards: Card[];
  defaultCard: number | null;
  payCurrency: string;
  prefs: { lnTab: string; homeFilter: string; marketFilter: string; upTab: string; lpTab: string };
  suggested: string[];

  patch: (p: Partial<NetState>) => void;
  setPref: (k: keyof NetState['prefs'], v: string) => void;
  spend: (amount: number, desc: string, payee?: string, ref?: string) => boolean;
  bumpReach: (key: string, kind: ReachKind) => void;
  signal: (text: string, strength: number) => void;
  /** ritira LifePoints in denaro: commissione del 5% solo sul ritiro */
  withdraw: (amount: number) => { ok: boolean; fee: number; net: number };
  /** registra un guadagno ricevuto (idee, iscrizioni, LifePoint giornaliero) */
  logEarn: (amount: number, label: string, source: LpSource) => void;
  earn: (amount: number, desc: string) => void;
  notify: (type: string, text: string, urgent?: boolean, extra?: { kind?: string; ref?: string }) => void;
  toggleFollow: (name: string) => boolean;
  toggleMuteAuthor: (name: string) => boolean;
  toggleMuteTopic: (tag: string) => boolean;
  report: (name: string) => void;
  likePost: (key: string) => void;
  toggleSavePost: (key: string) => boolean;
  addComment: (key: string, author: string, text: string) => void;
  donateDaily: (to: string, ref?: string, from?: string) => boolean;
  reset: () => void;
};

const blank = () => ({
  lifePoints: 0,
  ledger: [] as Ledger[],
  identity: { verified: false, country: '', birthYear: null as number | null },
  reports: {} as Record<string, number>,
  receivedDaily: {} as Record<string, number>,
  receivedLog: [] as { from: string; date: string }[],
  lpConverted: 0,
  lpMoves: [] as LpMove[],
  products: [] as Product[],
  orders: [] as Order[],
  shopCredits: {} as Record<string, number>,
  myContrib: {} as Record<number, number>,
  reach: {} as Record<string, number>,
  payments: [] as PaymentRecord[],
  receiveMode: 'lp' as ReceiveMode,
  participants: {} as Record<string, Participant[]>,
  themeWeights: {} as ThemeWeights,
  receivedPayments: {} as Record<string, number>,
  following: [] as string[],
  mutedAuthors: [] as string[],
  mutedTopics: [] as string[],
  dailyPoint: { lastGiven: null as string | null, to: null as string | null },
  dailyHistory: [] as { date: string; to: string }[],
  posts: [] as Post[],
  communities: [] as Community[],
  likedPosts: [] as string[],
  comments: {} as Record<string, { author: string; text: string }[]>,
  providers: [] as Provider[],
  bookings: [] as Booking[],
  ideas: [] as Idea[],
  hideIdeas: false,
  mutedIdeaAuthors: [] as string[],
  seminars: [] as Seminar[],
  enrollments: [] as Enrollment[],
  votes: {} as Record<string, Record<number, number>>,
  clubs: {} as Record<string, Club>,
  bio: '',
  myCard: { residence: '', showResidence: true, birthYear: '', showBirthYear: false, profession: '', showProfession: true, phone: '', showPhone: false, email: '', showEmail: false, schools: '', experience: '', companyComments: 'Nessun commento aziendale ricevuto ancora.' } as MyCard,
  notifications: [] as Notif[],
  conversations: {} as Record<string, Msg[]>,
  groups: [] as GroupChat[],
  convSeen: {} as Record<string, number>,
  groupSeen: {} as Record<string, number>,
  cards: [] as Card[],
  defaultCard: null as number | null,
  payCurrency: 'CHF',
  prefs: { lnTab: 'Home', homeFilter: 'Per te', marketFilter: 'Per te', upTab: 'Post', lpTab: 'Acquisti' },
  suggested: [] as string[],
});

const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export const useNet = create<NetState>()(
  persisted<NetState>('network', (set, get) => ({
    ...blank(),
    patch: (p) => set(p),
    setPref: (k, v) => set((s) => ({ prefs: { ...s.prefs, [k]: v } })),
    spend: (amount, desc, payee, ref) => {
      if (get().lifePoints < amount) return false;
      set((s) => ({
        lifePoints: s.lifePoints - amount,
        ledger: [{ type: 'spend', desc, amount, date: weekdayShortDate(), ...(ref ? { ref } : {}) }, ...s.ledger],
        lpMoves: [...(s.lpMoves ?? []), { id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, ts: Date.now(), kind: 'spend' as const, label: desc, amount, ref }],
        receivedPayments: payee ? { ...s.receivedPayments, [payee]: (s.receivedPayments[payee] || 0) + amount } : s.receivedPayments,
      }));
      return true;
    },
    earn: (amount, desc) => set((s) => ({ lifePoints: s.lifePoints + amount, ledger: [{ type: 'topup', desc, amount, date: weekdayShortDate() }, ...s.ledger], lpMoves: [...(s.lpMoves ?? []), { id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, ts: Date.now(), kind: 'earn' as const, source: 'altro' as const, label: desc, amount }] })),
    logEarn: (amount, label, source) => set((s) => ({ lpMoves: [...(s.lpMoves ?? []), { id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, ts: Date.now(), kind: 'earn' as const, source, label, amount }] })),
    withdraw: (amount) => {
      const a = Math.floor(amount);
      if (a <= 0 || get().lifePoints < a) return { ok: false, fee: 0, net: 0 };
      const { fee, net } = withdrawFee(a);
      set((s) => ({ lifePoints: s.lifePoints - a, lpConverted: (s.lpConverted ?? 0) + a, lpMoves: [...(s.lpMoves ?? []), { id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, ts: Date.now(), kind: 'withdraw' as const, label: 'Ritiro in denaro', amount: a }] }));
      return { ok: true, fee, net };
    },
    notify: (type, text, urgent, extra) => {
      const nid = Date.now() + Math.floor(Math.random() * 1000);
      set((s) => ({ notifications: [{ id: nid, type, text, urgent: !!urgent, read: false, date: weekdayShortDate(), ...(extra?.kind ? { kind: extra.kind } : {}), ...(extra?.ref ? { ref: extra.ref } : {}) }, ...s.notifications] }));
      // notifica locale immediata per i tipi importanti (difensiva: non blocca mai l'app)
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const m = require('@/lib/notify');
        void m.pushForNotif({ type, text, urgent: !!urgent, kind: extra?.kind, ref: extra?.ref, id: nid });
      } catch { /* notifiche non disponibili */ }
    },
    toggleFollow: (name) => { set((s) => ({ following: toggle(s.following, name) })); return get().following.includes(name); },
    toggleMuteAuthor: (name) => { set((s) => ({ mutedAuthors: toggle(s.mutedAuthors, name) })); return get().mutedAuthors.includes(name); },
    toggleMuteTopic: (tag) => { set((s) => ({ mutedTopics: toggle(s.mutedTopics, tag) })); return get().mutedTopics.includes(tag); },
    report: (name) => set((s) => ({ reports: { ...s.reports, [name]: (s.reports[name] || 0) + 1 } })),
    likePost: (key) => {
      const s = get();
      const liked = s.likedPosts.includes(key);
      const d = liked ? -1 : 1;
      const likedPosts = liked ? s.likedPosts.filter((k) => k !== key) : [...s.likedPosts, key];
      if (!liked) set((x) => ({ reach: { ...(x.reach ?? {}), [key]: (x.reach?.[key] ?? 0) + REACH_BOOST.like } }));
      if (!liked) {
        const [kind, a1, a2] = key.split(':');
        const text = kind === 'standalone' ? s.posts.find((p) => p.id === Number(a1))?.text : s.communities.find((c) => c.id === Number(a1))?.posts[Number(a2)]?.text;
        if (text) set((x) => ({ themeWeights: addSignal(x.themeWeights, text, 1) }));
      }
      if (key.startsWith('standalone:')) {
        const id = Number(key.split(':')[1]);
        set({ likedPosts, posts: s.posts.map((p) => (p.id === id ? { ...p, likes: p.likes + d } : p)) });
      } else {
        const [, cid, pi] = key.split(':');
        set({ likedPosts, communities: s.communities.map((c) => (c.id === Number(cid) ? { ...c, posts: c.posts.map((p, i) => (i === Number(pi) ? { ...p, likes: p.likes + d } : p)) } : c)) });
      }
    },
    toggleSavePost: (key) => { set((s) => ({ savedPosts: toggle(s.savedPosts ?? [], key) })); return (get().savedPosts ?? []).includes(key); },
    signal: (text, strength) => set((s) => ({ themeWeights: addSignal(s.themeWeights, text, strength) })),
    bumpReach: (key, kind) => set((s) => ({ reach: { ...(s.reach ?? {}), [key]: (s.reach?.[key] ?? 0) + REACH_BOOST[kind] } })),
    addComment: (key, author, text) => set((s) => ({ comments: { ...s.comments, [key]: [...(s.comments[key] || []), { author, text }] }, reach: { ...(s.reach ?? {}), [key]: (s.reach?.[key] ?? 0) + REACH_BOOST.comment } })),
    donateDaily: (to, ref, from) => {
      const today = weekdayShortDate();
      if (get().dailyPoint.lastGiven === today) return false;
      const rec = { from: from ?? 'Tu', date: today, ...(ref ? { ref } : {}) };
      set((s) => ({ donorsLog: { ...(s.donorsLog ?? {}), [to]: [rec, ...((s.donorsLog ?? {})[to] ?? [])].slice(0, 200) }, reach: { ...(s.reach ?? {}), [`user:${to}`]: (s.reach?.[`user:${to}`] ?? 0) + REACH_BOOST.daily }, dailyPoint: { lastGiven: today, to }, dailyHistory: [{ date: today, to }, ...s.dailyHistory], receivedDaily: { ...s.receivedDaily, [to]: (s.receivedDaily[to] || 0) + 1 } }));
      return true;
    },
    reset: () => set({ ...blank() }),
  })),
);

export const newId = () => Date.now() + Math.floor(Math.random() * 1000);
void uid;

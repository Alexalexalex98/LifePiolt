import { create } from 'zustand';

import { uid, weekdayShortDate } from '@/lib/format';
import { persisted } from './persist';

export type Post = { id: number; author: string; text: string; media: 'photo' | 'video' | null; tag?: string; likes: number };
export type CommPost = { author: string; text: string; media?: 'photo' | 'video' | null; likes: number };
export type Community = { id: number; name: string; topic: string; owner: string; openPosting: boolean; members: string[]; posts: CommPost[] };
export type Provider = { name: string; role: string; price: number; rating: number; tag: string; media: 'photo' | 'video' | null; slots: string[] };
export type Booking = { id: string; provider: string; role: string; slot: string; price: number };
export type Idea = { id: number; title: string; desc: string; author: string; raised: number; similarTo: number | null; rewardType: 'libero' | 'fisso'; fixedAmount: number | null; rewardDesc: string; target: number };
export type Seminar = { id: number; title: string; host: string; price: number; promoted: boolean };
export type Ledger = { type: 'spend' | 'topup'; desc: string; amount: number; date: string };
export type Msg = { from: string; text: string; date: string };
export type GroupChat = { id: number; name: string; members: string[]; msgs: Msg[] };
export type Notif = { id: number; type: string; text: string; urgent: boolean; read: boolean; date: string; slot?: string; service?: string; addedToCalendar?: boolean };
export type Card = { id: number; brand: string; last4: string; holder: string; expiry: string };
export type Club = { fee: number; desc: string; communityId: number; members: string[] };
export type MyCard = {
  residence: string; showResidence: boolean; birthYear: number | string; showBirthYear: boolean; profession: string; showProfession: boolean;
  phone: string; showPhone: boolean; email: string; showEmail: boolean; schools: string; experience: string; companyComments: string;
};

export const topicList = ['Business', 'Fitness', 'Lingue', 'Mind', 'Genitori', 'Musica', 'Viaggi', 'Cucina', 'Tech'];

type NetState = {
  lifePoints: number;
  ledger: Ledger[];
  identity: { verified: boolean; country: string; birthYear: number | null };
  reports: Record<string, number>;
  receivedDaily: Record<string, number>;
  receivedPayments: Record<string, number>;
  following: string[];
  mutedAuthors: string[];
  mutedTopics: string[];
  dailyPoint: { lastGiven: string | null; to: string | null };
  dailyHistory: { date: string; to: string }[];
  posts: Post[];
  communities: Community[];
  likedPosts: string[];
  comments: Record<string, { author: string; text: string }[]>;
  providers: Provider[];
  bookings: Booking[];
  ideas: Idea[];
  hideIdeas: boolean;
  mutedIdeaAuthors: string[];
  seminars: Seminar[];
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
  spend: (amount: number, desc: string, payee?: string) => boolean;
  earn: (amount: number, desc: string) => void;
  notify: (type: string, text: string, urgent?: boolean) => void;
  toggleFollow: (name: string) => boolean;
  toggleMuteAuthor: (name: string) => boolean;
  toggleMuteTopic: (tag: string) => boolean;
  report: (name: string) => void;
  likePost: (key: string) => void;
  addComment: (key: string, author: string, text: string) => void;
  donateDaily: (to: string) => boolean;
  reset: () => void;
};

const blank = () => ({
  lifePoints: 0,
  ledger: [] as Ledger[],
  identity: { verified: false, country: '', birthYear: null as number | null },
  reports: {} as Record<string, number>,
  receivedDaily: {} as Record<string, number>,
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
  prefs: { lnTab: 'Home', homeFilter: 'Per te', marketFilter: 'Servizi', upTab: 'Post', lpTab: 'Acquisti' },
  suggested: [] as string[],
});

const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export const useNet = create<NetState>()(
  persisted<NetState>('network', (set, get) => ({
    ...blank(),
    patch: (p) => set(p),
    setPref: (k, v) => set((s) => ({ prefs: { ...s.prefs, [k]: v } })),
    spend: (amount, desc, payee) => {
      if (get().lifePoints < amount) return false;
      set((s) => ({
        lifePoints: s.lifePoints - amount,
        ledger: [{ type: 'spend', desc, amount, date: weekdayShortDate() }, ...s.ledger],
        receivedPayments: payee ? { ...s.receivedPayments, [payee]: (s.receivedPayments[payee] || 0) + amount } : s.receivedPayments,
      }));
      return true;
    },
    earn: (amount, desc) => set((s) => ({ lifePoints: s.lifePoints + amount, ledger: [{ type: 'topup', desc, amount, date: weekdayShortDate() }, ...s.ledger] })),
    notify: (type, text, urgent) => set((s) => ({ notifications: [{ id: Date.now() + Math.floor(Math.random() * 1000), type, text, urgent: !!urgent, read: false, date: weekdayShortDate() }, ...s.notifications] })),
    toggleFollow: (name) => { set((s) => ({ following: toggle(s.following, name) })); return get().following.includes(name); },
    toggleMuteAuthor: (name) => { set((s) => ({ mutedAuthors: toggle(s.mutedAuthors, name) })); return get().mutedAuthors.includes(name); },
    toggleMuteTopic: (tag) => { set((s) => ({ mutedTopics: toggle(s.mutedTopics, tag) })); return get().mutedTopics.includes(tag); },
    report: (name) => set((s) => ({ reports: { ...s.reports, [name]: (s.reports[name] || 0) + 1 } })),
    likePost: (key) => {
      const s = get();
      const liked = s.likedPosts.includes(key);
      const d = liked ? -1 : 1;
      const likedPosts = liked ? s.likedPosts.filter((k) => k !== key) : [...s.likedPosts, key];
      if (key.startsWith('standalone:')) {
        const id = Number(key.split(':')[1]);
        set({ likedPosts, posts: s.posts.map((p) => (p.id === id ? { ...p, likes: p.likes + d } : p)) });
      } else {
        const [, cid, pi] = key.split(':');
        set({ likedPosts, communities: s.communities.map((c) => (c.id === Number(cid) ? { ...c, posts: c.posts.map((p, i) => (i === Number(pi) ? { ...p, likes: p.likes + d } : p)) } : c)) });
      }
    },
    addComment: (key, author, text) => set((s) => ({ comments: { ...s.comments, [key]: [...(s.comments[key] || []), { author, text }] } })),
    donateDaily: (to) => {
      const today = weekdayShortDate();
      if (get().dailyPoint.lastGiven === today) return false;
      set((s) => ({ dailyPoint: { lastGiven: today, to }, dailyHistory: [{ date: today, to }, ...s.dailyHistory], receivedDaily: { ...s.receivedDaily, [to]: (s.receivedDaily[to] || 0) + 1 } }));
      return true;
    },
    reset: () => set({ ...blank() }),
  })),
);

export const newId = () => Date.now() + Math.floor(Math.random() * 1000);
void uid;

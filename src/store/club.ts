import { create } from 'zustand';

import { uid } from '@/lib/format';
import {
  DAILY_VOTE_LIMIT, advance, canRate, canVoteAnswer, cancelFree, cancelPremium, effectiveTier, follow as followM, joinFree as joinFreeM, newMembership, pausePremium, resumePremium, sanitizePricing, startPremium,
  type AnswerVote, type BillingPlan, type ChatConfig, type Club, type ClubComment, type ClubPost, type Course, type Lesson, type LessonProgress, type Level, type Membership, type MemberTier, type Section, type Viewer, type VoteCheck,
} from '@/lib/club';
import { SEED_CLUBS, SEED_COMMENTS } from '@/data/clubSeed';
import { persisted } from './persist';

type Rating = { stars: number; text?: string; ts: number };

type State = {
  /** gli esempi (club demo) sono stati caricati */
  seeded: boolean;
  clubs: Record<string, Club>;
  /** chiave `${clubId}|${utente}` */
  memberships: Record<string, Membership>;
  /** chiave `${utente}|${lessonId}` */
  progress: Record<string, LessonProgress>;
  /** note personali sulle lezioni (solo sul telefono) */
  notes: Record<string, string>;
  comments: ClubComment[];
  votes: AnswerVote[];
  ratings: Record<string, Record<string, Rating>>;

  seedDemo: () => void;
  createClub: (owner: string, p: Partial<Club> & { name: string }) => string;
  patchClub: (id: string, p: Partial<Club>) => void;
  setChatConfig: (id: string, p: Partial<ChatConfig>) => void;
  setPricing: (id: string, p: Partial<Club['pricing']>) => void;
  deleteClub: (id: string) => void;
  restoreClub: (club: Club, memberships: Membership[], comments: ClubComment[]) => void;

  addCourse: (clubId: string, p: { title: string; description?: string; level?: Level }) => string;
  patchCourse: (clubId: string, courseId: string, p: Partial<Course>) => void;
  removeCourse: (clubId: string, courseId: string) => void;
  addSection: (clubId: string, courseId: string, title: string) => string;
  removeSection: (clubId: string, courseId: string, sectionId: string) => void;
  addLesson: (clubId: string, courseId: string, p: Omit<Lesson, 'id' | 'order'> & { order?: number }) => string;
  patchLesson: (clubId: string, courseId: string, lessonId: string, p: Partial<Lesson>) => void;
  removeLesson: (clubId: string, courseId: string, lessonId: string) => void;
  addPost: (clubId: string, text: string, tier: 'free' | 'premium') => string;
  removePost: (clubId: string, postId: string) => void;
  togglePinPost: (clubId: string, postId: string) => void;

  putMembership: (m: Membership | undefined, user: string, clubId: string) => void;
  follow: (user: string, clubId: string) => void;
  joinFree: (user: string, clubId: string) => void;
  joinPremium: (user: string, clubId: string, plan: BillingPlan) => void;
  /** disiscrizione: free = subito; premium = a fine periodo pagato. Ritorna quando finisce l'accesso */
  cancel: (user: string, clubId: string) => { immediate: boolean; endsAt?: number };
  resume: (user: string, clubId: string) => void;
  pause: (user: string, clubId: string) => void;
  setMemberMute: (user: string, clubId: string, until: number | undefined) => void;
  ownerMuteMember: (clubId: string, user: string, on: boolean) => void;
  ownerRemoveMember: (clubId: string, user: string) => void;
  advanceBilling: (user: string) => void;

  addComment: (c: Omit<ClubComment, 'id' | 'ts' | 'likes' | 'saved'> & { ts?: number; id?: string }) => string;
  toggleLike: (commentId: string, user: string) => void;
  toggleSave: (commentId: string, user: string) => void;
  setResolved: (commentId: string, on: boolean) => void;
  linkChatMsg: (commentId: string, msgId: string) => void;
  deleteComment: (commentId: string) => void;

  setProgress: (user: string, lessonId: string, p: Partial<LessonProgress>) => void;
  setNote: (user: string, lessonId: string, text: string) => void;
  voteAnswer: (v: { clubId: string; answerId: string; questionId: string; asker: string; answerer: string; voter: string; stars: number; note?: string }) => VoteCheck;
  rateClub: (clubId: string, user: string, stars: number, text?: string) => VoteCheck;
  reset: () => void;
};

const initial = { seeded: false, clubs: {} as Record<string, Club>, memberships: {} as Record<string, Membership>, progress: {} as Record<string, LessonProgress>, notes: {} as Record<string, string>, comments: [] as ClubComment[], votes: [] as AnswerVote[], ratings: {} as Record<string, Record<string, Rating>> };

export const mkey = (clubId: string, user: string) => `${clubId}|${user}`;
export const pkey = (user: string, lessonId: string) => `${user}|${lessonId}`;

const COVERS: [string, string][] = [['#ff9966', '#ff5e62'], ['#36d1dc', '#5b86e5'], ['#56ab2f', '#a8e063'], ['#8e2de2', '#4a00e0'], ['#f7971e', '#ffd200'], ['#00b09b', '#96c93d']];

export const useClub = create<State>()(
  persisted<State>('club', (set, get) => {
    const patchOne = (id: string, fn: (c: Club) => Club) => set((s) => (s.clubs[id] ? { clubs: { ...s.clubs, [id]: fn(s.clubs[id]) } } : s));
    const patchCourse = (clubId: string, courseId: string, fn: (c: Course) => Course) => patchOne(clubId, (cl) => ({ ...cl, courses: cl.courses.map((c) => (c.id === courseId ? fn(c) : c)) }));
    const putM = (m: Membership) => set((s) => ({ memberships: { ...s.memberships, [mkey(m.clubId, m.user)]: m } }));
    return {
      ...initial,

      seedDemo: () => {
        if (get().seeded) return;
        set((s) => ({
          seeded: true,
          clubs: { ...Object.fromEntries(SEED_CLUBS.map((c) => [c.id, c])), ...s.clubs },
          comments: [...SEED_COMMENTS, ...s.comments.filter((c) => !SEED_COMMENTS.some((x) => x.id === c.id))],
        }));
      },
      createClub: (owner, p) => {
        const id = `club-${uid()}`;
        const cv = COVERS[Object.keys(get().clubs).length % COVERS.length];
        const club: Club = {
          id, owner, name: p.name.trim().slice(0, 60), tagline: p.tagline ?? '', description: p.description ?? '', cover: p.cover ?? { c1: cv[0], c2: cv[1] }, categories: p.categories ?? [],
          createdAt: Date.now(), published: false, pricing: sanitizePricing(p.pricing ?? {}), chat: p.chat ?? { write: 'members', chosen: [], slowSec: 0, commentsWhenReadOnly: true },
          courses: [], posts: [],
        };
        set((s) => ({ clubs: { ...s.clubs, [id]: club } }));
        return id;
      },
      patchClub: (id, p) => patchOne(id, (c) => ({ ...c, ...p, name: (p.name ?? c.name).trim().slice(0, 60) || c.name })),
      setChatConfig: (id, p) => patchOne(id, (c) => ({ ...c, chat: { ...c.chat, ...p, slowSec: Math.max(0, Math.min(3600, Math.round(p.slowSec ?? c.chat.slowSec))) } })),
      setPricing: (id, p) => patchOne(id, (c) => ({ ...c, pricing: sanitizePricing({ ...c.pricing, ...p }) })),
      deleteClub: (id) => set((s) => {
        const clubs = { ...s.clubs }; delete clubs[id];
        const memberships = Object.fromEntries(Object.entries(s.memberships).filter(([, m]) => m.clubId !== id));
        return { clubs, memberships, comments: s.comments.filter((c) => c.clubId !== id), votes: s.votes.filter((v) => v.clubId !== id) };
      }),
      restoreClub: (club, memberships, comments) => set((s) => ({
        clubs: { ...s.clubs, [club.id]: club },
        memberships: { ...s.memberships, ...Object.fromEntries(memberships.map((m) => [mkey(m.clubId, m.user), m])) },
        comments: [...s.comments, ...comments],
      })),

      addCourse: (clubId, p) => {
        const id = `co-${uid()}`;
        const sid = `se-${uid()}`;
        const course: Course = { id, title: p.title.trim().slice(0, 80), description: p.description ?? '', level: p.level ?? 'base', sections: [{ id: sid, title: 'Lezioni', order: 0 }], lessons: [], published: false, createdAt: Date.now() };
        patchOne(clubId, (c) => ({ ...c, courses: [...c.courses, course] }));
        return id;
      },
      patchCourse: (clubId, courseId, p) => patchCourse(clubId, courseId, (c) => ({ ...c, ...p })),
      removeCourse: (clubId, courseId) => patchOne(clubId, (c) => ({ ...c, courses: c.courses.filter((x) => x.id !== courseId) })),
      addSection: (clubId, courseId, title) => {
        const id = `se-${uid()}`;
        patchCourse(clubId, courseId, (c) => ({ ...c, sections: [...c.sections, { id, title: title.trim().slice(0, 60), order: c.sections.length } as Section] }));
        return id;
      },
      removeSection: (clubId, courseId, sectionId) => patchCourse(clubId, courseId, (c) => (c.sections.length <= 1 ? c : { ...c, sections: c.sections.filter((x) => x.id !== sectionId), lessons: c.lessons.filter((l) => l.sectionId !== sectionId) })),
      addLesson: (clubId, courseId, p) => {
        const id = `le-${uid()}`;
        patchCourse(clubId, courseId, (c) => ({ ...c, lessons: [...c.lessons, { ...p, id, order: p.order ?? c.lessons.filter((l) => l.sectionId === p.sectionId).length }] }));
        return id;
      },
      patchLesson: (clubId, courseId, lessonId, p) => patchCourse(clubId, courseId, (c) => ({ ...c, lessons: c.lessons.map((l) => (l.id === lessonId ? { ...l, ...p } : l)) })),
      removeLesson: (clubId, courseId, lessonId) => patchCourse(clubId, courseId, (c) => ({ ...c, lessons: c.lessons.filter((l) => l.id !== lessonId) })),
      addPost: (clubId, text, tier) => {
        const id = `po-${uid()}`;
        const post: ClubPost = { id, text: text.trim().slice(0, 1200), ts: Date.now(), tier };
        patchOne(clubId, (c) => ({ ...c, posts: [post, ...c.posts] }));
        return id;
      },
      removePost: (clubId, postId) => patchOne(clubId, (c) => ({ ...c, posts: c.posts.filter((p) => p.id !== postId) })),
      togglePinPost: (clubId, postId) => patchOne(clubId, (c) => ({ ...c, posts: c.posts.map((p) => (p.id === postId ? { ...p, pinned: !p.pinned } : p)) })),

      putMembership: (m, user, clubId) => set((s) => {
        const ms = { ...s.memberships };
        if (m) ms[mkey(clubId, user)] = m; else delete ms[mkey(clubId, user)];
        return { memberships: ms };
      }),
      follow: (user, clubId) => putM(followM(get().memberships[mkey(clubId, user)], user, clubId)),
      joinFree: (user, clubId) => putM(joinFreeM(get().memberships[mkey(clubId, user)], user, clubId)),
      joinPremium: (user, clubId, plan) => {
        const club = get().clubs[clubId];
        if (!club) return;
        putM(startPremium(get().memberships[mkey(clubId, user)], user, clubId, club.pricing, plan));
      },
      cancel: (user, clubId) => {
        const m = get().memberships[mkey(clubId, user)];
        if (!m) return { immediate: true };
        if (m.tier === 'premium' && m.status === 'attiva') {
          const n = cancelPremium(m);
          putM(n);
          return { immediate: false, endsAt: n.endsAt };
        }
        putM(cancelFree(m));
        return { immediate: true };
      },
      resume: (user, clubId) => { const m = get().memberships[mkey(clubId, user)]; if (m) putM(resumePremium(m)); },
      pause: (user, clubId) => { const m = get().memberships[mkey(clubId, user)]; if (m) putM(pausePremium(m)); },
      setMemberMute: (user, clubId, until) => { const m = get().memberships[mkey(clubId, user)]; if (m) putM({ ...m, mutedUntil: until }); },
      ownerMuteMember: (clubId, user, on) => { const m = get().memberships[mkey(clubId, user)]; if (m) putM({ ...m, mutedByOwner: on }); },
      ownerRemoveMember: (clubId, user) => { const m = get().memberships[mkey(clubId, user)]; if (m) putM({ ...cancelFree(m), tier: m.tier === 'premium' ? 'free' : m.tier }); },
      advanceBilling: (user) => {
        const ms = get().memberships; const next: Record<string, Membership> = {}; let ch = false;
        Object.entries(ms).forEach(([k, m]) => { if (m.user !== user) return; const a = advance(m); if (a !== m) { next[k] = a; ch = true; } });
        if (ch) set((s) => ({ memberships: { ...s.memberships, ...next } }));
      },

      addComment: (c) => {
        const id = c.id ?? `cm-${uid()}`;
        set((s) => ({ comments: [...s.comments, { ...c, id, ts: c.ts ?? Date.now(), likes: [], saved: [] }] }));
        return id;
      },
      toggleLike: (commentId, user) => set((s) => ({ comments: s.comments.map((c) => (c.id === commentId ? { ...c, likes: c.likes.includes(user) ? c.likes.filter((x) => x !== user) : [...c.likes, user] } : c)) })),
      toggleSave: (commentId, user) => set((s) => ({ comments: s.comments.map((c) => (c.id === commentId ? { ...c, saved: c.saved.includes(user) ? c.saved.filter((x) => x !== user) : [...c.saved, user] } : c)) })),
      setResolved: (commentId, on) => set((s) => ({ comments: s.comments.map((c) => (c.id === commentId ? { ...c, resolved: on } : c)) })),
      linkChatMsg: (commentId, msgId) => set((s) => ({ comments: s.comments.map((c) => (c.id === commentId ? { ...c, chatMsgId: msgId } : c)) })),
      deleteComment: (commentId) => set((s) => ({ comments: s.comments.filter((c) => c.id !== commentId && c.parentId !== commentId) })),

      setProgress: (user, lessonId, p) => set((s) => ({ progress: { ...s.progress, [pkey(user, lessonId)]: { ...s.progress[pkey(user, lessonId)], ...p, ts: Date.now() } } })),
      setNote: (user, lessonId, text) => set((s) => {
        const notes = { ...s.notes };
        if (text.trim()) notes[pkey(user, lessonId)] = text.slice(0, 4000); else delete notes[pkey(user, lessonId)];
        return { notes };
      }),
      voteAnswer: (v) => {
        const s = get();
        const m = s.memberships[mkey(v.clubId, v.voter)];
        const check = canVoteAnswer({
          voter: v.voter, asker: v.asker, answerer: v.answerer,
          voterEverJoined: canRate(m),
          alreadyVotedExchange: s.votes.some((x) => x.answerId === v.answerId && x.voter === v.voter),
          voterVoteTimes: s.votes.filter((x) => x.voter === v.voter).map((x) => x.ts),
        });
        if (!check.ok) return check;
        const vote: AnswerVote = { id: `vt-${uid()}`, clubId: v.clubId, answerId: v.answerId, questionId: v.questionId, asker: v.asker, voter: v.voter, answerer: v.answerer, stars: Math.min(5, Math.max(1, Math.round(v.stars))), note: v.note?.trim().slice(0, 140) || undefined, ts: Date.now() };
        set((st) => ({ votes: [...st.votes, vote] }));
        return { ok: true };
      },
      rateClub: (clubId, user, stars, text) => {
        const club = get().clubs[clubId];
        if (!club) return { ok: false, reason: 'LifeClub non trovato' };
        if (club.owner === user) return { ok: false, reason: 'Non puoi votare il tuo LifeClub' };
        if (!canRate(get().memberships[mkey(clubId, user)])) return { ok: false, reason: 'Puoi votare solo dopo esserti iscritto' };
        set((s) => ({ ratings: { ...s.ratings, [clubId]: { ...(s.ratings[clubId] ?? {}), [user]: { stars: Math.min(5, Math.max(1, Math.round(stars))), text: text?.trim().slice(0, 200) || undefined, ts: Date.now() } } } }));
        return { ok: true };
      },
      reset: () => set({ ...initial }),
    };
  }),
);

/* ---------- selettori ---------- */
export const clubByOwner = (s: Pick<State, 'clubs'>, owner: string): Club | undefined => Object.values(s.clubs).find((c) => c.owner === owner);
export const clubsOf = (s: Pick<State, 'clubs'>, owner: string): Club[] => Object.values(s.clubs).filter((c) => c.owner === owner);
export const membershipOf = (s: Pick<State, 'memberships'>, clubId: string, user: string): Membership | undefined => s.memberships[mkey(clubId, user)];
export const tierOf = (s: Pick<State, 'memberships'>, clubId: string, user: string): MemberTier | 'none' => effectiveTier(s.memberships[mkey(clubId, user)]);
export const viewerOf = (s: Pick<State, 'memberships'>, club: Club, user: string): Viewer & { mutedByOwner?: boolean } => ({ user, owner: club.owner, tier: tierOf(s, club.id, user), mutedByOwner: s.memberships[mkey(club.id, user)]?.mutedByOwner });

/** Conteggi: persone reali di questo telefono + eventuali iscritti dimostrativi dei club di esempio. */
export function memberCounts(s: Pick<State, 'memberships'>, club: Club) {
  const ms = Object.values(s.memberships).filter((m) => m.clubId === club.id);
  const by = { followers: 0, free: 0, premium: 0 };
  ms.forEach((m) => { const t = effectiveTier(m); if (t === 'follower') by.followers++; else if (t === 'free') by.free++; else if (t === 'premium') by.premium++; });
  const b = club.baseline ?? { followers: 0, free: 0, premium: 0 };
  const r = { followers: by.followers + b.followers, free: by.free + b.free, premium: by.premium + b.premium };
  return { ...r, subscribers: r.free + r.premium, total: r.followers + r.free + r.premium };
}

/** Club in cui l'utente e' attualmente iscritto (free o premium) o che segue. */
export const myClubs = (s: Pick<State, 'clubs' | 'memberships'>, user: string): Club[] =>
  Object.values(s.clubs).filter((c) => c.owner === user || effectiveTier(s.memberships[mkey(c.id, user)]) !== 'none');

/** Voti e segnali ricevuti da una persona come rispondente (tutti i club). */
export function answerSignalsFor(s: Pick<State, 'votes' | 'comments'>, person: string) {
  const votes = s.votes.filter((v) => v.answerer === person).map((v) => ({ stars: v.stars, asker: v.voter === v.asker }));
  const mine = s.comments.filter((c) => c.author === person && c.parentId);
  return { votes, likes: mine.reduce((a, c) => a + c.likes.length, 0), saves: mine.reduce((a, c) => a + c.saved.length, 0) };
}

export { DAILY_VOTE_LIMIT, newMembership };

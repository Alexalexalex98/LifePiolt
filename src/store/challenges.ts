import { create } from 'zustand';

import type { Challenge } from '@/lib/challenges';

import { persisted } from './persist';

type State = {
  list: Challenge[];
  add: (c: Omit<Challenge, 'id' | 'friend' | 'createdAt'>) => string;
  setFriend: (id: string, day: string, n: number) => void;
  remove: (id: string) => void;
};

export const useChallenges = create<State>()(
  persisted<State>('challenges', (set) => ({
    list: [],
    add: (c) => { const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`; set((s) => ({ list: [...s.list, { ...c, id, friend: {}, createdAt: Date.now() }] })); return id; },
    setFriend: (id, day, n) => set((s) => ({ list: s.list.map((c) => (c.id === id ? { ...c, friend: { ...c.friend, [day]: Math.max(0, Math.round(n)) } } : c)) })),
    remove: (id) => set((s) => ({ list: s.list.filter((c) => c.id !== id) })),
  })),
);

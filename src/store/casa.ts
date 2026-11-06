import { create } from 'zustand';

import { balanceDue, basePoints, complete, monthOf, pointsFor, slideBacklog, type Chore, type Done, type Member, type Room, type Verdict } from '@/lib/homeCare';
import { usePetHome } from '@/store/petHome';

import { persisted } from './persist';

/** Casa: stanze, faccende, famiglia, punti, riordini. Tutto sul telefono. Le stelline di Theia si guadagnano facendo le faccende (valori non mostrati). */
export type CompletedDone = Done & { prevDue?: string | null; prevLast?: string | null };
export type Tidy = { id: string; guide: string; room: string | null; started: string; done: number[]; before?: string; after?: string; beforeNote?: string; verdict?: Verdict; finished?: string };
export type CasaSettings = { budget: number; restDays: number[]; leaderboard: boolean; simple: boolean; lowEnergyDay?: string; slidAt?: string };
type State = {
  rooms: Room[]; chores: Chore[]; members: Member[]; log: CompletedDone[]; tidy: Tidy[]; floorplan?: string; me?: string; settings: CasaSettings;
  set: (p: Partial<Omit<State, 'set'>>) => void;
  setSettings: (p: Partial<CasaSettings>) => void;
  addRooms: (r: Room[]) => void; updateRoom: (id: string, p: Partial<Room>) => void; removeRoom: (id: string) => void;
  addChores: (c: Chore[], today: string) => void; updateChore: (id: string, p: Partial<Chore>) => void; removeChore: (id: string) => void;
  rebalance: (today: string, all?: boolean) => void; slide: (today: string) => void;
  doChore: (id: string, member: string, day: string) => number | null; undo: (doneId: string) => void;
  addMember: (m: Member) => void; updateMember: (id: string, p: Partial<Member>) => void; removeMember: (id: string) => void;
  upsertTidy: (t: Tidy) => void; removeTidy: (id: string) => void; finishTidy: (id: string, member: string, day: string, points: number) => void;
  clear: () => void;
};
const empty = { rooms: [] as Room[], chores: [] as Chore[], members: [] as Member[], log: [] as CompletedDone[], tidy: [] as Tidy[], floorplan: undefined as string | undefined, me: undefined as string | undefined, settings: { budget: 30, restDays: [], leaderboard: true, simple: false } as CasaSettings };
export const useCasa = create<State>()(persisted<State>('casa', (set, get) => ({
  ...empty,
  set: (p) => set(p),
  setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
  addRooms: (r) => set((s) => ({ rooms: [...s.rooms, ...r] })),
  updateRoom: (id, p) => set((s) => ({ rooms: s.rooms.map((r) => (r.id === id ? { ...r, ...p } : r)) })),
  removeRoom: (id) => set((s) => ({ rooms: s.rooms.filter((r) => r.id !== id), chores: s.chores.filter((c) => c.room !== id) })),
  addChores: (c, today) => set((s) => ({ chores: balanceDue([...s.chores, ...c], today, { budget: s.settings.budget, restDays: s.settings.restDays }) })),
  updateChore: (id, p) => set((s) => ({ chores: s.chores.map((c) => (c.id === id ? { ...c, ...p } : c)) })),
  removeChore: (id) => set((s) => ({ chores: s.chores.filter((c) => c.id !== id) })),
  rebalance: (today, all) => set((s) => ({ chores: balanceDue(s.chores, today, { budget: s.settings.budget, restDays: s.settings.restDays, all }) })),
  slide: (today) => { const s = get(); if (s.settings.slidAt === today) return; set({ chores: slideBacklog(s.chores, today, { budget: s.settings.budget, restDays: s.settings.restDays }), settings: { ...s.settings, slidAt: today } }); },
  doChore: (id, member, day) => {
    const s = get(); const c = s.chores.find((x) => x.id === id); if (!c) return null;
    const pts = pointsFor(c, s.log, day);
    const d: CompletedDone = { id: `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, chore: id, member, day, points: pts, ts: Date.now(), prevDue: c.due, prevLast: c.lastDone ?? null };
    set({ chores: s.chores.map((x) => (x.id === id ? complete(x, day) : x)), log: [...s.log, d].slice(-1500) });
    if (pts > 0 && member === (s.me ?? member)) usePetHome.getState().earn('chore'); // le stelline vanno a Theia di questo telefono
    return pts;
  },
  undo: (doneId) => set((s) => { const d = s.log.find((x) => x.id === doneId); if (!d) return {}; return { log: s.log.filter((x) => x.id !== doneId), chores: s.chores.map((c) => (c.id === d.chore ? { ...c, due: d.prevDue ?? c.due, lastDone: d.prevLast ?? undefined } : c)) }; }),
  addMember: (m) => set((s) => ({ members: [...s.members, m], me: s.me ?? m.id })),
  updateMember: (id, p) => set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, ...p } : m)) })),
  removeMember: (id) => set((s) => ({ members: s.members.filter((m) => m.id !== id), me: s.me === id ? s.members.find((m) => m.id !== id)?.id : s.me, chores: s.chores.map((c) => (c.assignee === id ? { ...c, assignee: null } : c)) })),
  upsertTidy: (t) => set((s) => ({ tidy: s.tidy.some((x) => x.id === t.id) ? s.tidy.map((x) => (x.id === t.id ? t : x)) : [...s.tidy, t] })),
  removeTidy: (id) => set((s) => ({ tidy: s.tidy.filter((x) => x.id !== id) })),
  finishTidy: (id, member, day, points) => { set((s) => ({ tidy: s.tidy.map((t) => (t.id === id ? { ...t, finished: day } : t)), log: [...s.log, { id: `t${id}`, chore: `tidy-${id}`, member, day, points, ts: Date.now() }] })); if (member === (get().me ?? member)) usePetHome.getState().earn('tidy'); },
  clear: () => set({ ...empty }),
}), (s) => ({ rooms: s.rooms, chores: s.chores, members: s.members, log: s.log, tidy: s.tidy, floorplan: s.floorplan, me: s.me, settings: s.settings }), { sensitive: true }));
export const monthKey = (day: string) => monthOf(day);
export { basePoints };

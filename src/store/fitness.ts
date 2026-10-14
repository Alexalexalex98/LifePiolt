import { create } from 'zustand';

import type { Gym } from '@/lib/fitness/data';
import type { Body, Macros } from '@/lib/fitness/nutrition';
import type { FitProfile, Workout } from '@/lib/fitness/plan';
import { checkIn, renewIfDue, startSub, PREMIUM_PRICE_LP, type Sub, type Visit } from '@/lib/fitness/premium';
import { useNet } from '@/store/network';
import { persisted } from './persist';

export type Meal = { id: string; ts: number; name: string; foodId?: string; grams: number; macros: Macros; photo?: string };
export type GymRequest = { id: string; ts: number; name: string; kind: Gym['kind']; city: string; address: string; email: string; services: string; status: 'in verifica' | 'approvata' };

type State = {
  profile: FitProfile | null;
  body: Body | null;
  activeProgram: string | null;
  history: Workout[];
  meals: Meal[];
  sub: Sub | null;
  visits: Visit[];
  requests: GymRequest[];
  approved: Gym[];
  set: (p: Partial<Omit<State, 'set'>>) => void;
  logWorkout: (w: Omit<Workout, 'id'>) => void;
  addMeal: (m: Omit<Meal, 'id'>) => void;
  delMeal: (id: string) => void;
  /** Attiva il Premium pagando con i LifePoints. */
  subscribe: () => { ok: boolean; message: string };
  setAutoRenew: (on: boolean) => void;
  /** Rinnova da solo se è scaduto (paga con i LifePoints) o chiude l'abbonamento. */
  settle: (now?: number) => void;
  enter: (gymId: string) => { ok: boolean; message: string };
  requestGym: (r: Omit<GymRequest, 'id' | 'ts' | 'status'>) => void;
  approveGym: (id: string) => void;
};
const uid = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Dati di LifeFitness: restano sul telefono (sono dati di salute). */
export const useFitness = create<State>()(
  persisted<State>('fitness', (set, get) => ({
    profile: null, body: null, activeProgram: null, history: [], meals: [], sub: null, visits: [], requests: [], approved: [],
    set: (p) => set(p),
    logWorkout: (w) => set((s) => ({ history: [...s.history, { ...w, id: uid() }].slice(-1000) })),
    addMeal: (m) => set((s) => ({ meals: [{ ...m, id: uid() }, ...s.meals].slice(0, 2000) })),
    delMeal: (id) => set((s) => ({ meals: s.meals.filter((m) => m.id !== id) })),
    subscribe: () => {
      const net = useNet.getState();
      if (!net.spend(PREMIUM_PRICE_LP, 'LifeFitness Premium (30 giorni)')) return { ok: false, message: `Servono ${PREMIUM_PRICE_LP} LifePoints: ne hai ${net.lifePoints}.` };
      set({ sub: startSub(Date.now()) });
      return { ok: true, message: 'Premium attivo per 30 giorni.' };
    },
    setAutoRenew: (on) => set((s) => (s.sub ? { sub: { ...s.sub, autoRenew: on } } : {})),
    settle: (now = Date.now()) => {
      const s = get();
      const r = renewIfDue(s.sub, now, useNet.getState().lifePoints);
      if (r.charged > 0) useNet.getState().spend(r.charged, 'LifeFitness Premium (rinnovo)');
      if (r.sub !== s.sub) set({ sub: r.sub });
    },
    enter: (gymId) => {
      const s = get();
      const c = checkIn(s.sub, s.visits, gymId, Date.now());
      if (!c.ok) return { ok: false, message: c.reason ?? 'Ingresso non possibile.' };
      set({ visits: [{ id: uid(), gymId, ts: Date.now() }, ...s.visits].slice(0, 2000) });
      return { ok: true, message: 'Ingresso registrato. Buon allenamento!' };
    },
    requestGym: (r) => set((s) => ({ requests: [{ ...r, id: uid(), ts: Date.now(), status: 'in verifica' as const }, ...s.requests] })),
    approveGym: (id) => set((s) => {
      const r = s.requests.find((x) => x.id === id);
      if (!r || r.status === 'approvata') return {};
      const gym: Gym = { id: `req-${r.id}`, name: r.name, kind: r.kind, city: r.city, address: r.address, services: r.services.split(',').map((x) => x.trim()).filter(Boolean), hours: 'Orari da definire', rating: 0 };
      return { requests: s.requests.map((x) => (x.id === id ? { ...x, status: 'approvata' as const } : x)), approved: [...s.approved, gym] };
    }),
  })),
);

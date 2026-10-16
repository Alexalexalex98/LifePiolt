import { create } from 'zustand';

import type { Gym, Step } from '@/lib/fitness/data';
import type { ExerciseX } from '@/lib/fitness/exerciseDb';
import type { Body, Macros } from '@/lib/fitness/nutrition';
import type { FitProfile, Workout } from '@/lib/fitness/plan';
import { creditsLeft, makePurchase, payBlock, priceList, consumeCredit, type Purchase } from '@/lib/fitness/gymPay';
import { checkIn, renewIfDue, startSub, PREMIUM_PRICE_LP, type Sub, type Visit } from '@/lib/fitness/premium';
import { useNet } from '@/store/network';
import { persisted } from './persist';

export type MealItem = { foodId: string; name: string; grams: number };
export type Meal = { id: string; ts: number; name: string; foodId?: string; grams: number; macros: Macros; photo?: string; /** ingredienti scelti uno per uno */ items?: MealItem[] };
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
  /** esercizi creati da te */
  customEx: ExerciseX[];
  /** ingressi pagati in LifePoints con il QR */
  purchases: Purchase[];
  /** le tue modifiche alle sessioni dei programmi (chiave «programma:sessione») */
  edits: Record<string, Step[]>;
  set: (p: Partial<Omit<State, 'set'>>) => void;
  logWorkout: (w: Omit<Workout, 'id'>) => void;
  addMeal: (m: Omit<Meal, 'id'>) => void;
  delMeal: (id: string) => void;
  /** Paga una voce del listino di un centro (in LifePoints) e ottieni gli ingressi. */
  payGym: (gym: Gym, itemId: string) => { ok: boolean; message: string };
  addCustomEx: (e: ExerciseX) => void;
  delCustomEx: (id: string) => void;
  setEdit: (key: string, steps: Step[]) => void;
  resetEdit: (key: string) => void;
  /** Attiva il LifePass pagando con i LifePoints. */
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
    profile: null, body: null, activeProgram: null, history: [], meals: [], sub: null, visits: [], requests: [], approved: [], customEx: [], purchases: [], edits: {},
    set: (p) => set(p),
    logWorkout: (w) => set((s) => ({ history: [...s.history, { ...w, id: uid() }].slice(-1000) })),
    addMeal: (m) => set((s) => ({ meals: [{ ...m, id: uid() }, ...s.meals].slice(0, 2000) })),
    delMeal: (id) => set((s) => ({ meals: s.meals.filter((m) => m.id !== id) })),
    payGym: (gym, itemId) => {
      const item = priceList(gym).find((x) => x.id === itemId);
      if (!item) return { ok: false, message: 'Voce non trovata nel listino del centro.' };
      const net = useNet.getState();
      const block = payBlock(net.lifePoints, item.lp);
      if (block) return { ok: false, message: block };
      if (!net.spend(item.lp, `${gym.name} · ${item.label}`, gym.name)) return { ok: false, message: 'Pagamento non riuscito.' };
      const now = Date.now();
      set((s) => ({ purchases: [makePurchase(uid(), gym, item, now), ...s.purchases].slice(0, 300) }));
      return { ok: true, message: item.entries > 1 ? `Pagato ${item.lp} LP: hai ${item.entries} ingressi.` : `Pagato ${item.lp} LP: ingresso pronto.` };
    },
    addCustomEx: (e) => set((s) => ({ customEx: [e, ...s.customEx.filter((x) => x.id !== e.id)].slice(0, 300) })),
    delCustomEx: (id) => set((s) => ({ customEx: s.customEx.filter((x) => x.id !== id) })),
    setEdit: (key, steps) => set((s) => ({ edits: { ...s.edits, [key]: steps } })),
    resetEdit: (key) => set((s) => { const e = { ...s.edits }; delete e[key]; return { edits: e }; }),
    subscribe: () => {
      const net = useNet.getState();
      if (!net.spend(PREMIUM_PRICE_LP, 'LifeFitness LifePass (30 giorni)')) return { ok: false, message: `Servono ${PREMIUM_PRICE_LP} LifePoints: ne hai ${net.lifePoints}.` };
      set({ sub: startSub(Date.now()) });
      return { ok: true, message: 'LifePass attivo per 30 giorni.' };
    },
    setAutoRenew: (on) => set((s) => (s.sub ? { sub: { ...s.sub, autoRenew: on } } : {})),
    settle: (now = Date.now()) => {
      const s = get();
      const r = renewIfDue(s.sub, now, useNet.getState().lifePoints);
      if (r.charged > 0) useNet.getState().spend(r.charged, 'LifeFitness LifePass (rinnovo)');
      if (r.sub !== s.sub) set({ sub: r.sub });
    },
    enter: (gymId) => {
      const s = get();
      const now = Date.now();
      const c = checkIn(s.sub, s.visits, gymId, now);
      if (c.ok) {
        set({ visits: [{ id: uid(), gymId, ts: now }, ...s.visits].slice(0, 2000) });
        return { ok: true, message: 'Ingresso registrato. Buon allenamento!' };
      }
      /* senza LifePass: si usa un ingresso pagato in LifePoints (uno al giorno per centro) */
      if (creditsLeft(s.purchases, gymId, now) > 0 && !s.visits.some((v) => v.gymId === gymId && new Date(v.ts).toDateString() === new Date(now).toDateString())) {
        const u = consumeCredit(s.purchases, gymId, now);
        set({ purchases: u.list, visits: [{ id: uid(), gymId, ts: now }, ...s.visits].slice(0, 2000) });
        return { ok: true, message: `Ingresso registrato (ne restano ${creditsLeft(u.list, gymId, now)}). Buon allenamento!` };
      }
      return { ok: false, message: c.reason ?? 'Ingresso non possibile.' };
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

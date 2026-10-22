import { create } from 'zustand';

import type { Gym, Step } from '@/lib/fitness/data';
import type { ExerciseX } from '@/lib/fitness/exerciseDb';
import { registerFood, type Body, type Food, type Macros } from '@/lib/fitness/nutrition';
import type { FitProfile, Workout } from '@/lib/fitness/plan';
import { creditsLeft, makePurchase, payBlock, priceList, consumeCredit, type Purchase } from '@/lib/fitness/gymPay';
import { checkIn, renewIfDue, startSub, PREMIUM_PRICE_LP, type Sub, type Visit } from '@/lib/fitness/premium';
import { useNet } from '@/store/network';
import { dayOf } from '@/lib/fitness/mealInsights';
import { DEFAULT_LUNCH, type LunchAnswer, type LunchCfg } from '@/lib/fitness/lunch';
import type { Override } from '@/lib/fitness/dayPlan';
import { persisted } from './persist';

export type MealItem = { foodId: string; name: string; grams: number };
export type Meal = { id: string; ts: number; name: string; foodId?: string; grams: number; macros: Macros; photo?: string; /** ingredienti scelti uno per uno */ items?: MealItem[] };
import type { Invite } from '@/lib/fitness/gymSearch';
export type GymRequest = { id: string; ts: number; name: string; kind: Gym['kind']; city: string; address: string; email: string; services: string; status: 'in verifica' | 'approvata' };

type State = {
  profile: FitProfile | null;
  body: Body | null;
  activeProgram: string | null;
  history: Workout[];
  meals: Meal[];
  /** acqua bevuta, in ml, per giorno (AAAA-MM-GG) */
  water: Record<string, number>;
  /** promemoria per bere ogni tot, e domanda serale su cibo e acqua (disattivabili) */
  waterRemind: { on: boolean; everyMin: number; from: string; to: string };
  eveningCheck: { on: boolean; at: string };
  sub: Sub | null;
  visits: Visit[];
  requests: GymRequest[];
  approved: Gym[];
  /** centri non convenzionati che hai proposto di invitare, e come è andata */
  invites: Invite[];
  /** esercizi creati da te */
  customEx: ExerciseX[];
  /** alimenti stimati dall'AI dalle foto dei piatti (servono per rileggere i pasti salvati) */
  aiFoods: Food[];
  /** ingressi pagati in LifePoints con il QR */
  purchases: Purchase[];
  /** le tue modifiche alle sessioni dei programmi (chiave «programma:sessione») */
  edits: Record<string, Step[]>;
  /** giorno scelto da te (un'altra sessione, oppure riposo), per data */
  plans: Record<string, Override>;
  /** banner «hai bevuto?» all'apertura dell'app: acceso/spento e dopo quanti minuti senza acqua segnata */
  waterBanner: { on: boolean; afterMin: number; snoozeUntil: number };
  /** ultima volta che hai segnato acqua o una bevanda */
  lastDrink: number;
  /** pausa pranzo, risposte «hai mangiato?» per giorno e rinvio */
  lunch: LunchCfg;
  lunchLog: Record<string, LunchAnswer>;
  lunchSnooze: number;
  setLunch: (p: Partial<LunchCfg>) => void;
  answerLunch: (day: string, a: LunchAnswer, snoozeMin?: number) => void;
  setWaterBanner: (p: Partial<State['waterBanner']>) => void;
  /** esercizi spuntati per data: `key` è la sessione a cui si riferiscono */
  exDone: Record<string, { key: string; idx: number[] }>;
  setDayPlan: (date: string, o: Override | null) => void;
  toggleEx: (date: string, key: string, k: number, total: number, w: { programId: string; session: number; minutes: number; sets: number }) => void;
  finishDay: (date: string, key: string, total: number) => void;
  set: (p: Partial<Omit<State, 'set'>>) => void;
  logWorkout: (w: Omit<Workout, 'id'>) => void;
  addMeal: (m: Omit<Meal, 'id'>) => void;
  delMeal: (id: string) => void;
  addWater: (ml: number, day?: string) => number;
  setWaterRemind: (p: Partial<State['waterRemind']>) => void;
  setEveningCheck: (p: Partial<State['eveningCheck']>) => void;
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
  inviteGym: (name: string) => void;
  setInviteStatus: (id: string, status: Invite['status']) => void;
};
const uid = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Dati di LifeFitness: restano sul telefono (sono dati di salute). */
export const useFitness = create<State>()(
  persisted<State>('fitness', (set, get) => ({
    profile: null, body: null, activeProgram: null, history: [], meals: [], water: {}, waterRemind: { on: false, everyMin: 120, from: '09:00', to: '21:00' }, eveningCheck: { on: true, at: '20:45' }, sub: null, visits: [], requests: [], approved: [], invites: [], customEx: [], aiFoods: [], purchases: [], edits: {}, plans: {}, exDone: {}, waterBanner: { on: true, afterMin: 120, snoozeUntil: 0 }, lastDrink: 0, lunch: DEFAULT_LUNCH, lunchLog: {}, lunchSnooze: 0,
    setLunch: (p) => set((s) => ({ lunch: { ...(s.lunch ?? DEFAULT_LUNCH), ...p } })),
    answerLunch: (day, a, snoozeMin) => set((s) => ({ lunchLog: { ...(s.lunchLog ?? {}), [day]: a }, lunchSnooze: snoozeMin ? Date.now() + snoozeMin * 60000 : 0 })),
    setWaterBanner: (p) => set((s) => ({ waterBanner: { ...(s.waterBanner ?? { on: true, afterMin: 120, snoozeUntil: 0 }), ...p } })),
    setDayPlan: (date, o) => set((s) => { const plans = { ...(s.plans ?? {}) }; if (o) plans[date] = o; else delete plans[date]; const exDone = { ...(s.exDone ?? {}) }; delete exDone[date]; return { plans, exDone }; }),
    toggleEx: (date, key, k, total, w) => set((s) => {
      const cur = (s.exDone ?? {})[date];
      const idx = new Set(cur && cur.key === key ? cur.idx : []);
      if (idx.has(k)) idx.delete(k); else idx.add(k);
      const done = idx.size >= total;
      let history = s.history;
      const mine = history.find((h) => h.date === date);
      if (done && !mine) history = [...history, { id: uid(), date, ...w, auto: true }].slice(-1000);
      if (!done && mine?.auto) history = history.filter((h) => h !== mine);
      return { exDone: { ...(s.exDone ?? {}), [date]: { key, idx: [...idx].sort((a, b) => a - b) } }, history };
    }),
    finishDay: (date, key, total) => set((s) => ({ exDone: { ...(s.exDone ?? {}), [date]: { key, idx: Array.from({ length: total }, (_, i) => i) } } })),
    set: (p) => set(p),
    logWorkout: (w) => set((s) => ({ history: [...s.history, { ...w, id: uid() }].slice(-1000) })),
    addMeal: (m) => set((s) => ({ meals: [{ ...m, id: uid() }, ...s.meals].slice(0, 2000) })),
    delMeal: (id) => set((s) => ({ meals: s.meals.filter((m) => m.id !== id) })),
    addWater: (ml, day) => {
      const k = day ?? dayOf(Date.now());
      const total = Math.max(0, Math.round(((get().water ?? {})[k] ?? 0) + ml));
      set((s) => ({ water: { ...(s.water ?? {}), [k]: total }, ...(ml > 0 && k === dayOf(Date.now()) ? { lastDrink: Date.now() } : null) }));
      return total;
    },
    setWaterRemind: (p) => set((s) => ({ waterRemind: { ...s.waterRemind, ...p } })),
    setEveningCheck: (p) => set((s) => ({ eveningCheck: { ...s.eveningCheck, ...p } })),
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
    inviteGym: (name) => set((s) => (s.invites.some((i) => i.name.toLowerCase() === name.trim().toLowerCase()) ? {} : { invites: [{ id: uid(), name: name.trim().slice(0, 60), ts: Date.now(), status: 'invitato' as const }, ...s.invites] })),
    setInviteStatus: (id, status) => set((s) => ({ invites: s.invites.map((i) => (i.id === id ? { ...i, status } : i)) })),
    requestGym: (r) => set((s) => ({ requests: [{ ...r, id: uid(), ts: Date.now(), status: 'in verifica' as const }, ...s.requests] })),
    approveGym: (id) => set((s) => {
      const r = s.requests.find((x) => x.id === id);
      if (!r || r.status === 'approvata') return {};
      const gym: Gym = { id: `req-${r.id}`, name: r.name, kind: r.kind, city: r.city, address: r.address, services: r.services.split(',').map((x) => x.trim()).filter(Boolean), hours: 'Orari da definire', rating: 0 };
      return { requests: s.requests.map((x) => (x.id === id ? { ...x, status: 'approvata' as const } : x)), approved: [...s.approved, gym] };
    }),
  })),
);

/** Gli alimenti stimati dall'AI tornano disponibili per id appena lo store e' caricato (e a ogni nuova stima). */
useFitness.subscribe((s) => { for (const f of s.aiFoods ?? []) registerFood(f); });
for (const f of useFitness.getState().aiFoods ?? []) registerFood(f);

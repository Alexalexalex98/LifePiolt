import { create } from 'zustand';

import { addStock, consume, norm, syncShopping, type Line, type PantryItem, type ShopItem, type Unit } from '@/lib/fitness/pantry';
import { generatePlan, type PlanDay, type PlanPrefs } from '@/lib/fitness/mealPlan';
import { uid } from '@/lib/format';
import { useApp } from './app';
import { useChat } from './chat';
import { persisted } from './persist';

type State = {
  items: PantryItem[];
  shop: ShopItem[];
  plan: PlanDay[] | null;
  prefs: PlanPrefs;
  seed: number;
  /** con chi condividi frigo e lista della spesa */
  shared: string[];
  /** quando segni un pasto, si toglie dal frigo */
  autoConsume: boolean;
  addLines: (lines: Line[]) => number;
  consumeFood: (foodId: string, grams: number) => void;
  consumeMeal: (m: { foodId?: string; grams: number; items?: { foodId: string; grams: number }[] }) => void;
  setQty: (id: string, qty: number) => void;
  setMin: (id: string, min: number) => void;
  removeItem: (id: string) => void;
  addShop: (name: string, qty?: number, unit?: Unit) => void;
  toggleShop: (id: string) => void;
  removeShop: (id: string) => void;
  /** la spesa è fatta: ciò che hai spuntato va nel frigo */
  finishShopping: () => number;
  setPrefs: (p: Partial<PlanPrefs>) => void;
  makePlan: (again?: boolean) => string[];
  setPlan: (p: PlanDay[]) => void;
  setShared: (names: string[]) => void;
  setAutoConsume: (v: boolean) => void;
  /** manda la lista della spesa a chi condividi (in chat) */
  shareShopping: () => number;
};

/** Frigo virtuale, lista della spesa e piano alimentare: restano sul telefono; la condivisione manda la lista in chat. */
export const usePantry = create<State>()(persisted<State>('pantry', (set, get) => {
  /** Ricalcola ciò che sta finendo; se compaiono voci nuove e il frigo è condiviso, avvisa in chat. */
  const sync = () => {
    const r = syncShopping(get().shop, get().items, uid);
    if (r.added.length) { set({ shop: r.shop }); if (get().shared.length) get().shareShopping(); }
  };
  return {
    items: [], shop: [], plan: null, shared: [], autoConsume: true, seed: 0,
    prefs: { diet: 'onnivoro', avoid: [], meals: 4, kcal: 2000 },
    addLines: (lines) => {
      let items = get().items;
      const now = Date.now();
      for (const l of lines) if (l.name.trim() && l.qty > 0) items = addStock(items, l, uid(), now);
      // ciò che compri e stava in lista si toglie dalla lista
      const bought = new Set(lines.map((l) => norm(l.name)));
      set({ items, shop: get().shop.filter((s) => !(s.auto && bought.has(norm(s.name)))) });
      return lines.length;
    },
    consumeFood: (foodId, grams) => { set({ items: consume(get().items, foodId, grams) }); sync(); },
    consumeMeal: (m) => {
      if (!get().autoConsume) return;
      const list = m.items?.length ? m.items : m.foodId ? [{ foodId: m.foodId, grams: m.grams }] : [];
      let items = get().items;
      for (const it of list) items = consume(items, it.foodId, it.grams);
      set({ items }); sync();
    },
    setQty: (id, qty) => { set({ items: get().items.map((x) => (x.id === id ? { ...x, qty: Math.max(0, qty) } : x)) }); sync(); },
    setMin: (id, min) => set({ items: get().items.map((x) => (x.id === id ? { ...x, min: Math.max(0, min) } : x)) }),
    removeItem: (id) => set({ items: get().items.filter((x) => x.id !== id) }),
    addShop: (name, qty, unit) => { const n = name.trim(); if (!n || get().shop.some((s) => !s.done && norm(s.name) === norm(n))) return; set({ shop: [{ id: uid(), name: n.slice(0, 60), ...(qty ? { qty } : {}), ...(unit ? { unit } : {}), done: false }, ...get().shop] }); },
    toggleShop: (id) => set({ shop: get().shop.map((s) => (s.id === id ? { ...s, done: !s.done } : s)) }),
    removeShop: (id) => set({ shop: get().shop.filter((s) => s.id !== id) }),
    finishShopping: () => {
      const done = get().shop.filter((s) => s.done);
      const n = get().addLines(done.map((s) => ({ name: s.name, qty: s.qty ?? 1, unit: s.unit ?? 'pz' })));
      set({ shop: get().shop.filter((s) => !s.done) });
      return n;
    },
    setPrefs: (p) => set({ prefs: { ...get().prefs, ...p } }),
    makePlan: (again) => { const seed = again ? get().seed + 1 : get().seed; const r = generatePlan(get().prefs, seed); set({ plan: r.days, seed }); return r.warnings; },
    setPlan: (p) => set({ plan: p }),
    setShared: (names) => set({ shared: names }),
    setAutoConsume: (v) => set({ autoConsume: v }),
    shareShopping: () => {
      const me = useApp.getState().account.name;
      const open = get().shop.filter((s) => !s.done);
      if (!open.length) return 0;
      const chat = useChat.getState();
      for (const who of get().shared) {
        try { chat.send(chat.ensureDm(who, me), me, { kind: 'tasks', taskList: { title: 'Lista della spesa', items: open.map((s) => ({ t: `${s.name}${s.qty ? ` · ${s.qty} ${s.unit ?? ''}` : ''}`.trim(), done: false })) } }); } catch { /* chat non disponibile */ }
      }
      return get().shared.length;
    },
  };
}));

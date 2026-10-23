import { create } from 'zustand';

import { buy, newHome, place, repair, rewardFor, sell, unplace, upgrade, type EarnLog, type HomeState, type Kind, type RoomId } from '@/lib/petHome';
import { MILESTONES } from '@/lib/petMilestones';

import { persisted } from './persist';

type State = HomeState & {
  room: RoomId;
  claimed: string[];
  log: EarnLog;
  /** funzioni del gioco già scoperte (viste almeno una volta) */
  seen: string[];
  markSeen: (id: string) => void;
  /** una cosa vera è stata fatta: arrivano stelline (quante, l'utente non lo sa) */
  earn: (kind: string) => void;
  setRoom: (r: RoomId) => void;
  addCoins: (n: number) => void;
  buyItem: (id: string) => { ok: boolean; reason?: string; uid?: string };
  repairItem: (uid: string) => { ok: boolean; reason?: string };
  placeItem: (room: RoomId, uid: string) => { ok: boolean; reason?: string };
  unplaceItem: (room: RoomId, kind: Kind) => void;
  sellItem: (uid: string) => { ok: boolean; reason?: string };
  upgradeHouse: (level: number) => { ok: boolean; reason?: string };
  claim: (id: string) => { ok: boolean; xp: number; coins: number };
};

const snap = (s: State): HomeState => ({ coins: s.coins, owned: s.owned, placed: s.placed, tier: s.tier });

export const usePetHome = create<State>()(
  persisted<State>('petHome', (set, get) => ({
    ...newHome(),
    room: 'living',
    claimed: [],
    log: [],
    seen: [],
    markSeen: (id) => set((s) => ((s.seen ?? []).includes(id) ? s : { seen: [...(s.seen ?? []), id] })),
    earn: (kind) => set((s) => { const n = rewardFor(kind, s.log ?? [], Date.now()); return { coins: s.coins + n, log: [...(s.log ?? []), { k: kind, ts: Date.now() }].slice(-300) }; }),
    setRoom: (room) => set({ room }),
    addCoins: (n) => set((s) => ({ coins: s.coins + n })),
    buyItem: (id) => { const r = buy(snap(get()), id, Date.now()); if (r.ok) set(r.state); return { ok: r.ok, reason: r.reason, uid: r.state.owned[r.state.owned.length - 1]?.uid }; },
    repairItem: (uid) => { const r = repair(snap(get()), uid, Date.now()); if (r.ok) set(r.state); return { ok: r.ok, reason: r.reason }; },
    placeItem: (room, uid) => { const r = place(snap(get()), room, uid); if (r.ok) set(r.state); return { ok: r.ok, reason: r.reason }; },
    unplaceItem: (room, kind) => set(unplace(snap(get()), room, kind)),
    sellItem: (uid) => { const r = sell(snap(get()), uid); if (r.ok) set(r.state); return { ok: r.ok, reason: r.reason }; },
    upgradeHouse: (level) => { const r = upgrade(snap(get()), level); if (r.ok) set(r.state); return { ok: r.ok, reason: r.reason }; },
    claim: (id) => {
      const m = MILESTONES.find((x) => x.id === id); const s = get();
      if (!m || s.claimed.includes(id)) return { ok: false, xp: 0, coins: 0 };
      let st = { ...snap(s), coins: s.coins + m.reward.coins };
      if (m.reward.item) st = { ...st, owned: [...st.owned, { uid: `g${Date.now().toString(36)}${st.owned.length}`, item: m.reward.item, boughtAt: Date.now() }] };
      set({ ...st, claimed: [...s.claimed, id] });
      return { ok: true, xp: m.reward.xp, coins: m.reward.coins };
    },
  })),
);

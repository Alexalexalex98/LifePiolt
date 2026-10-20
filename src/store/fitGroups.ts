import { create } from 'zustand';

import { MAX_GROUP, paidUntil, type FitGroup, type GroupInput, type GroupLevel, validateGroup } from '@/lib/fitness/groups';
import { useNet } from '@/store/network';
import { persisted } from './persist';

const uid = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
type Create = GroupInput & { desc: string; city: string; level: GroupLevel; owner: string };

type State = {
  groups: FitGroup[];
  seeded: boolean;
  create: (i: Create) => { ok: boolean; message: string; id?: string };
  requestJoin: (id: string, me: string) => { ok: boolean; message: string };
  decide: (id: string, name: string, accept: boolean) => void;
  /** gruppo a pagamento: paga in LifePoints e sei dentro per 30 giorni */
  payJoin: (id: string, me: string) => { ok: boolean; message: string };
  leave: (id: string, me: string) => void;
  remove: (id: string) => void;
  seedDemo: () => void;
};

const joinCommunity = (communityId: number, name: string) => {
  const net = useNet.getState();
  net.patch({ communities: net.communities.map((c) => (c.id === communityId && !c.members.includes(name) ? { ...c, members: [...c.members, name] } : c)) });
};
const leaveCommunity = (communityId: number, name: string) => {
  const net = useNet.getState();
  net.patch({ communities: net.communities.map((c) => (c.id === communityId ? { ...c, members: c.members.filter((m) => m !== name) } : c)) });
};

/** Gruppi di allenamento di LifeFitness. Ogni gruppo ha la sua community. */
export const useFitGroups = create<State>()(
  persisted<State>('fitgroups', (set, get) => ({
    groups: [], seeded: false,
    create: (i) => {
      const reasons = validateGroup(i, get().groups);
      if (reasons.length) return { ok: false, message: reasons[0] };
      const net = useNet.getState();
      const communityId = Date.now() + Math.floor(Math.random() * 1000);
      net.patch({ communities: [{ id: communityId, name: i.name.trim(), topic: 'Fitness', owner: i.owner, openPosting: false, members: [i.owner], posts: [], desc: i.desc.trim() || undefined, ts: Date.now() }, ...net.communities] });
      const g: FitGroup = { id: uid(), ts: Date.now(), name: i.name.trim(), owner: i.owner, kind: i.kind, priceLP: i.kind === 'paid' ? i.priceLP : 0, max: Math.min(MAX_GROUP, i.max), level: i.level, desc: i.desc.trim(), city: i.city.trim(), ...(i.gym ? { gymId: i.gym.id } : {}), ...(i.day != null ? { day: i.day } : {}), ...(i.hour != null ? { hour: i.hour } : {}), communityId, members: [i.owner], requests: [], declined: [], paidUntil: {} };
      set((s) => ({ groups: [g, ...s.groups] }));
      return { ok: true, message: 'Gruppo creato: ha già la sua community', id: g.id };
    },
    requestJoin: (id, me) => {
      const g = get().groups.find((x) => x.id === id);
      if (!g || g.kind !== 'free') return { ok: false, message: 'Gruppo non trovato.' };
      if (g.members.includes(me) || g.requests.some((r) => r.name === me)) return { ok: false, message: 'Hai già chiesto di entrare.' };
      if (g.members.length >= g.max) return { ok: false, message: 'Il gruppo è al completo.' };
      set((s) => ({ groups: s.groups.map((x) => (x.id === id ? { ...x, declined: x.declined.filter((n) => n !== me), requests: [...x.requests, { name: me, ts: Date.now() }] } : x)) }));
      return { ok: true, message: `Richiesta inviata a ${g.owner}: decide lui o lei se accettarti` };
    },
    decide: (id, name, accept) => {
      const g = get().groups.find((x) => x.id === id); if (!g) return;
      if (accept && g.members.length >= g.max) return;
      set((s) => ({ groups: s.groups.map((x) => (x.id === id ? { ...x, requests: x.requests.filter((r) => r.name !== name), members: accept ? [...x.members, name] : x.members, declined: accept ? x.declined : [...x.declined, name] } : x)) }));
      if (accept) joinCommunity(g.communityId, name);
    },
    payJoin: (id, me) => {
      const g = get().groups.find((x) => x.id === id);
      if (!g || g.kind !== 'paid') return { ok: false, message: 'Gruppo non trovato.' };
      const isMember = g.members.includes(me);
      if (!isMember && g.members.length >= g.max) return { ok: false, message: 'Il gruppo è al completo.' };
      const net = useNet.getState();
      if (net.lifePoints < g.priceLP) return { ok: false, message: `Servono ${g.priceLP} LifePoints: ne hai ${net.lifePoints}.` };
      if (!net.spend(g.priceLP, `LifeFitness · gruppo ${g.name}`, g.owner)) return { ok: false, message: 'Pagamento non riuscito.' };
      const until = paidUntil(Date.now());
      set((s) => ({ groups: s.groups.map((x) => (x.id === id ? { ...x, members: isMember ? x.members : [...x.members, me], paidUntil: { ...x.paidUntil, [me]: until } } : x)) }));
      joinCommunity(g.communityId, me);
      return { ok: true, message: `Pagato ${g.priceLP} LP: sei nel gruppo per 30 giorni` };
    },
    leave: (id, me) => {
      const g = get().groups.find((x) => x.id === id); if (!g || g.owner === me) return;
      set((s) => ({ groups: s.groups.map((x) => (x.id === id ? { ...x, members: x.members.filter((m) => m !== me), requests: x.requests.filter((r) => r.name !== me) } : x)) }));
      leaveCommunity(g.communityId, me);
    },
    remove: (id) => set((s) => ({ groups: s.groups.filter((g) => g.id !== id) })),
    /** Esempi per la modalità demo: persone e gruppi inventati, segnati come tali. */
    seedDemo: () => {
      if (get().seeded) return;
      const net = useNet.getState();
      const mk = (name: string, topic: string, owner: string, members: string[], desc: string) => ({ id: Date.now() + Math.floor(Math.random() * 100000), name, topic, owner, openPosting: false, members, posts: [], desc, ts: Date.now() });
      const c1 = mk('Corsa sul lungolago', 'Fitness', 'Marta', ['Marta', 'Luca', 'Sara'], 'Corsa lenta insieme, ognuno al suo passo.');
      const c2 = mk('Forza per tutti', 'Fitness', 'Davide', ['Davide', 'Elena', 'Paolo', 'Giulia', 'Marco', 'Anna', 'Fabio'], 'Allenamento a corpo libero e pesi in gruppo.');
      const c3 = mk('Yoga del mattino', 'Fitness', 'Chiara', ['Chiara', 'Irene'], 'Yoga dolce per iniziare bene la giornata.');
      net.patch({ communities: [c1, c2, c3, ...net.communities] });
      const g = (cm: ReturnType<typeof mk>, o: Partial<FitGroup>): FitGroup => ({ id: uid(), ts: Date.now(), name: cm.name, owner: cm.owner, kind: 'free', priceLP: 0, max: 8, level: 'tutti', desc: cm.desc ?? '', city: 'Lugano', communityId: cm.id, members: cm.members, requests: [], declined: [], paidUntil: {}, demo: true, ...o });
      set((s) => ({ seeded: true, groups: [...s.groups, g(c1, { level: 'principiante', day: 5, hour: 8, max: 12 }), g(c2, { kind: 'paid', priceLP: 25, max: 12, level: 'intermedio', gymId: 'g1', day: 1, hour: 10, paidUntil: Object.fromEntries(c2.members.map((m) => [m, Date.now() + 20 * 86400000])) }), g(c3, { kind: 'paid', priceLP: 15, max: 6, day: 2, hour: 7, paidUntil: { Chiara: Date.now() + 9 * 86400000, Irene: Date.now() + 9 * 86400000 } })] }));
    },
  })),
);

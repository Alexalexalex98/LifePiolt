// Helper dei test di sincronizzazione: store finti in memoria, dispositivi con motore e transport verso un server finto.
import { SyncEngine, memoryState } from '../src/sync/engine.ts';
import { COLLECTIONS } from '../src/sync/registry.ts';
import { MockServer, MockServerTransport } from '../src/sync/mockServer.ts';

export function fakeStore(initial) {
  let s = initial;
  const ls = new Set();
  return {
    getState: () => s,
    setState: (p) => { const prev = s; s = { ...s, ...(typeof p === 'function' ? p(s) : p) }; ls.forEach((l) => l(s, prev)); },
    subscribe: (l) => { ls.add(l); return () => ls.delete(l); },
    listeners: () => ls.size,
  };
}

export const initialStores = () => ({
  life: fakeStore({ tasks: [], goals: [], notes: [], drive: [], events: {}, vacations: [] }),
  health: fakeStore({ workouts: [], mindSessions: [], moods: [] }),
  travel: fakeStore({ saved: [] }),
  interests: fakeStore({ selected: [], custom: [] }),
  network: fakeStore({ posts: [], ideas: [], following: [], votes: {}, ledger: [], bookings: [], enrollments: [] }),
  chat: fakeStore({ chats: {}, messages: {} }),
  club: fakeStore({ clubs: {}, memberships: {} }),
});

export const manualScheduler = () => { const q = []; return { set: (fn, ms) => { q.push({ fn, ms }); return q.length; }, clear() {}, q, runAll() { const l = q.splice(0); l.forEach((x) => x.fn()); } }; };

/** Un dispositivo: store finti + motore + transport. `clock.t` e' l'ora simulata. */
export function makeDevice(server, name, { enable = [], codec, faults = {}, seed = 1, clock = { t: 1_800_000_000_000 }, config = {}, stores, online = () => true, state } = {}) {
  const st = stores ?? initialStores();
  const mem = state ?? memoryState({ deviceId: name + '-' + 'dev0000', deviceName: name });
  const transport = new MockServerTransport(server, { deviceId: mem.get().deviceId, deviceName: name }, faults, seed);
  const sched = manualScheduler();
  let rs = ([...name].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7) + Math.imul(seed, 0x9e3779b1)) >>> 0;
  const next = () => { rs = (rs + 0x6d2b79f5) >>> 0; let t = rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return (t ^ (t >>> 14)) >>> 0; };
  const rand = (n) => { const o = new Uint8Array(n); for (let i = 0; i < n; i++) o[i] = next() & 255; return o; };
  const engine = new SyncEngine({
    bindings: st, collections: COLLECTIONS, state: mem, getTransport: () => transport, getCodec: codec ? () => codec : undefined,
    now: () => clock.t, rand, scheduler: sched, isOnline: online, config: { debounceMs: 0, autoRetry: false, pollMs: 0, ...config },
  });
  for (const c of enable) engine.setCategoryEnabled(c, true);
  return { name, stores: st, state: mem, engine, transport, clock, sched };
}

export async function connected(server, name, opts) {
  const d = makeDevice(server, name, opts);
  await d.transport.connect();
  d.engine.start();
  return d;
}

export const ALL_CATS = ['plan_agenda', 'plan_tasks', 'plan_notes', 'plan_goals', 'plan_mood', 'health_activity', 'loc_trips', 'doc_drive', 'pub_interests', 'net_posts', 'net_follow', 'net_points', 'club_public'];

/** Sincronizza finche' non c'e' piu' nulla da inviare/ricevere (max n giri). */
export async function settle(devs, n = 6) {
  for (let i = 0; i < n; i++) for (const d of devs) { d.engine.captureAll(); await d.engine.syncNow(); }
}
/** Stato "logico" confrontabile di uno store (senza campi solo locali). */
export const view = (d, store, key) => JSON.stringify(d.stores[store].getState()[key]);

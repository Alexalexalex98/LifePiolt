import seed from '@/data/network-seed.json';
import { demoAutomations, demoBills, demoDoneTasks, demoDrive, demoEvents, demoGoals, demoHealth, demoInsights, demoMonths, demoNotes, demoTasks } from '@/data/seed';
import { shortDate } from '@/lib/format';
import { defaultBudget, defaultCategories, defaultWatchlist, useFin } from './finance';
import { ensureDates, useHealth } from './health';
import { seedJobs } from '@/data/jobsSeed';
import { useChat, type ChatMessage } from './chat';
import { useJobs } from './jobs';
import { useLife } from './life';
import { useNet } from './network';
import { useTravel } from './travel';

/** Sostituisce il nome del prototipo con quello dell'utente e le date relative con date reali. */
function personalise<T>(data: T, me: string): T {
  return JSON.parse(JSON.stringify(data), (_k, v) => {
    if (v === 'Alex') return me;
    if (typeof v === 'string' && /^@\d+$/.test(v)) return shortDate(Number(v.slice(1)));
    if (typeof v === 'string' && v.startsWith('Alex Club')) return v.replace('Alex', me);
    return v;
  });
}


/** Chat di esempio (solo modalità demo). */
function seedChats(me: string) {
  const DAY = 86400000;
  const chats: Record<string, import('./chat').Chat> = {};
  const messages: Record<string, ChatMessage[]> = {};
  const add = (id: string, from: string, text: string, ago: number, extra: Partial<ChatMessage> = {}) => {
    const m: ChatMessage = { id: `demo-${id}-${(messages[id] ??= []).length}`, chatId: id, from, kind: 'text', text, ts: Date.now() - ago, status: 'read', ...extra };
    messages[id].push(m);
  };
  const dm = (name: string, lastRead: number) => { const id = `dm:${name}`; chats[id] = { id, type: 'dm', name, members: [me, name], admins: [], lastRead, createdAt: Date.now() - 6 * DAY }; return id; };
  const a = dm('Marco T.', Date.now() - 2 * DAY);
  add(a, 'Marco T.', 'Ciao! Ho visto la tua idea AURA, fantastica.', 3 * DAY);
  add(a, me, 'Grazie mille! Sto lavorando al prototipo hardware in questi giorni.', 3 * DAY - 600000);
  add(a, 'Marco T.', 'Fammi sapere se cerchi beta tester, mi piacerebbe provarlo.', 2 * DAY + 3600000);
  const b = dm('Giulia M.', Date.now() - 5 * DAY);
  add(b, 'Giulia M.', 'Ci vediamo per la corsa di domenica?', 3 * 3600000);
  const g = 'g:demo-run';
  chats[g] = { id: g, type: 'group', name: 'Corsa della domenica', members: [me, 'Giulia M.', 'Tommaso V.', 'Federica L.'], admins: [me], lastRead: Date.now() - DAY, createdAt: Date.now() - 9 * DAY, pinned: true };
  add(g, 'system', `${me} ha creato il gruppo "Corsa della domenica"`, 9 * DAY, { kind: 'system', from: 'system' });
  add(g, 'Tommaso V.', 'Ritrovo alle 8:00 al lago?', 26 * 3600000);
  add(g, me, 'Per me va benissimo 👍', 25 * 3600000, { status: 'read', reactions: { 'Tommaso V.': '👍' } });
  add(g, 'Federica L.', 'Io porto le barrette energetiche 🍫', 2 * 3600000);
  useChat.setState({ chats, messages });
}

/** Carica i dati d'esempio del prototipo in tutti gli store. */
export function applyDemo(me: string, email = '') {
  useLife.setState({ tasks: [...demoTasks(), ...demoDoneTasks()], goals: demoGoals(), automations: demoAutomations(), notes: demoNotes(), drive: demoDrive(), events: demoEvents() });
  const h = demoHealth();
  const series = { ...useHealth.getState().series, ...h.series };
  const dates = { ...useHealth.getState().dates };
  (Object.keys(h.series) as (keyof typeof h.series)[]).forEach((k) => { dates[k] = ensureDates(h.series[k], undefined); });
  useHealth.setState({ series, dates, sources: Object.fromEntries(Object.keys(h.series).map((k) => [k, 'demo'])), workouts: h.workouts, mindSessions: h.mindSessions, moods: h.moods });
  seedChats(me);
  { const j = seedJobs(me); useJobs.setState({ jobs: j.jobs, applications: j.applications, practice: j.practice }); useNet.setState((st) => ({ votes: { ...st.votes, ...j.votes } })); }
  const months = demoMonths();
  useFin.setState({
    months, insights: demoInsights(), savingsPct: 6.5, bills: demoBills(), cash: 5000, stocks: defaultWatchlist(true),
    tax: { married: false, children: false, banks: ['UBS'], docs: {} },
    budget: defaultBudget(6500, true, defaultCategories, months),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const n = personalise(seed as any, me);
  useNet.setState({
    lifePoints: 2840, ledger: n.ledger, identity: { verified: true, country: 'Svizzera', birthYear: 1998 }, following: n.following, suggested: n.suggested,
    posts: n.posts, communities: n.communities, providers: n.providers, ideas: n.ideas, seminars: n.seminars,
    notifications: n.notifications, dailyHistory: n.dailyHistory,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cards: n.cards.map((c: any) => ({ ...c, holder: me })), defaultCard: n.cards[0]?.id ?? null,
    bio: 'Founder di Life SA · costruisco LifePilot', myCard: { ...n.myCard, email: email || n.myCard.email },
  });
}

export function resetAllData() {
  useNet.getState().reset();
  useChat.getState().reset();
  useJobs.getState().reset();
  useLife.getState().reset();
  useHealth.getState().reset();
  useFin.getState().reset();
  useTravel.getState().reset();
}

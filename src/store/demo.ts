import seed from '@/data/network-seed.json';
import { demoAutomations, demoBills, demoDrive, demoEvents, demoGoals, demoHealth, demoInsights, demoMonths, demoNotes, demoTasks } from '@/data/seed';
import { shortDate } from '@/lib/format';
import { defaultBudget, defaultCategories, defaultWatchlist, useFin } from './finance';
import { useHealth } from './health';
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

/** Carica i dati d'esempio del prototipo in tutti gli store. */
export function applyDemo(me: string, email = '') {
  useLife.setState({ tasks: demoTasks(), goals: demoGoals(), automations: demoAutomations(), notes: demoNotes(), drive: demoDrive(), events: demoEvents() });
  const h = demoHealth();
  useHealth.setState({ series: h.series, workouts: h.workouts, mindSessions: h.mindSessions, moods: h.moods });
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
    posts: n.posts, communities: n.communities, providers: n.providers, ideas: n.ideas, seminars: n.seminars, conversations: n.conversations,
    notifications: n.notifications, dailyHistory: n.dailyHistory,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cards: n.cards.map((c: any) => ({ ...c, holder: me })), defaultCard: n.cards[0]?.id ?? null,
    bio: 'Founder di Life SA · costruisco LifePilot', myCard: { ...n.myCard, email: email || n.myCard.email },
  });
}

export function resetAllData() {
  useNet.getState().reset();
  useLife.getState().reset();
  useHealth.getState().reset();
  useFin.getState().reset();
  useTravel.getState().reset();
}

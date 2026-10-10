import { create } from 'zustand';

import { appendSendLog, type Consents, type SendLogEntry } from '@/lib/aiRouter/privacy';
import { record, type PlanId, type UsageEntry } from '@/lib/aiRouter/quota';
import { DEFAULT_PREFS, type AiPrefs } from '@/lib/aiRouter/select';
import type { TaskGroup } from '@/lib/aiRouter/types';

import { persisted } from './persist';

/** Intelligenza di Theia: preferenze, piano, consensi per fornitore, contatori d'uso e cronologia "Cosa è stato inviato". Tutto sul telefono. */
type State = {
  prefs: AiPrefs;
  planId: PlanId;
  consents: Consents;
  usage: UsageEntry[];
  sendLog: SendLogEntry[];
  setPrefs: (p: Partial<AiPrefs>) => void;
  setTaskPref: (g: TaskGroup, v: string) => void;
  toggleBlocked: (providerId: string) => void;
  setPlan: (p: PlanId) => void;
  grantAlways: (providerId: string) => void;
  revokeConsent: (providerId: string) => void;
  addUsage: (e: UsageEntry) => void;
  addLog: (e: SendLogEntry) => void;
  removeLog: (id: string) => void;
  restoreLog: (e: SendLogEntry) => void;
  clearLog: () => void;
  restoreAllLog: (l: SendLogEntry[]) => void;
  /** solo in sviluppo */
  resetUsageDev: () => void;
  reset: () => void;
};

export const useAiRouter = create<State>()(
  persisted<State>('aiRouter', (set) => ({
    prefs: DEFAULT_PREFS,
    planId: 'free',
    consents: {},
    usage: [],
    sendLog: [],
    setPrefs: (p) => set((s) => ({ prefs: { ...s.prefs, ...p } })),
    setTaskPref: (g, v) => set((s) => ({ prefs: { ...s.prefs, taskPref: { ...s.prefs.taskPref, [g]: v } } })),
    toggleBlocked: (id) => set((s) => ({ prefs: { ...s.prefs, blockedProviders: s.prefs.blockedProviders.includes(id) ? s.prefs.blockedProviders.filter((x) => x !== id) : [...s.prefs.blockedProviders, id] } })),
    setPlan: (planId) => set({ planId }),
    grantAlways: (id) => set((s) => ({ consents: { ...s.consents, [id]: { always: true, at: Date.now() } } })),
    revokeConsent: (id) => set((s) => { const c = { ...s.consents }; delete c[id]; return { consents: c }; }),
    addUsage: (e) => set((s) => ({ usage: record(s.usage, e, e.ts) })),
    addLog: (e) => set((s) => ({ sendLog: appendSendLog(s.sendLog, e) })),
    removeLog: (id) => set((s) => ({ sendLog: s.sendLog.filter((x) => x.id !== id) })),
    restoreLog: (e) => set((s) => ({ sendLog: [...s.sendLog, e].sort((a, b) => b.ts - a.ts) })),
    clearLog: () => set({ sendLog: [] }),
    restoreAllLog: (sendLog) => set({ sendLog }),
    resetUsageDev: () => { if (typeof __DEV__ !== 'undefined' && __DEV__) set({ usage: [] }); },
    reset: () => set({ prefs: DEFAULT_PREFS, planId: 'free', consents: {}, usage: [], sendLog: [] }),
  })),
);

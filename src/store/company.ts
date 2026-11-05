import { create } from 'zustand';

import { DEFAULT_NOTIF, type Audit, type Country, type NotifPrefs } from '@/lib/companyWork';
import { persisted } from './persist';

/** Impostazioni dell'azienda (dal server), pagine riservate, cronologia, e le mie scelte personali (sul telefono). */
export type Settings = { team_id: string; country: Country; currency: 'EUR' | 'CHF'; ai_plan: boolean; ai_all: boolean; ai_members: string[] };
export type LockedPage = { id: string; title: string; parent: string | null; unlocked: boolean; mine: boolean };
type State = {
  settings: Record<string, Settings>;
  ai: Record<string, { plan: boolean; covered: boolean }>;
  locked: Record<string, LockedPage[]>;
  audit: Record<string, Audit[]>;
  /** le mie scelte: uso il mio account personale per Theia nel lavoro, notifiche per workspace */
  personalAi: boolean;
  notif: Record<string, NotifPrefs>;
  setServer: (team: string, p: Partial<{ settings: Settings; ai: { plan: boolean; covered: boolean }; locked: LockedPage[]; audit: Audit[] }>) => void;
  set: (p: Partial<Pick<State, 'personalAi' | 'notif'>>) => void;
};
export const useCompany = create<State>()(persisted<State>('company', (set) => ({
  settings: {}, ai: {}, locked: {}, audit: {}, personalAi: true, notif: {},
  setServer: (team, p) => set((s) => ({
    settings: p.settings ? { ...s.settings, [team]: p.settings } : s.settings,
    ai: p.ai ? { ...s.ai, [team]: p.ai } : s.ai,
    locked: p.locked ? { ...s.locked, [team]: p.locked } : s.locked,
    audit: p.audit ? { ...s.audit, [team]: p.audit } : s.audit,
  })),
  set: (p) => set(p),
}), (s) => ({ personalAi: s.personalAi, notif: s.notif, settings: s.settings })));
export const notifOf = (team: string | undefined, all: Record<string, NotifPrefs>): NotifPrefs => (team && all[team]) || DEFAULT_NOTIF;
export const countryOf = (team: string | undefined, all: Record<string, Settings>): Country => (team && all[team]?.country) || 'IT';
export const currencyOf = (team: string | undefined, all: Record<string, Settings>): 'EUR' | 'CHF' => (team && all[team]?.currency) || 'EUR';

import { create } from 'zustand';

import { setErrorScreen } from '@/lib/errorLog';

import { persisted } from './persist';

export type Appearance = 'Scuro' | 'Chiaro' | 'Sistema';
import { infoOf, type LangCode } from '@/i18n/languages';

/** Codice lingua (it, en, es, ...). Le versioni vecchie salvavano il nome ("Italiano"): si normalizza all'avvio. */
export type Language = LangCode;

export const navCatalog: Record<string, string> = {
  home: 'Home', ai: 'AI', lifenetwork: 'Network', lifefinance: 'Finance', profile: 'Profilo', lifehealth: 'LifeHealth',
  lifenotes: 'LifeNotes', lifetravel: 'LifeTravel', lifedrive: 'LifeDrive', lifetask: 'LifeTask', lifepointsPage: 'LifePoints',
  plan: 'Plan', settings: 'Settings',
};

type Device = { name: string; detail: string; current: boolean };

type AppState = {
  onboarded: boolean;
  demo: boolean;
  account: { name: string; email: string; photo?: string };
  appearance: Appearance;
  language: Language;
  timeFormat: '24h' | '12h';
  /** codice ISO della valuta mostrata (i dati non vengono convertiti: è solo l'unità); di default segue la lingua finché non la scegli a mano */
  currency: string;
  currencyManual: boolean;
  notif: { push: boolean; calendar: boolean; finance: boolean; health: boolean; digest: boolean; email: boolean };
  /** briefing locali: riepilogo del mattino e della sera (orari HH:MM) */
  briefing: { morning: boolean; morningAt: string; evening: boolean; eveningAt: string };
  security: { twofa: boolean; lock: boolean };
  accessibility: { textLg: boolean; reduceMotion: boolean; highContrast: boolean };
  navItems: string[];
  pageVisits: Record<string, number>;
  /** quante volte, per ogni pagina, l'hai aperta in ciascuna ora del giorno (serve a Theia per capire le tue abitudini) */
  visitHours: Record<string, number[]>;
  assistantName: string;
  dismissedNav: string[];
  workHours: { start: string; end: string };
  devices: Device[];
  integrations: Record<string, boolean>;
  privacy: Record<string, boolean>;
  dataLocal: Record<string, boolean>;
  set: (patch: Partial<AppState>) => void;
  trackVisit: (p: string) => void;
  reset: () => void;
};

const initial = {
  onboarded: false,
  demo: false,
  account: { name: '', email: '' },
  appearance: 'Scuro' as Appearance,
  language: 'it' as Language,
  timeFormat: '24h' as const,
  currency: 'CHF',
  currencyManual: false,
  notif: { push: false, calendar: true, finance: true, health: false, digest: false, email: false },
  briefing: { morning: false, morningAt: '07:45', evening: false, eveningAt: '20:30' },
  security: { twofa: false, lock: false },
  accessibility: { textLg: false, reduceMotion: false, highContrast: false },
  navItems: ['home', 'ai', 'lifenetwork', 'lifefinance', 'profile'],
  pageVisits: {} as Record<string, number>,
  visitHours: {} as Record<string, number[]>,
  assistantName: 'Theia',
  dismissedNav: [] as string[],
  workHours: { start: '09:00', end: '18:00' },
  devices: [{ name: 'Questo dispositivo', detail: 'Sessione attuale', current: true }] as Device[],
  integrations: { Calendario: true, Health: false, Email: false, Wearable: false, 'Smart Home': false } as Record<string, boolean>,
  privacy: { 'AI Memory': true, 'Dati salute': false, 'Dati finanziari': false, Posizione: false } as Record<string, boolean>,
  dataLocal: {} as Record<string, boolean>,
};

export const useApp = create<AppState>()(
  persisted<AppState>('app', (set) => ({
    ...initial,
    set: (patch) => set((st) => {
      // cambiando lingua, la valuta segue la lingua finché non è stata scelta a mano
      if (patch.language && patch.currency === undefined && !st.currencyManual) return { ...patch, currency: infoOf(patch.language).currency };
      if (patch.currency !== undefined && patch.currencyManual === undefined) return { ...patch, currencyManual: true };
      return patch;
    }),
    trackVisit: (p) => set((s) => {
      setErrorScreen(p);
      if (!navCatalog[p]) return s;
      const h = new Date().getHours();
      const arr = (s.visitHours?.[p] ?? Array(24).fill(0)).slice();
      arr[h] = (arr[h] || 0) + 1;
      return { pageVisits: { ...s.pageVisits, [p]: (s.pageVisits[p] || 0) + 1 }, visitHours: { ...(s.visitHours ?? {}), [p]: arr } };
    }),
    reset: () => set({ ...initial }),
  })),
);

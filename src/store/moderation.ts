import { create } from 'zustand';

import { uid } from '@/lib/format';
import { addReport, makeReport, modKey, removeReport, type HiddenMap, type ModKind, type ModReport, type ReasonId } from '@/lib/modRules';
import { persisted } from './persist';

/**
 * Segnalazioni e contenuti nascosti. Tutto resta sul dispositivo (non esiste ancora un servizio online):
 * le segnalazioni verranno inviate quando il servizio sara' disponibile. Gli utenti bloccati sono quelli di useChat.blocked.
 */
type ModState = {
  reports: ModReport[];
  hidden: HiddenMap;
  report: (p: { kind: ModKind; ref: string | number; label: string; author?: string; reason: ReasonId; note?: string }) => void;
  cancelReport: (id: string) => void;
  hide: (kind: ModKind, ref: string | number, label: string) => void;
  unhide: (key: string) => void;
  reset: () => void;
};

export const useMod = create<ModState>()(
  persisted<ModState>('moderation', (set) => ({
    reports: [],
    hidden: {},
    report: (p) => set((s) => ({ reports: addReport(s.reports, makeReport(p, uid(), Date.now())) })),
    cancelReport: (id) => set((s) => ({ reports: removeReport(s.reports, id) })),
    hide: (kind, ref, label) => set((s) => ({ hidden: { ...s.hidden, [modKey(kind, ref)]: { label: label.length > 80 ? label.slice(0, 78) + '…' : label, kind, ts: Date.now() } } })),
    unhide: (key) => set((s) => { const hidden = { ...s.hidden }; delete hidden[key]; return { hidden }; }),
    reset: () => set({ reports: [], hidden: {} }),
  })),
);

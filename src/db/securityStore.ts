import { create } from 'zustand';

import { persisted } from '@/store/persist';

/** Impostazioni di sicurezza di QUESTO telefono (non vanno nei backup). */
type SecurityState = {
  lockEnabled: boolean;
  /** minuti in background prima di richiedere lo sblocco: 0 = sempre */
  lockTimeoutMin: number;
  lastMaintenanceAt: number;
  set: (p: Partial<Pick<SecurityState, 'lockEnabled' | 'lockTimeoutMin' | 'lastMaintenanceAt'>>) => void;
  reset: () => void;
};

const initial = { lockEnabled: false, lockTimeoutMin: 1, lastMaintenanceAt: 0 };

export const useSecurity = create<SecurityState>()(
  persisted<SecurityState>('security', (set) => ({
    ...initial,
    set: (p) => set(p),
    reset: () => set({ ...initial }),
  })),
);

/** Stato temporaneo del blocco (non salvato). */
type LockRuntime = { locked: boolean; busy: boolean; message: string; setLocked: (v: boolean) => void; setBusy: (v: boolean) => void; setMessage: (m: string) => void };
export const useLockRuntime = create<LockRuntime>()((set) => ({
  locked: false, busy: false, message: '',
  setLocked: (locked) => set({ locked }),
  setBusy: (busy) => set({ busy }),
  setMessage: (message) => set({ message }),
}));

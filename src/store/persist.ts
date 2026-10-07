import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateCreator } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Salvataggio su dispositivo con chiave versionata. */
export function persisted<S>(name: string, creator: StateCreator<S, [['zustand/persist', unknown]], []>, partialize?: (s: S) => Partial<S>) {
  return persist<S>(creator, { name: `lp2-${name}`, storage: createJSONStorage(() => AsyncStorage), ...(partialize ? { partialize: partialize as (s: S) => S } : {}) });
}

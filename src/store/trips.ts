import { create } from 'zustand';

import type { Trip } from '@/lib/tripWork';

/** Trasferte del workspace. Solo in memoria: le vede chi viaggia e chi approva, e il server lo controlla. */
type State = { items: Record<string, Trip[]>; set: (team: string, items: Trip[]) => void };
export const useTrips = create<State>()((set) => ({ items: {}, set: (team, items) => set((s) => ({ items: { ...s.items, [team]: items } })) }));

import { create } from 'zustand';

/** Le persone di ogni workspace con ruolo e posizione (solo in memoria: le legge il server). */
export type Person = { user_id: string; role: 'owner' | 'admin' | 'member'; position: string | null; reports_to: string | null; name: string };
type State = { people: Record<string, Person[]>; me: string | null; set: (team: string, p: Person[]) => void; setMe: (id: string | null) => void };
export const usePeople = create<State>()((set) => ({ people: {}, me: null, set: (team, p) => set((s) => ({ people: { ...s.people, [team]: p } })), setMe: (me) => set({ me }) }));

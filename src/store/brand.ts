import { create } from 'zustand';

import type { Brand } from '@/lib/reports';
import { persisted } from './persist';

/** Dati aziendali per intestazione e piè di pagina dei PDF, e il logo già pronto (data URI) per stamparlo senza rete. */
type State = { brand: Record<string, Brand>; set: (team: string, b: Brand) => void };
export const EMPTY_BRAND: Brand = { company: '', address: '', email: '', phone: '', vat: '', footer: '', color: '#0F766E', logo: null };
export const useBrand = create<State>()(persisted<State>('brand', (set) => ({ brand: {}, set: (team, b) => set((s) => ({ brand: { ...s.brand, [team]: b } })) }), (s) => ({ brand: s.brand })));
export const brandOf = (team: string | undefined, all: Record<string, Brand>): Brand => (team && all[team]) || EMPTY_BRAND;

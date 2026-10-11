import { create } from 'zustand';

import { EMPTY_IDENTITY, resolveRequest, submitRequest, type Business, type DocType, type IdentityRecord } from '@/lib/profile/identity';
import { respond, requestBlockReason, validateDeclare, type Declared, type VerifRequest } from '@/lib/profile/skills';
import { qaBlockReason, type QaVote } from '@/lib/profile/reputation';
import type { CardDesign } from '@/lib/profile/card';
import { useNet } from './network';
import { persisted } from './persist';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/**
 * Identità, attività, biglietto da visita, competenze dichiarate e voti alle risposte. Salvato sul telefono.
 * Del documento d'identità NON si conserva nulla: qui c'è solo lo stato della richiesta (vedi docs/profile.md).
 */
type State = {
  identity: IdentityRecord;
  businesses: Business[];
  /** composizione del biglietto (JSON validato da sanitizeDesign) */
  design: CardDesign | null;
  /** ruolo/mestiere dichiarato dall'utente per il biglietto */
  role: string;
  /** attività da mostrare sul biglietto */
  cardBusinessId: string | null;
  declared: Declared[];
  requests: VerifRequest[];
  qaVotes: QaVote[];
  /** titolari ai quali ho già dato il voto al profilo con l'iscrizione a un LifeClub */
  profileVoted: string[];
  /** creazione dell'account su questo telefono: serve per l'anzianità del votante */
  since: number;

  submitIdentity: (doc: DocType, got: Partial<Record<'front' | 'back', boolean>>, selfie: boolean, preview: boolean) => boolean;
  resolveIdentity: (ok: boolean, reason?: string) => void;
  resetIdentity: () => void;
  addBusiness: (b: Omit<Business, 'id' | 'createdAt'>) => string;
  updateBusiness: (id: string, p: Partial<Business>) => void;
  removeBusiness: (id: string) => Business | null;
  restoreBusiness: (b: Business) => void;
  setDesign: (d: CardDesign) => void;
  patch: (p: Partial<Pick<State, 'role' | 'cardBusinessId'>>) => void;
  declare: (label: string, id?: string) => string | null;
  undeclare: (id: string) => Declared | null;
  restoreDeclared: (d: Declared) => void;
  requestVerification: (by: string, to: string, skill: string, note?: string) => { ok: boolean; why?: string; id?: string };
  respondVerification: (id: string, accept: boolean) => boolean;
  castQa: (v: QaVote) => string | null;
  reset: () => void;
};

const blank = () => ({ identity: EMPTY_IDENTITY, businesses: [] as Business[], design: null as CardDesign | null, role: '', cardBusinessId: null as string | null, declared: [] as Declared[], requests: [] as VerifRequest[], qaVotes: [] as QaVote[], profileVoted: [] as string[], since: Date.now() });

export const useIdentity = create<State>()(
  persisted<State>('identity', (set, get) => ({
    ...blank(),
    submitIdentity: (doc, got, selfie, preview) => {
      const rec = submitRequest(doc, got, selfie, Date.now(), preview);
      if (!rec) return false;
      set({ identity: rec });
      // LifeNetwork si apre in modalità leggera appena il documento è inviato (vedi docs/profile.md)
      const cur = useNet.getState().identity;
      useNet.getState().patch({ identity: { ...cur, verified: true, country: cur.country || 'Svizzera' } });
      return true;
    },
    resolveIdentity: (ok, reason) => {
      const next = resolveRequest(get().identity, ok, Date.now(), reason);
      set({ identity: next });
      if (next.status === 'rejected') useNet.getState().patch({ identity: { ...useNet.getState().identity, verified: false } });
    },
    resetIdentity: () => { set({ identity: EMPTY_IDENTITY }); useNet.getState().patch({ identity: { ...useNet.getState().identity, verified: false } }); },
    addBusiness: (b) => { const id = uid(); set((s) => ({ businesses: [...s.businesses, { ...b, id, createdAt: Date.now() }] })); return id; },
    updateBusiness: (id, p) => set((s) => ({ businesses: s.businesses.map((b) => (b.id === id ? { ...b, ...p, id: b.id, owner: b.owner } : b)) })),
    removeBusiness: (id) => { const b = get().businesses.find((x) => x.id === id) ?? null; if (b) set((s) => ({ businesses: s.businesses.filter((x) => x.id !== id), cardBusinessId: s.cardBusinessId === id ? null : s.cardBusinessId })); return b; },
    restoreBusiness: (b) => set((s) => (s.businesses.some((x) => x.id === b.id) ? s : { businesses: [...s.businesses, b] })),
    setDesign: (design) => set({ design }),
    patch: (p) => set(p),
    declare: (label, id) => {
      const why = validateDeclare(label, get().declared);
      if (why) return why;
      const l = label.trim();
      set((s) => ({ declared: [...s.declared, { id: id ?? l, label: l, declaredAt: Date.now() }] }));
      return null;
    },
    undeclare: (id) => { const d = get().declared.find((x) => x.id === id) ?? null; if (d) set((s) => ({ declared: s.declared.filter((x) => x.id !== id) })); return d; },
    restoreDeclared: (d) => set((s) => (s.declared.some((x) => x.id === d.id) ? s : { declared: [...s.declared, d] })),
    requestVerification: (by, to, skill, note) => {
      const why = requestBlockReason(by, to, skill, get().requests);
      if (why) return { ok: false, why };
      const id = uid();
      set((s) => ({ requests: [...s.requests, { id, skill, by, to, createdAt: Date.now(), status: 'requested', note: note?.slice(0, 200) }] }));
      return { ok: true, id };
    },
    respondVerification: (id, accept) => {
      const r = get().requests.find((x) => x.id === id);
      const next = r && respond(r, accept, Date.now());
      if (!next) return false;
      set((s) => ({ requests: s.requests.map((x) => (x.id === id ? next : x)) }));
      return true;
    },
    castQa: (v) => {
      const why = qaBlockReason(v.from, v.to, v.ref ?? '', get().qaVotes, v.ts);
      if (why) return why;
      set((s) => ({ qaVotes: [...s.qaVotes, v] }));
      return null;
    },
    reset: () => set({ ...blank() }),
  })),
);

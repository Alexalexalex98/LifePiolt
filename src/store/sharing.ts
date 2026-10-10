import { useMemo } from 'react';
import { create } from 'zustand';

import { agendaMaxMode, allPrivate, CATALOG, defaultChoices, isLocked, itemOf, normalizeChoices, optionOf, setChoice, type AgendaMode, type CatalogItem, type Choices } from '@/lib/dataCatalog';
import { useApp } from './app';
import { useNet, type MyCard } from './network';
import { persisted } from './persist';

/**
 * "Cosa condivido". Le scelte sono salvate qui, ma per le voci che l'app già collegava a un'impostazione esistente
 * la FONTE UNICA resta quella originale (nessun dato si sposta e nessuna scelta vecchia si perde):
 *  - app.privacy (AI Memory, Dati salute, Dati finanziari, Posizione, Profilo privato)
 *  - net.myCard (flag "mostra" del biglietto da visita)
 * Le voci "own" vivono solo in questo store. Il server non c'è ancora: le voci "predisposte" non hanno effetto reale.
 */
type State = {
  choices: Choices;
  set: (id: string, optionId: string) => { ok: boolean; error?: string };
  /** sostituisce tutte le scelte (usato da ripristino predefiniti, "tutto privato" e annulla) */
  applyAll: (c: Choices) => void;
  resetDefaults: () => void;
  reset: () => void;
};

const priv = () => useApp.getState().privacy ?? {};
const card = () => useNet.getState().myCard;

/** Valore corrente di una voce collegata a un'impostazione esistente (undefined = voce "own"). */
export function readLinked(it: CatalogItem, privacy: Record<string, boolean> = priv(), myCard: MyCard = card()): string | undefined {
  const [kind, key] = it.link.split(':');
  if (kind === 'privacy') return privacy[key] ? 'on' : 'off';
  if (kind === 'privacyInv') return privacy[key] ? 'off' : 'on';
  if (kind === 'card') {
    const c = myCard;
    const on = key === 'work' ? !!(c.showProfession || c.showResidence) : key === 'phone' ? !!c.showPhone : key === 'email' ? !!c.showEmail : !!c.showBirthYear;
    return on ? 'on' : 'off';
  }
  return undefined;
}

function writeLinked(it: CatalogItem, optionId: string) {
  const [kind, key] = it.link.split(':');
  const on = optionId === 'on';
  if (kind === 'privacy' || kind === 'privacyInv') {
    const v = kind === 'privacy' ? on : !on;
    if (!!priv()[key] !== v || !(key in priv())) useApp.getState().set({ privacy: { ...priv(), [key]: v } });
  } else if (kind === 'card') {
    const patch: Partial<MyCard> = key === 'work' ? { showProfession: on, showResidence: on } : key === 'phone' ? { showPhone: on } : key === 'email' ? { showEmail: on } : { showBirthYear: on };
    useNet.getState().patch({ myCard: { ...card(), ...patch } });
  }
}

export const useSharing = create<State>()(
  persisted<State>('sharing', (set, get) => ({
    choices: defaultChoices(),
    set: (id, optionId) => {
      const it = itemOf(id);
      if (!it) return { ok: false, error: 'Voce sconosciuta' };
      const r = setChoice(get().choices, id, optionId);
      if (!r.ok) return { ok: false, error: r.error };
      set({ choices: r.choices });
      writeLinked(it, optionId);
      return { ok: true };
    },
    applyAll: (c) => {
      const next = normalizeChoices(c);
      set({ choices: next });
      CATALOG.forEach((it) => { if (it.link !== 'own') writeLinked(it, next[it.id]); });
    },
    resetDefaults: () => get().applyAll(defaultChoices()),
    reset: () => set({ choices: defaultChoices() }),
  }), (s) => ({ choices: s.choices }) as State),
);

/** Scelte effettive: quelle salvate, con le voci collegate lette dalla loro fonte originale. */
export function computeChoices(own: Choices, privacy: Record<string, boolean>, myCard: MyCard): Choices {
  const base = normalizeChoices(own);
  for (const it of CATALOG) {
    if (it.link === 'own') continue;
    const v = readLinked(it, privacy ?? {}, myCard);
    if (v && (it.options.some((o) => o.id === v))) base[it.id] = v;
  }
  return normalizeChoices(base);
}
export const readChoices = (): Choices => computeChoices(useSharing.getState().choices, priv(), card());

/** Hook reattivo: si aggiorna anche quando cambiano le fonti collegate. */
export function useChoices(): Choices {
  const own = useSharing((s) => s.choices);
  const privacy = useApp((s) => s.privacy);
  const myCard = useNet((s) => s.myCard);
  return useMemo(() => computeChoices(own, privacy, myCard), [own, privacy, myCard]);
}

export const isSharedNow = (id: string, c: Choices = readChoices()) => !!optionOf(id, c)?.shared;
export const makeAllPrivate = (): Choices => { const before = readChoices(); useSharing.getState().applyAll(allPrivate(before)); return before; };

/** Modalità di agenda più dettagliata che l'utente ha consentito di inviare (null = agenda non condivisibile). */
export function agendaMax(c: Choices = readChoices()): AgendaMode | null { return agendaMaxMode(c.plan_agenda); }
export function useAgendaMax(): AgendaMode | null { const c = useChoices(); return agendaMaxMode(c.plan_agenda); }

export { isLocked };

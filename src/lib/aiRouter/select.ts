import { estimateProviderCost, KIND_LABEL, providersFor } from './registry.ts';
import { tx } from './tx.ts';
import { groupOf, type DocFormat, type Mode, type ProviderInfo, type TaskGroup, type TaskKind } from './types.ts';

/** Preferenze dell'utente sull'intelligenza di Theia (salvate nello store aiRouter). */
export type AiPrefs = {
  mode: Mode;
  /** per gruppo di compiti: 'auto' (o assente) | 'never' | id del fornitore scelto */
  taskPref: Partial<Record<TaskGroup, string>>;
  /** "non usare questo fornitore" */
  blockedProviders: string[];
  /** solo fornitori che possono elaborare in UE */
  euOnly: boolean;
  /** non inviare mai immagini a fornitori esterni */
  noImages: boolean;
  /** non inviare mai contatti */
  noContacts: boolean;
  /** modalità 'Solo sul telefono': il router non delega MAI nulla a servizi esterni */
  phoneOnly: boolean;
  /** ripulisce numeri carta, IBAN, email, telefoni, indirizzi prima dell'invio */
  redact: boolean;
};

export const DEFAULT_PREFS: AiPrefs = { phoneOnly: true, mode: 'bilanciata', taskPref: {}, blockedProviders: [], euOnly: false, noImages: false, noContacts: true, redact: true };

export const MODE_LABEL: Record<Mode, string> = { economica: 'Economica', bilanciata: 'Bilanciata', qualita: 'Migliore qualità' };
export const MODE_HINT: Record<Mode, string> = {
  economica: 'Scelgo il fornitore più economico che dà una qualità adeguata.',
  bilanciata: 'Cerco il miglior equilibrio tra qualità, costo e velocità.',
  qualita: 'Scelgo sempre il migliore per quel compito, anche se costa di più.',
};

const WEIGHTS: Record<Mode, { q: number; c: number; l: number }> = {
  economica: { q: 1, c: 1.2, l: 0.2 },
  bilanciata: { q: 1, c: 0.15, l: 0.1 },
  qualita: { q: 1, c: 0.05, l: 0.05 },
};

export type Candidate = { provider: ProviderInfo; score: number; quality: number; cost: number; latencyMs: number };

export type SelectInput = {
  kind: TaskKind;
  docFormat?: DocFormat;
  hasImages?: boolean;
  prefs: AiPrefs;
  /** fornitori temporaneamente non utilizzabili (errori, limiti del fornitore) */
  unavailable?: string[];
};

export type Selection =
  | { ok: true; ranking: Candidate[]; chosen: Candidate; explanation: string; fixed: boolean }
  | { ok: false; reason: 'never' | 'no_provider' | 'privacy' | 'fixed_unavailable'; message: string };

const eligible = (p: ProviderInfo, i: SelectInput): boolean => {
  const cap = p.caps[i.kind];
  if (!cap) return false;
  if (i.kind === 'document_create' && i.docFormat && !cap.formats?.includes(i.docFormat)) return false;
  if (i.hasImages && (i.kind === 'vision_read' || i.kind === 'image_edit') && !p.acceptsImages) return false;
  if (i.prefs.blockedProviders.includes(p.id)) return false;
  if (i.prefs.euOnly && !p.regions.includes('UE')) return false;
  if (i.unavailable?.includes(p.id)) return false;
  return true;
};

export function selectProvider(input: SelectInput): Selection {
  const { kind, prefs } = input;
  const group = groupOf(kind);
  const pref = prefs.taskPref[group] ?? 'auto';
  if (pref === 'never') return { ok: false, reason: 'never', message: tx('Hai scelto di non usare servizi esterni per {0}. Puoi cambiarlo in Intelligenza di Theia.', KIND_LABEL[kind]) };
  if (input.hasImages && prefs.noImages && (kind === 'vision_read' || kind === 'image_edit')) {
    return { ok: false, reason: 'privacy', message: tx('Hai scelto di non inviare immagini a servizi esterni, quindi non posso usare un fornitore per questa richiesta.') };
  }

  const all = providersFor(kind);
  const pool = all.filter((p) => eligible(p, input));
  if (!pool.length) {
    const why = prefs.euOnly ? tx(' Hai chiesto solo fornitori in UE, oppure i fornitori che restano sono bloccati.') : tx(' I fornitori adatti sono bloccati o non disponibili.');
    return { ok: false, reason: 'no_provider', message: tx('Non ho un fornitore adatto per {0}.', KIND_LABEL[kind]) + why };
  }

  const w = WEIGHTS[prefs.mode];
  const costs = pool.map((p) => estimateProviderCost(p.id, kind));
  const lats = pool.map((p) => p.caps[kind]!.latencyMs);
  const maxC = Math.max(...costs), maxL = Math.max(...lats);
  const cands: Candidate[] = pool.map((p, idx) => {
    const cap = p.caps[kind]!;
    const cn = maxC > 0 ? (costs[idx] / maxC) * 10 : 0;
    const ln = maxL > 0 ? (lats[idx] / maxL) * 10 : 0;
    const privacyPenalty = p.trainsOnData === 'da verificare' ? 0.3 : 0;
    return { provider: p, quality: cap.quality, cost: costs[idx], latencyMs: cap.latencyMs, score: w.q * cap.quality - w.c * cn - w.l * ln - privacyPenalty };
  });
  cands.sort((a, b) => b.score - a.score || b.quality - a.quality || a.cost - b.cost);

  if (pref !== 'auto') {
    const fixed = cands.find((c) => c.provider.id === pref);
    if (!fixed) return { ok: false, reason: 'fixed_unavailable', message: tx('Hai scelto un fornitore fisso per {0}, ma al momento non è utilizzabile (bloccato, non adatto o non disponibile).', KIND_LABEL[kind]) };
    return { ok: true, ranking: [fixed], chosen: fixed, fixed: true, explanation: tx('Uso {0} per {1} perché lo hai scelto tu.', fixed.provider.short, KIND_LABEL[kind]) };
  }

  const chosen = cands[0];
  const bestQ = Math.max(...cands.map((c) => c.quality));
  let explanation: string;
  if (cands.length === 1) explanation = tx('Ho scelto {0} per {1}: è l\'unico adatto che hai a disposizione.', chosen.provider.short, KIND_LABEL[kind]);
  else if (prefs.mode === 'economica' && chosen.quality < bestQ) explanation = tx('Ho scelto {0} per {1} perché è il più economico con una qualità adeguata (modalità Economica).', chosen.provider.short, KIND_LABEL[kind]);
  else if (chosen.quality >= bestQ) explanation = tx('Ho scelto {0} perché è il migliore per {1} nel tuo piano.', chosen.provider.short, KIND_LABEL[kind]);
  else explanation = tx('Ho scelto {0} per {1} perché dà il miglior equilibrio tra qualità, costo e velocità.', chosen.provider.short, KIND_LABEL[kind]);
  if (prefs.euOnly) explanation += tx(' Solo fornitori che possono elaborare in UE.');
  return { ok: true, ranking: cands, chosen, fixed: false, explanation };
}

export type Usable = { candidate: Candidate; fallback: boolean; skipped: string[] };

/** Primo fornitore del ranking che e' davvero collegato: se non e' il primo, e' un ripiego. */
export function pickUsable(sel: Extract<Selection, { ok: true }>, isConnected: (providerId: string) => boolean): Usable | null {
  const skipped: string[] = [];
  for (let i = 0; i < sel.ranking.length; i++) {
    const c = sel.ranking[i];
    if (isConnected(c.provider.id)) return { candidate: c, fallback: i > 0, skipped };
    skipped.push(c.provider.id);
  }
  return null;
}

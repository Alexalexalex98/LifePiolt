/**
 * PRIVACY GATE UNICO. Ogni canale in uscita (assistente AI, chat, biglietto, rete pubblica, club, azienda, sincronizzazione,
 * esportazione) chiede qui se un dato puo' uscire e in che forma. Le regole NON sono duplicate: il gate legge il catalogo
 * (dataCatalog.ts) e le scelte "Cosa condivido" (sharing.ts).
 * Modulo PURO (nessun alias '@/'): le scelte e il registro di uscita si collegano con bindGate() (vedi privacyGateApp.ts).
 *
 * Regole:
 *  - dati CRITICI (carte, IBAN, CSV, clinici, fiscali, documenti, conti e movimenti): negati sempre, per ogni destinatario;
 *  - 'router_ai': solo voci scelte con destinatario "assistente AI";  'network_public': solo voci condivise con "tutti";
 *  - 'chat:<id>' / 'club' / 'employer': voci condivise con "persone scelte"/"tutti"; oppure un'azione ESPLICITA dell'utente
 *    (ctx.explicit: "invio io questo task/nota/candidatura") per i dati non critici e senza livelli;
 *  - agenda: sempre secondo il livello scelto (liberi < occupato < dettagli), anche con azione esplicita;
 *  - 'sync': solo dati di account (e voci cifrate end-to-end se condivise);  'export': azione dell'utente sui propri dati non critici;
 *  - 'contacts' (rubrica): mai all'AI, mai senza azione esplicita; escono solo i contatti scelti (ctx.chosen).
 *  - la mancata configurazione (nessuna scelta collegata) NEGA tutto: il gate fallisce in modo sicuro.
 */
import { redact } from './aiRouter/privacy.ts';
import { agendaAllows, agendaMaxMode, allPrivate, defaultChoices, itemOf, optionOf, type AgendaMode, type Choices } from './dataCatalog.ts';
import { audienceKind, type Outcome } from './privacyLog.ts';

export type Audience = 'router_ai' | `chat:${string}` | 'network_public' | 'club' | 'employer' | 'sync' | 'export';
export type GateLevel = 'none' | 'liberi' | 'occupato' | 'dettagli' | 'full';
export type GateResult = { allowed: boolean; reason: string; level: GateLevel };
export type GateCtx = {
  /** livello richiesto per l'agenda */
  mode?: AgendaMode;
  /** l'utente sta inviando proprio questo dato con un gesto esplicito (non un invio automatico) */
  explicit?: boolean;
  /** rubrica: id/nomi dei contatti scelti */
  chosen?: string[];
  /** per i test: scelte da usare al posto di quelle collegate */
  choices?: Choices;
  /** false = non registrare nel registro di uscita (controlli di sola lettura) */
  log?: boolean;
};

/** Dati che non stanno nel catalogo ma attraversano il gate. */
export const EXTRA_IDS = ['contacts'] as const;

type Recorder = (e: { audience: string; dataId: string; outcome: Outcome; count: number }) => void;
let getChoices: () => Choices = () => allPrivate(defaultChoices());
let record: Recorder = () => undefined;

/** Collega le scelte correnti e il registro di uscita. Chiamata da privacyGateApp.ts. */
export function bindGate(env: { choices: () => Choices; record?: Recorder }) {
  getChoices = env.choices;
  if (env.record) record = env.record;
}

const DENY = (reason: string): GateResult => ({ allowed: false, reason, level: 'none' });
const OK = (reason: string, level: GateLevel = 'full'): GateResult => ({ allowed: true, reason, level });

/** Versione pura: decide con le scelte passate. */
export function evaluate(choices: Choices, dataId: string, audience: string, ctx: GateCtx = {}): GateResult {
  const kind = audienceKind(audience);
  if (!kind) return DENY('Destinatario sconosciuto.');

  if (dataId === 'contacts') {
    if (kind === 'router_ai' || kind === 'sync' || kind === 'network_public') return DENY('La rubrica non esce mai verso questo destinatario.');
    if (!ctx.explicit) return DENY('I contatti si condividono solo scegliendoli uno a uno.');
    return OK('Solo i contatti che hai scelto.');
  }

  const item = itemOf(dataId);
  if (!item) return DENY('Dato sconosciuto.');
  if (item.sensitivity === 'critico') return DENY('Dato critico: resta sempre sul tuo telefono.');

  if (kind === 'export') return OK('Esportazione richiesta da te.', dataId === 'plan_agenda' ? 'dettagli' : 'full');

  const opt = optionOf(dataId, choices);
  if (!opt) return DENY('Scelta non trovata.');

  if (kind === 'sync') {
    if (item.where === 'account su server') return OK('Dato di account.');
    if (item.e2e && opt.shared) return OK('Dato cifrato end-to-end che hai scelto di condividere.');
    return DENY('Con il server si sincronizzano solo i dati di account.');
  }

  if (dataId === 'plan_agenda') {
    if (kind === 'router_ai' || kind === 'network_public') return DENY('L\'agenda non è condivisa con questo destinatario.');
    const max = agendaMaxMode(opt.id);
    if (!max) return DENY('Nelle impostazioni "Cosa condivido" l\'agenda è privata.');
    if (ctx.mode && !agendaAllows(opt.id, ctx.mode)) return DENY('Questa modalità è più dettagliata di quanto hai consentito.');
    const level: GateLevel = ctx.mode ?? max;
    return OK('Secondo il livello scelto.', level);
  }

  const aud = opt.audience;
  if (kind === 'router_ai') return opt.shared && aud === 'assistente AI' ? OK('Scelto per l\'assistente AI.') : DENY('Non l\'hai scelto per l\'assistente AI.');
  if (kind === 'network_public') return opt.shared && aud === 'tutti' ? OK('Pubblico per scelta.') : DENY('Non è pubblico.');
  // chat, club, employer
  if (opt.shared && (aud === 'persone scelte' || aud === 'tutti')) return OK('Condiviso con persone scelte.');
  if (ctx.explicit) return OK('Invio esplicito da parte tua.');
  return DENY('Non è condiviso: lo invii solo tu, quando lo scegli.');
}

/** Il dato puo' uscire verso questo destinatario? Nessun effetto collaterale (non registra nulla). */
export function canShare(dataId: string, audience: Audience | string, ctx: GateCtx = {}): GateResult {
  return evaluate(ctx.choices ?? getChoices(), dataId, audience, ctx);
}

export type Guarded<T> = GateResult & { payload: T | undefined; removed: string[]; count: number };

const AGENDA_ORDER: Record<AgendaMode, number> = { liberi: 1, occupato: 2, dettagli: 3 };

function maskStrings(v: unknown): unknown {
  if (typeof v === 'string') return redact(v).text;
  if (Array.isArray(v)) return v.map(maskStrings);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, maskStrings(x)]));
  return v;
}

function countOf(dataId: string, payload: unknown): number {
  if (payload == null) return 0;
  if (dataId === 'plan_agenda' && typeof payload === 'object') {
    const p = payload as { items?: unknown[]; busy?: unknown[]; free?: unknown[] };
    return (p.items?.length ?? 0) + (p.busy?.length ?? 0) + (p.free?.length ?? 0);
  }
  return Array.isArray(payload) ? payload.length : 1;
}

/**
 * Restituisce il payload ripulito e registra l'uscita (solo metadati). Agenda: items/busy secondo il livello;
 * contatti: solo quelli scelti; verso AI, sincronizzazione e rete pubblica i testi passano dalla redazione di email, IBAN, carte, telefoni.
 */
export function guardedPayload<T>(dataId: string, audience: Audience | string, payload: T, ctx: GateCtx = {}): Guarded<T> {
  const g = evaluate(ctx.choices ?? getChoices(), dataId, audience, ctx);
  let out: unknown = payload;
  const removed: string[] = [];
  if (!g.allowed) {
    out = undefined;
    removed.push('*');
  } else if (dataId === 'plan_agenda' && payload && typeof payload === 'object') {
    const p = { ...(payload as Record<string, unknown>) } as { items?: unknown[]; busy?: unknown[]; free?: unknown[]; mode?: AgendaMode };
    const lvl = (g.level === 'liberi' || g.level === 'occupato' || g.level === 'dettagli' ? g.level : 'dettagli') as AgendaMode;
    const cur = p.mode ?? 'dettagli';
    const eff: AgendaMode = AGENDA_ORDER[cur] > AGENDA_ORDER[lvl] ? lvl : cur;
    if (eff !== 'dettagli' && p.items?.length) { p.items = []; removed.push('items'); }
    if (eff === 'liberi' && p.busy?.length) { delete p.busy; removed.push('busy'); }
    p.mode = eff;
    out = p;
  } else if (dataId === 'contacts' && Array.isArray(payload)) {
    const chosen = new Set((ctx.chosen ?? []).map(String));
    const kept = (payload as Record<string, unknown>[]).filter((c) => chosen.has(String(c.id ?? c.name)));
    if (kept.length !== payload.length) removed.push(`${payload.length - kept.length} contatti`);
    out = kept;
  }
  const kind = audienceKind(String(audience));
  if (g.allowed && (kind === 'router_ai' || kind === 'sync' || kind === 'network_public')) {
    const masked = maskStrings(out);
    if (JSON.stringify(masked) !== JSON.stringify(out)) removed.push('testi sensibili');
    out = masked;
  }
  const count = g.allowed ? countOf(dataId, out) : 0;
  if (ctx.log !== false) {
    try { record({ audience: String(audience), dataId, outcome: !g.allowed ? 'denied' : removed.length ? 'partial' : 'ok', count }); } catch { /* il registro non blocca l'uscita */ }
  }
  return { ...g, payload: out as T | undefined, removed, count };
}

/** Registra un'uscita gia' avvenuta o negata senza payload da ripulire (es. chiamata all'assistente, nome iscritto a un club). */
export function logOutflow(dataId: string, audience: Audience | string, ctx: GateCtx & { count?: number } = {}): GateResult {
  const g = evaluate(ctx.choices ?? getChoices(), dataId, audience, ctx);
  try { record({ audience: String(audience), dataId, outcome: g.allowed ? 'ok' : 'denied', count: g.allowed ? ctx.count ?? 1 : 0 }); } catch { /* ignore */ }
  return g;
}

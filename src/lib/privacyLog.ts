/**
 * Registro di uscita locale: "Cosa e' uscito dal tuo telefono". Registra SOLO metadati
 * (quando, verso quale destinatario, quale tipo di dato, esito, quantita'): MAI il contenuto.
 * Modulo PURO (testabile con node). Lo store persistente e' in src/store/privacyLog.ts.
 */
export const LOG_MAX = 2000;

export type Outcome = 'ok' | 'partial' | 'denied';
export type AudienceKind = 'router_ai' | 'chat' | 'network_public' | 'club' | 'employer' | 'sync' | 'export';
export type PrivacyEntry = { id: string; ts: number; audience: AudienceKind; dataId: string; outcome: Outcome; count: number };

export const AUDIENCE_LABEL: Record<AudienceKind, string> = {
  router_ai: 'Assistente AI', chat: 'Chat', network_public: 'Rete pubblica', club: 'LifeClub', employer: 'Azienda', sync: 'Sincronizzazione', export: 'Esportazione',
};
export const OUTCOME_LABEL: Record<Outcome, string> = { ok: 'Inviato', partial: 'Inviato in parte', denied: 'Negato' };

/** 'chat:123' -> 'chat' (l'identificativo del destinatario non viene salvato). null se il destinatario non e' valido. */
export function audienceKind(a: string): AudienceKind | null {
  const k = String(a).split(':')[0];
  return (['router_ai', 'chat', 'network_public', 'club', 'employer', 'sync', 'export'] as string[]).includes(k) ? (k as AudienceKind) : null;
}

let n = 0;
export function makeEntry(p: { audience: string; dataId: string; outcome: Outcome; count?: number; ts?: number }): PrivacyEntry | null {
  const audience = audienceKind(p.audience);
  if (!audience) return null;
  const ts = p.ts ?? Date.now();
  return { id: `${ts.toString(36)}${(n++ % 1296).toString(36)}`, ts, audience, dataId: String(p.dataId).slice(0, 40), outcome: p.outcome, count: Math.max(0, Math.round(p.count ?? 1)) };
}

/** Aggiunge in testa (le piu' recenti prima) e tiene al massimo LOG_MAX righe. */
export function pushCapped(list: PrivacyEntry[], e: PrivacyEntry, max = LOG_MAX): PrivacyEntry[] {
  const next = [e, ...list];
  return next.length > max ? next.slice(0, max) : next;
}

export type PrivacyFilter = { audience?: AudienceKind; outcome?: Outcome; dataId?: string; since?: number };
export const matches = (e: PrivacyEntry, f: PrivacyFilter) =>
  (!f.audience || e.audience === f.audience) && (!f.outcome || e.outcome === f.outcome) && (!f.dataId || e.dataId === f.dataId) && (!f.since || e.ts >= f.since);
export const filterEntries = (list: PrivacyEntry[], f: PrivacyFilter) => list.filter((e) => matches(e, f));
/** Toglie le righe che corrispondono al filtro (filtro vuoto = tutte). */
export const removeMatching = (list: PrivacyEntry[], f: PrivacyFilter) => list.filter((e) => !matches(e, f));

export function summarize(list: PrivacyEntry[]): { total: number; sent: number; denied: number; items: number } {
  let sent = 0, denied = 0, items = 0;
  for (const e of list) { if (e.outcome === 'denied') denied++; else { sent++; items += e.count; } }
  return { total: list.length, sent, denied, items };
}

/** Sanifica righe lette dal disco (formati vecchi, righe corrotte, eccesso). */
export function normalizeEntries(raw: unknown, max = LOG_MAX): PrivacyEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: PrivacyEntry[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const a = typeof o.audience === 'string' ? audienceKind(o.audience) : null;
    if (!a || typeof o.ts !== 'number' || typeof o.dataId !== 'string' || !['ok', 'partial', 'denied'].includes(o.outcome as string)) continue;
    out.push({ id: String(o.id ?? o.ts), ts: o.ts, audience: a, dataId: o.dataId.slice(0, 40), outcome: o.outcome as Outcome, count: typeof o.count === 'number' ? o.count : 1 });
    if (out.length >= max) break;
  }
  return out;
}

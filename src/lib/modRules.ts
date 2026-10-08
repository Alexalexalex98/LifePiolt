/**
 * Moderazione: regole PURE (nessun alias, nessuno store) per segnalazioni, contenuti nascosti e utenti bloccati.
 * Un contenuto e' identificato da una chiave `tipo:riferimento` (es. "post:standalone:3", "comment:community:2:1#0").
 */
export type ModKind = 'post' | 'comment' | 'seminar' | 'service' | 'community' | 'profile' | 'idea';
export type ReasonId = 'spam' | 'offensivo' | 'truffa' | 'falso' | 'altro';

export const REASONS: { id: ReasonId; label: string; hint: string }[] = [
  { id: 'spam', label: 'Spam', hint: 'Pubblicità ripetuta o contenuti non richiesti' },
  { id: 'offensivo', label: 'Contenuto offensivo', hint: 'Insulti, odio, molestie' },
  { id: 'truffa', label: 'Truffa', hint: 'Tentativo di ingannare o di farsi pagare senza dare nulla' },
  { id: 'falso', label: 'Informazioni false', hint: 'Notizie, dati o promesse non veri' },
  { id: 'altro', label: 'Altro', hint: 'Spiegalo nella nota' },
];
export const reasonLabel = (id: string) => REASONS.find((r) => r.id === id)?.label ?? id;
export const kindLabel: Record<ModKind, string> = { post: 'Post', comment: 'Commento', seminar: 'Seminario', service: 'Servizio', community: 'Community', profile: 'Profilo', idea: 'Idea' };

export const modKey = (kind: ModKind, ref: string | number) => `${kind}:${ref}`;

export type ModReport = { id: string; key: string; kind: ModKind; ref: string; label: string; author?: string; reason: ReasonId; note: string; ts: number };
export type HiddenMap = Record<string, { label: string; kind: ModKind; ts: number }>;

/** Il contenuto e' segnalato o nascosto dall'utente? */
export function isContentHidden(key: string, reports: ModReport[], hidden: HiddenMap): boolean {
  return !!hidden[key] || reports.some((r) => r.key === key);
}

/** Visibile = non segnalato, non nascosto e non di un utente bloccato. */
export function isVisible(key: string, author: string | undefined, reports: ModReport[], hidden: HiddenMap, blocked: string[]): boolean {
  if (author && blocked.includes(author)) return false;
  return !isContentHidden(key, reports, hidden);
}

export function makeReport(p: { kind: ModKind; ref: string | number; label: string; author?: string; reason: ReasonId; note?: string }, id: string, ts: number): ModReport {
  return { id, key: modKey(p.kind, p.ref), kind: p.kind, ref: String(p.ref), label: p.label.length > 80 ? p.label.slice(0, 78) + '…' : p.label, author: p.author, reason: p.reason, note: (p.note ?? '').trim().slice(0, 500), ts };
}

/** Una segnalazione per contenuto: ripetere la stessa sostituisce la precedente. */
export function addReport(reports: ModReport[], r: ModReport): ModReport[] {
  return [r, ...reports.filter((x) => x.key !== r.key)];
}
export const removeReport = (reports: ModReport[], id: string): ModReport[] => reports.filter((r) => r.id !== id);

/** Filtra un elenco togliendo i contenuti non visibili. */
export function filterVisible<T>(items: T[], keyOf: (x: T) => string, authorOf: (x: T) => string | undefined, reports: ModReport[], hidden: HiddenMap, blocked: string[]): T[] {
  return items.filter((x) => isVisible(keyOf(x), authorOf(x), reports, hidden, blocked));
}

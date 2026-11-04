/** Riunioni di lavoro (modulo PURO, nessun alias '@/'): scadenze dette a voce, verbale, azioni da creare, ricorrenze. */
import type { CallNotes } from './callNotes.ts';

export type Meeting = {
  id: string; team_id: string; project: string | null; title: string; day: string; time: string; dur: number; agenda: string;
  attendees: string[]; created_by: string; status: 'scheduled' | 'live' | 'ended'; rec_by: string | null; rec_users: string[];
  recurrence: 'none' | 'weekly' | 'monthly'; notes: CallNotes | null; minutes: string | null; event_id: string | null; deleted?: boolean;
};
export type Line = { id?: number; meeting_id?: string; speaker: string; at: number; text: string };

const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const WD: Record<string, number> = { domenica: 0, lunedi: 1, martedi: 2, mercoledi: 3, giovedi: 4, venerdi: 5, sabato: 6 };
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** «entro venerdì», «domani», «il 15», «20/11»… -> data (YYYY-MM-DD) rispetto a `base`; null se non si capisce. */
export function resolveDue(text: string | undefined, base: Date): string | null {
  if (!text) return null;
  const n = norm(text);
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12);
  if (/\boggi\b/.test(n)) return iso(d);
  if (/\bdopodomani\b/.test(n)) { d.setDate(d.getDate() + 2); return iso(d); }
  if (/\bdomani\b/.test(n)) { d.setDate(d.getDate() + 1); return iso(d); }
  if (/fine mese/.test(n)) return iso(new Date(base.getFullYear(), base.getMonth() + 1, 0, 12));
  if (/fine settimana/.test(n)) { const add = (5 - d.getDay() + 7) % 7; d.setDate(d.getDate() + add); return iso(d); }
  const wd = Object.keys(WD).find((k) => new RegExp(`\\b${k}\\b`).test(n));
  if (wd) { let add = (WD[wd]! - d.getDay() + 7) % 7; if (add === 0) add = 7; d.setDate(d.getDate() + add); return iso(d); }
  const sl = /\b(\d{1,2})[/.](\d{1,2})\b/.exec(n);
  if (sl) { const day = +sl[1]!, mo = +sl[2]! - 1; if (mo > 11 || day > 31) return null; const x = new Date(base.getFullYear(), mo, day, 12); if (x < d) x.setFullYear(x.getFullYear() + 1); return iso(x); }
  const il = /\bil (\d{1,2})(?: ([a-z]+))?/.exec(n);
  if (il) { const day = +il[1]!; const mo = il[2] ? MONTHS.indexOf(il[2]) : base.getMonth(); if (mo < 0 || day < 1 || day > 31) return null; const x = new Date(base.getFullYear(), mo, day, 12); if (x < d) { if (il[2]) x.setFullYear(x.getFullYear() + 1); else x.setMonth(x.getMonth() + 1); } return iso(x); }
  return null;
}

/** Prossima data di una riunione ricorrente. */
export function nextOccurrence(day: string, rec: Meeting['recurrence']): string | null {
  if (rec === 'none') return null;
  const d = new Date(day + 'T12:00:00');
  if (rec === 'weekly') d.setDate(d.getDate() + 7);
  else { const dom = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + 1); d.setDate(Math.min(dom, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); }
  return iso(d);
}

const mmss = (ms: number) => `${pad(Math.floor(ms / 60000))}:${pad(Math.floor((ms % 60000) / 1000))}`;
/** Verbale completo, pronto per una pagina del workspace o per essere inviato. */
export function buildMinutes(o: { title: string; day: string; time: string; names: string[]; agenda: string; notes: CallNotes | null; lines: Line[]; nameOf: (id: string) => string }): string {
  const sec = (head: string, rows: string[]) => (rows.length ? [head, ...rows.map((r) => `- ${r}`), ''] : []);
  const n = o.notes;
  return [
    `Verbale: ${o.title}`, `${o.day} · ${o.time}`, `Presenti: ${o.names.join(', ') || '-'}`, '',
    ...(o.agenda.trim() ? ['Ordine del giorno', o.agenda.trim(), ''] : []),
    ...sec('Decisioni', (n?.decisions ?? []).map((d) => `${d.text} (${d.speaker})`)),
    ...sec('Da fare', (n?.actions ?? []).map((a) => `${a.text} · ${a.owner}${a.due ? ` · ${a.due}` : ''}`)),
    ...sec('Domande aperte', (n?.questions ?? []).map((q) => `${q.text} (${q.speaker})`)),
    ...sec('Date e numeri', (n?.facts ?? []).map((f) => f.text)),
  ].join('\n').trim();
}
export const transcriptOf = (lines: Line[], nameOf: (id: string) => string): string => [...lines].sort((a, b) => a.at - b.at).map((l) => `[${mmss(l.at)}] ${nameOf(l.speaker)}: ${l.text}`).join('\n');

export type Action = { text: string; owner: string; due: string | null; mine: boolean };
/** Le cose da fare della riunione con la scadenza risolta; `mine` = il responsabile sono io (o «Tutti»). */
export function actionsOf(notes: CallNotes | null, me: string, base: Date): Action[] {
  return (notes?.actions ?? []).map((a) => ({ text: a.text, owner: a.owner, due: resolveDue(a.due, base), mine: a.owner === me || a.owner === 'Tutti' }));
}

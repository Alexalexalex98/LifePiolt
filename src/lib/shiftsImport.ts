/** Turni di lavoro da un PDF o una foto (modulo PURO e testabile): prompt per l'AI e lettura della risposta in turni dell'app. */
import { isTime, type Shift } from './shifts.ts';

export type NewShift = Omit<Shift, 'id'>;
export const SHIFT_TALK = /\b(turni|turno|piano turni|orario dei turni|turnazione)\b/i;

export const shiftsPrompt = (who: string, text?: string): string => `Questo e' un piano dei turni di lavoro. L'utente si chiama ${who || '(nome non noto)'}: estrai SOLO i turni di quella persona (se nel file c'e' una tabella con piu' persone usa la riga o la colonna con il suo nome; se c'e' una sola persona o non trovi il nome, prendi tutti i turni). Per ogni giorno lavorato scrivi la data completa (anno-mese-giorno, deduci l'anno dal documento), l'ora di inizio e di fine in formato 24 ore e il nome del turno (Mattina, Pomeriggio, Notte... come scritto nel file). Ignora riposi, ferie e giorni liberi. Rispondi SOLO con JSON valido, niente altro testo: {"turni":[{"d":"2026-11-02","i":"06:00","f":"14:00","n":"Mattina"}]}.${text ? `\n\nTESTO DEL FILE:\n${text.slice(0, 14000)}` : ''}`;

const iso = (s: unknown): string | null => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : null);
const hm = (s: unknown): string | null => { const m = /^(\d{1,2})[:.](\d{2})$/.exec(String(s ?? '').trim()); if (!m) return null; const v = `${m[1].padStart(2, '0')}:${m[2]}`; return isTime(v) ? v : null; };

/** Legge la risposta: i turni con lo stesso nome e orario si raggruppano in un turno con tutte le sue date. */
export function parseShiftsReply(reply: string): NewShift[] {
  const m = /\{[\s\S]*\}/.exec(reply ?? ''); if (!m) return [];
  let list: unknown[] = [];
  try { const o = JSON.parse(m[0]) as { turni?: unknown; shifts?: unknown }; list = (Array.isArray(o.turni) ? o.turni : Array.isArray(o.shifts) ? o.shifts : []) as unknown[]; } catch { return []; }
  const groups = new Map<string, NewShift>();
  for (const x of list.slice(0, 400)) {
    const r = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const d = iso(r.d ?? r.data), a = hm(r.i ?? r.inizio), b = hm(r.f ?? r.fine);
    if (!d || !a || !b) continue;
    const name = String(r.n ?? r.nome ?? '').replace(/\s+/g, ' ').trim().slice(0, 40) || `${a}-${b}`;
    const key = `${name.toLowerCase()}|${a}|${b}`;
    const g = groups.get(key) ?? { name, start: a, end: b, weekdays: [], dates: [] };
    if (!g.dates.includes(d)) g.dates.push(d);
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({ ...g, dates: g.dates.sort() }));
}

export function shiftsSummary(list: NewShift[]): string {
  return list.map((s) => `• ${s.name} · ${s.start}-${s.end} · ${s.dates.length} ${s.dates.length === 1 ? 'giorno' : 'giorni'}${s.dates.length ? ` (${s.dates[0].slice(8)}/${s.dates[0].slice(5, 7)} – ${s.dates[s.dates.length - 1].slice(8)}/${s.dates[s.dates.length - 1].slice(5, 7)})` : ''}`).join('\n');
}

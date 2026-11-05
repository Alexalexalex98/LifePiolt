/** Richieste di lavoro scritte a Theia Lavoro (modulo PURO, nessun alias '@/'): ferie, permessi, malattia e task. Capisce date come «dal 10 al 17 agosto» o «dal 10/08 al 17/08». */
import { resolveDue } from './meetings.ts';

export type AbsenceKind = 'ferie' | 'permesso' | 'malattia' | 'altro';
export type AbsenceIntent = { type: 'absence'; kind: AbsenceKind; from: string; to: string };
export type TaskIntent = { type: 'task'; title: string; due: string | null };
export type Intent = AbsenceIntent | TaskIntent;
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const pad = (n: number) => String(n).padStart(2, '0');
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const valid = (y: number, m: number, d: number) => { const x = new Date(y, m - 1, d, 12); return x.getFullYear() === y && x.getMonth() === m - 1 && x.getDate() === d; };
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
/** Quando l'anno non c'è: la prossima volta che quel giorno capita, a partire da oggi. */
function nextYear(m: number, d: number, today: string): number { const y = Number(today.slice(0, 4)); return iso(y, m, d) >= today ? y : y + 1; }

/** Un periodo scritto in italiano: «dal 10 al 17 agosto», «dal 10 agosto al 17 settembre», «dal 10/08 al 17/08/2026», «il 5 novembre», «domani», «da lunedì a venerdì». */
export function parseRange(text: string, today: string): { from: string; to: string } | null {
  const n = norm(text); const mn = `(${MONTHS.join('|')})`;
  let m = new RegExp(`dal\\s+(\\d{1,2})\\s+${mn}?\\s*(?:al|a|fino al)\\s+(\\d{1,2})\\s+${mn}(?:\\s+(\\d{4}))?`).exec(n);
  if (m) {
    const mo2 = MONTHS.indexOf(m[4]!) + 1, mo1 = m[2] ? MONTHS.indexOf(m[2]) + 1 : mo2; const y0 = m[5] ? +m[5] : nextYear(mo1, +m[1]!, today);
    const y1 = mo2 < mo1 && !m[5] ? y0 + 1 : m[5] ? +m[5] : nextYear(mo2, +m[3]!, today) > y0 ? y0 : nextYear(mo2, +m[3]!, today);
    if (valid(y0, mo1, +m[1]!) && valid(y1, mo2, +m[3]!)) return { from: iso(y0, mo1, +m[1]!), to: iso(y1, mo2, +m[3]!) };
  }
  m = /dal\s+(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?\s*(?:al|a|fino al)\s+(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?/.exec(n);
  if (m) {
    const y = m[6] ? (+m[6] < 100 ? 2000 + +m[6] : +m[6]) : m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : nextYear(+m[2]!, +m[1]!, today);
    const y0 = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : y; const y1 = m[6] ? y : (+m[5]! < +m[2]! ? y0 + 1 : y0);
    if (valid(y0, +m[2]!, +m[1]!) && valid(y1, +m[5]!, +m[4]!)) return { from: iso(y0, +m[2]!, +m[1]!), to: iso(y1, +m[5]!, +m[4]!) };
  }
  m = new RegExp(`(?:il\\s+|per il\\s+|del\\s+)?(\\d{1,2})\\s+${mn}(?:\\s+(\\d{4}))?`).exec(n);
  if (m) { const mo = MONTHS.indexOf(m[2]!) + 1; const y = m[3] ? +m[3] : nextYear(mo, +m[1]!, today); if (valid(y, mo, +m[1]!)) return { from: iso(y, mo, +m[1]!), to: iso(y, mo, +m[1]!) }; }
  const one = resolveDue(n.replace(/\b(da|dal)\b.*$/, ''), new Date(today + 'T12:00:00'));
  if (/\b(oggi|domani|dopodomani)\b/.test(n) && one) return { from: one, to: one };
  const wd = /da\s+(lunedi|martedi|mercoledi|giovedi|venerdi)\s+a\s+(martedi|mercoledi|giovedi|venerdi|sabato|domenica)/.exec(n);
  if (wd) { const a = resolveDue(wd[1]!, new Date(today + 'T12:00:00')); const b = a ? resolveDue(wd[2]!, new Date(a + 'T12:00:00')) : null; if (a && b) return { from: a, to: b }; }
  return null;
}
const kindOf = (n: string): AbsenceKind => (/malattia|malato|malata|infortun/.test(n) ? 'malattia' : /permess/.test(n) ? 'permesso' : /ferie|vacanz|riposo/.test(n) ? 'ferie' : 'altro');

/** Capisce che cosa si chiede: ferie, permessi e malattia con le date, oppure un task da creare. null = una domanda normale. */
export function parseIntent(text: string, today: string): Intent | null {
  const n = norm(text.trim());
  if (/\b(ferie|vacanz[ae]|permesso|malattia|sono malato|sono malata|assenza|mi assento)\b/.test(n) && /\b(segna|segnami|metti|mettimi|richiedi|chiedi|prenota|prendo|prendero|voglio|vorrei|devo|sono|sara|inserisci|registra|aggiungi|fammi)\b/.test(n)) {
    const r = parseRange(n, today); if (r) return { type: 'absence', kind: kindOf(n), from: r.from, to: r.to };
  }
  const t = /^(?:per favore |per piacere |puoi |potresti )?(?:crea|aggiungi|segna|metti)(?:mi)?\s+(?:un\s+|il\s+)?(?:task|compito|attivita)\s*[:\-]?\s+(.{3,})$/i.exec(text.trim()) ?? /^(?:per favore |per piacere )?ricordami\s+di\s+(.{3,})$/i.exec(text.trim());
  if (t) { const body = t[1]!.trim(); const due = /\b(entro|per)\s+(oggi|domani|dopodomani|fine settimana|fine mese|lunedi|martedi|mercoledi|giovedi|venerdi|il \d{1,2}(?: [a-z]+)?|\d{1,2}[/.]\d{1,2})\b/i.exec(norm(body)); const d = due ? resolveDue(due[0], new Date(today + 'T12:00:00')) : null; const title = (due ? body.slice(0, norm(body).indexOf(due[0])) : body).replace(/[\s,.:;-]+$/, '').trim(); if (title.length >= 3) return { type: 'task', title: title.charAt(0).toUpperCase() + title.slice(1), due: d }; }
  return null;
}

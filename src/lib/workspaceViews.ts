/** Filtri, ordinamento, viste (calendario, galleria), template e task estratti: funzioni pure di LifeWorkspace. */
import type { Block, Col, Row } from './workspaceCore.ts';

export type Filter = { col: string; op: 'has' | 'is' | 'not' | 'gt' | 'lt'; v: string };
export type Sort = { col: string; dir: 1 | -1 };
export type DbView = 'table' | 'kanban' | 'calendar' | 'gallery';

/** «GG/MM/AAAA» (o «GG/MM») in millisecondi; null se non è una data. */
export function parseDate(s: string, now = new Date()): number | null {
  const m = /^\s*(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\s*$/.exec(s);
  if (!m) return null;
  const d = +m[1]!, mo = +m[2]!; let y = m[3] ? +m[3] : now.getFullYear(); if (y < 100) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(y, mo - 1, d).getTime();
}

const cmpVal = (col: Col | undefined, a: string, b: string): number => {
  if (col?.kind === 'number') return (parseFloat(a.replace(',', '.')) || 0) - (parseFloat(b.replace(',', '.')) || 0);
  if (col?.kind === 'date') return (parseDate(a) ?? Infinity) - (parseDate(b) ?? Infinity);
  return a.localeCompare(b, 'it', { sensitivity: 'base' });
};

/** Applica filtro e ordinamento alle righe, senza modificarle. */
export function applyView(cols: Col[], rows: Row[], flt?: Filter | null, srt?: Sort | null): Row[] {
  let out = rows;
  if (flt && flt.v.trim()) {
    const col = cols.find((c) => c.id === flt.col); const q = flt.v.trim().toLowerCase();
    out = out.filter((r) => {
      const v = (r.cells[flt.col] ?? '').trim(); const lv = v.toLowerCase();
      if (flt.op === 'has') return lv.includes(q);
      if (flt.op === 'is') return lv === q;
      if (flt.op === 'not') return lv !== q;
      const c = cmpVal(col, v, flt.v.trim());
      return flt.op === 'gt' ? c > 0 : c < 0;
    });
  }
  if (srt) { const col = cols.find((c) => c.id === srt.col); out = out.slice().sort((a, b) => srt.dir * cmpVal(col, a.cells[srt.col] ?? '', b.cells[srt.col] ?? '')); }
  return out;
}

/** Righe raggruppate per giorno (calendario): ordinate per data; quelle senza data a parte. */
export function byDay(cols: Col[], rows: Row[]): { days: { key: number; rows: Row[] }[]; undated: Row[] } {
  const dc = cols.find((c) => c.kind === 'date'); const map = new Map<number, Row[]>(); const undated: Row[] = [];
  rows.forEach((r) => { const t = dc ? parseDate(r.cells[dc.id] ?? '') : null; if (t == null) undated.push(r); else map.set(t, [...(map.get(t) ?? []), r]); });
  return { days: [...map.entries()].sort((a, b) => a[0] - b[0]).map(([key, rs]) => ({ key, rows: rs })), undated };
}

/** Riga di database da una riga di testo dell'AI: «- Titolo | 12/03 | Da fare». */
export function parseTaskLines(text: string): { title: string; date?: string }[] {
  const out: { title: string; date?: string }[] = [];
  for (const raw of text.split('\n')) {
    const l = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim();
    if (!l || l.length < 3 || /^(ecco|task|compiti|attivit)/i.test(l) && l.endsWith(':')) continue;
    const [title, ...rest] = l.split('|').map((x) => x.trim());
    if (!title) continue;
    const date = rest.map((x) => parseDate(x) != null ? x : '').find(Boolean);
    out.push({ title: title.replace(/^\*\*|\*\*$/g, '').slice(0, 140), ...(date ? { date } : {}) });
    if (out.length >= 30) break;
  }
  return out;
}

export type Template = { id: string; name: string; hint: string; kind: 'page' | 'db'; blocks?: { t: Block['t']; text: string }[]; cols?: { name: string; kind: Col['kind'] }[]; rows?: string[]; view?: DbView };
export const TEMPLATES: Template[] = [
  { id: 'viaggio', name: 'Viaggio', hint: 'Itinerario, valigia e budget', kind: 'page', blocks: [
    { t: 'h', text: 'Dove e quando' }, { t: 'p', text: 'Destinazione, date, con chi viaggi.' },
    { t: 'h', text: 'Itinerario' }, { t: 'todo', text: 'Giorno 1: arrivo e check-in' }, { t: 'todo', text: 'Giorno 2: visita' }, { t: 'todo', text: 'Giorno 3: tempo libero' },
    { t: 'h', text: 'Da prenotare' }, { t: 'todo', text: 'Voli o treni' }, { t: 'todo', text: 'Alloggio' }, { t: 'todo', text: 'Esperienze da non perdere' },
    { t: 'h', text: 'Valigia' }, { t: 'todo', text: 'Documenti' }, { t: 'todo', text: 'Caricabatterie' }, { t: 'todo', text: 'Medicine' },
    { t: 'h', text: 'Budget' }, { t: 'p', text: 'Trasporti, alloggio, cibo, extra.' }] },
  { id: 'riunione', name: 'Note di riunione', hint: 'Agenda, decisioni, azioni', kind: 'page', blocks: [
    { t: 'h', text: 'Partecipanti' }, { t: 'p', text: '' }, { t: 'h', text: 'Agenda' }, { t: 'bullet', text: '' },
    { t: 'h', text: 'Decisioni' }, { t: 'bullet', text: '' }, { t: 'h', text: 'Azioni' }, { t: 'todo', text: '' }] },
  { id: 'progetto', name: 'Progetto', hint: 'Obiettivo, tappe, rischi', kind: 'page', blocks: [
    { t: 'h', text: 'Obiettivo' }, { t: 'p', text: 'Cosa vuoi ottenere e entro quando.' },
    { t: 'h', text: 'Tappe' }, { t: 'todo', text: 'Inizio' }, { t: 'todo', text: 'Prima versione' }, { t: 'todo', text: 'Consegna' },
    { t: 'h', text: 'Rischi' }, { t: 'bullet', text: '' }, { t: 'quote', text: 'Un passo alla volta.' }] },
  { id: 'compiti', name: 'Elenco compiti', hint: 'Database con stato e scadenza', kind: 'db', cols: [{ name: 'Nome', kind: 'text' }, { name: 'Stato', kind: 'status' }, { name: 'Scadenza', kind: 'date' }], rows: ['Primo compito', 'Secondo compito'], view: 'kanban' },
  { id: 'contenuti', name: 'Calendario contenuti', hint: 'Idee con data, in calendario', kind: 'db', cols: [{ name: 'Idea', kind: 'text' }, { name: 'Stato', kind: 'status' }, { name: 'Data', kind: 'date' }], rows: ['Idea 1'], view: 'calendar' },
  { id: 'libri', name: 'Libreria', hint: 'Galleria di libri e film', kind: 'db', cols: [{ name: 'Titolo', kind: 'text' }, { name: 'Stato', kind: 'status' }, { name: 'Voto', kind: 'number' }], rows: ['Un libro da leggere'], view: 'gallery' },
];

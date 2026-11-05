/** Trasferte di lavoro (modulo PURO, nessun alias '@/'): tratte con fusi orari, itinerario, costi, documenti, promemoria di partenza, note spese.
 *  Non prenota e non paga nulla: le prenotazioni le inserisce la persona. I fusi sono calcolati qui (nessuna rete). */
const pad = (n: number) => String(n).padStart(2, '0');
export const addDays = (day: string, n: number) => { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);

/* ---------- fusi orari ---------- */
type Rule = 'eu' | 'us' | 'au' | null;
export type Zone = { id: string; label: string; std: number; rule: Rule };
export const ZONES: Zone[] = [
  { id: 'Europe/Rome', label: 'Italia', std: 60, rule: 'eu' }, { id: 'Europe/Zurich', label: 'Svizzera', std: 60, rule: 'eu' },
  { id: 'Europe/Paris', label: 'Francia', std: 60, rule: 'eu' }, { id: 'Europe/Berlin', label: 'Germania', std: 60, rule: 'eu' }, { id: 'Europe/Madrid', label: 'Spagna', std: 60, rule: 'eu' },
  { id: 'Europe/London', label: 'Regno Unito', std: 0, rule: 'eu' }, { id: 'Europe/Athens', label: 'Grecia', std: 120, rule: 'eu' },
  { id: 'America/New_York', label: 'New York', std: -300, rule: 'us' }, { id: 'America/Chicago', label: 'Chicago', std: -360, rule: 'us' }, { id: 'America/Los_Angeles', label: 'Los Angeles', std: -480, rule: 'us' },
  { id: 'Asia/Dubai', label: 'Dubai', std: 240, rule: null }, { id: 'Asia/Kolkata', label: 'India', std: 330, rule: null }, { id: 'Asia/Singapore', label: 'Singapore', std: 480, rule: null },
  { id: 'Asia/Hong_Kong', label: 'Hong Kong', std: 480, rule: null }, { id: 'Asia/Tokyo', label: 'Giappone', std: 540, rule: null }, { id: 'Australia/Sydney', label: 'Sydney', std: 600, rule: 'au' },
];
export const zoneOf = (id: string | undefined): Zone => ZONES.find((z) => z.id === id) ?? ZONES[0]!;
const nthSunday = (y: number, m: number, n: number): number => { const first = new Date(Date.UTC(y, m, 1)).getUTCDay(); return 1 + ((7 - first) % 7) + (n - 1) * 7; }; // n-esima domenica del mese (m: 0-11)
const lastSunday = (y: number, m: number): number => { const last = new Date(Date.UTC(y, m + 1, 0)); return last.getUTCDate() - last.getUTCDay(); };
/** Scarto dall'UTC, in minuti, che vale in quella zona nell'istante UTC dato (ora legale compresa). */
export function offsetAt(z: Zone, utc: number): number {
  const y = new Date(utc).getUTCFullYear();
  if (z.rule === 'eu') { const a = Date.UTC(y, 2, lastSunday(y, 2), 1); const b = Date.UTC(y, 9, lastSunday(y, 9), 1); return utc >= a && utc < b ? z.std + 60 : z.std; }
  if (z.rule === 'us') { const a = Date.UTC(y, 2, nthSunday(y, 2, 2), 2) - z.std * 60000; const b = Date.UTC(y, 10, nthSunday(y, 10, 1), 2) - (z.std + 60) * 60000; return utc >= a && utc < b ? z.std + 60 : z.std; }
  if (z.rule === 'au') { const a = Date.UTC(y, 9, nthSunday(y, 9, 1), 2) - z.std * 60000; const b = Date.UTC(y, 3, nthSunday(y, 3, 1), 3) - (z.std + 60) * 60000; return utc >= a || utc < b ? z.std + 60 : z.std; }
  return z.std;
}
const parts = (day: string, time: string) => { const [y, m, d] = day.split('-').map(Number); const [h, mi] = time.split(':').map(Number); return { y: y!, m: m! - 1, d: d!, h: h ?? 0, mi: mi ?? 0 }; };
/** Da ora locale di una zona a istante UTC (ms). */
export function toUtc(day: string, time: string, tz: string): number {
  const z = zoneOf(tz); const p = parts(day, time); const local = Date.UTC(p.y, p.m, p.d, p.h, p.mi);
  let u = local - z.std * 60000; u = local - offsetAt(z, u) * 60000; return local - offsetAt(z, u) * 60000;
}
export function fromUtc(utc: number, tz: string): { day: string; time: string } {
  const z = zoneOf(tz); const d = new Date(utc + offsetAt(z, utc) * 60000);
  return { day: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` };
}
/** La stessa ora vista in un altro fuso. `shift` = giorni di differenza (-1, 0, +1). */
export function convert(day: string, time: string, from: string, to: string): { day: string; time: string; shift: number; diffMin: number } {
  const u = toUtc(day, time, from); const r = fromUtc(u, to);
  return { ...r, shift: daysBetween(day, r.day), diffMin: offsetAt(zoneOf(to), u) - offsetAt(zoneOf(from), u) };
}
export const diffLabel = (min: number): string => (min === 0 ? 'stessa ora' : `${min > 0 ? '+' : '−'}${Math.floor(Math.abs(min) / 60)}${Math.abs(min) % 60 ? `:${pad(Math.abs(min) % 60)}` : ''} ore`);

/* ---------- viaggio ---------- */
export type SegKind = 'flight' | 'train' | 'hotel' | 'car' | 'meeting' | 'other';
export const SEG_LABEL: Record<SegKind, string> = { flight: 'Volo', train: 'Treno', hotel: 'Hotel', car: 'Auto', meeting: 'Riunione', other: 'Altro' };
export type Seg = { id: string; kind: SegKind; title: string; day: string; time: string; tz: string; endDay?: string; endTime?: string; endTz?: string; place?: string; ref?: string; cost?: number; expensed?: boolean; note?: string };
export type Doc = { t: string; done: boolean };
export type Trip = { id: string; team_id: string; user_id: string; title: string; dest: string; from_day: string; to_day: string; purpose: string; budget: number | null; currency: 'CHF' | 'EUR'; international: boolean; segments: Seg[]; docs: Doc[]; status: 'draft' | 'requested' | 'approved' | 'rejected' | 'done'; decided_by: string | null; decision_note: string };
export const STATUS_LABEL: Record<Trip['status'], string> = { draft: 'Bozza', requested: 'In attesa di approvazione', approved: 'Approvata', rejected: 'Non approvata', done: 'Conclusa' };
export const nightsOf = (t: Pick<Trip, 'from_day' | 'to_day'>) => daysBetween(t.from_day, t.to_day);
export const segUtc = (s: Seg) => toUtc(s.day, s.time, s.tz);
const segEnd = (s: Seg) => (s.endDay && s.endTime ? toUtc(s.endDay, s.endTime, s.endTz ?? s.tz) : null);

/** I giorni del viaggio con le tratte in ordine di tempo reale (non di orologio): un volo che arriva il giorno dopo resta al suo posto. */
export function itinerary(t: Pick<Trip, 'from_day' | 'to_day' | 'segments'>): { day: string; items: Seg[] }[] {
  const days = new Map<string, Seg[]>();
  for (let d = t.from_day; d <= t.to_day; d = addDays(d, 1)) days.set(d, []);
  for (const s of [...t.segments].sort((a, b) => segUtc(a) - segUtc(b))) { const l = days.get(s.day) ?? []; l.push(s); days.set(s.day, l); }
  return [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, items]) => ({ day, items }));
}
/** Descrizione di una tratta con ora locale e ora di casa. */
export function segTimes(s: Seg, homeTz: string): { start: string; end: string | null; home: string | null; shift: number } {
  const h = convert(s.day, s.time, s.tz, homeTz);
  const e = s.endDay && s.endTime ? `${s.endTime}` : null;
  return { start: s.time, end: e, home: s.tz === homeTz || h.diffMin === 0 ? null : `${h.time}${h.shift ? ` (${h.shift > 0 ? '+' : ''}${h.shift} g)` : ''}`, shift: h.shift };
}
export function checkSegments(t: Pick<Trip, 'from_day' | 'to_day' | 'segments'>): string[] {
  const out: string[] = [];
  for (const s of t.segments) {
    if (s.day < t.from_day || s.day > t.to_day) out.push(`«${s.title}» è fuori dalle date del viaggio.`);
    const e = segEnd(s); if (e != null && e <= segUtc(s)) out.push(`«${s.title}»: l'arrivo è prima della partenza.`);
  }
  const sorted = t.segments.filter((s) => s.kind === 'flight' || s.kind === 'train' || s.kind === 'meeting').sort((a, b) => segUtc(a) - segUtc(b));
  for (let i = 1; i < sorted.length; i++) { const p = sorted[i - 1]!; const pe = segEnd(p); if (pe != null && segUtc(sorted[i]!) < pe) out.push(`«${sorted[i]!.title}» comincia prima che finisca «${p.title}».`); }
  return out;
}

/* ---------- costi e note spese ---------- */
export function tripCost(t: Pick<Trip, 'segments' | 'budget'>): { total: number; byKind: Partial<Record<SegKind, number>>; left: number | null; over: boolean } {
  const byKind: Partial<Record<SegKind, number>> = {}; let total = 0;
  for (const s of t.segments) if (s.cost && s.cost > 0) { byKind[s.kind] = Math.round(((byKind[s.kind] ?? 0) + s.cost) * 100) / 100; total += s.cost; }
  total = Math.round(total * 100) / 100;
  return { total, byKind, left: t.budget != null ? Math.round((t.budget - total) * 100) / 100 : null, over: t.budget != null && total > t.budget };
}
const CAT: Record<SegKind, string> = { flight: 'Trasferta', train: 'Trasferta', car: 'Carburante', hotel: 'Hotel', meeting: 'Altro', other: 'Altro' };
export function expenseDrafts(t: Pick<Trip, 'segments' | 'title'>): { segId: string; day: string; category: string; description: string; amount: number }[] {
  return t.segments.filter((s) => s.cost && s.cost > 0 && !s.expensed).map((s) => ({ segId: s.id, day: s.day, category: CAT[s.kind], description: `${t.title}: ${s.title}`.slice(0, 180), amount: s.cost! }));
}

/* ---------- documenti ---------- */
export function defaultDocs(international: boolean, hasHotel: boolean, hasFlight: boolean): Doc[] {
  const l = ['Biglietti e prenotazioni salvati', hasHotel ? 'Conferma dell\'hotel stampata o salvata' : 'Dove dormi: indirizzo salvato', 'Carta di credito aziendale o contanti', 'Caricabatterie e adattatore', 'Contatti della persona che incontri'];
  if (international) l.unshift('Passaporto o carta d\'identità valida', 'Assicurazione di viaggio', 'Tessera sanitaria / carta europea di assicurazione malattia', 'Controllato se serve un visto o un permesso');
  else l.unshift('Carta d\'identità valida');
  if (hasFlight) l.push('Check-in fatto');
  return l.map((t) => ({ t, done: false }));
}
export const docsProgress = (d: Doc[]) => (d.length ? Math.round((d.filter((x) => x.done).length / d.length) * 100) : 0);

/* ---------- promemoria di partenza ---------- */
export type Reminder = { day: string; time: string; title: string };
/** Quando partire da casa e cosa preparare, nell'ora di casa. Aereo: arrivo in aeroporto 2 ore prima + 45 minuti di strada; treno: 30 minuti prima + 30 di strada. */
export function departureReminders(t: Pick<Trip, 'title' | 'segments'>, homeTz: string, today: string): Reminder[] {
  const out: Reminder[] = [];
  for (const s of t.segments) {
    if (s.kind !== 'flight' && s.kind !== 'train') continue;
    const lead = s.kind === 'flight' ? 165 : 60; const u = segUtc(s) - lead * 60000; const h = fromUtc(u, homeTz);
    out.push({ ...h, title: `Parti per ${s.kind === 'flight' ? 'l\'aeroporto' : 'la stazione'}: ${s.title}` });
    if (s.kind === 'flight') { const c = fromUtc(segUtc(s) - 24 * 3600000, homeTz); out.push({ ...c, title: `Check-in aperto: ${s.title}` }); }
    const ev = fromUtc(segUtc(s) - 24 * 3600000, homeTz); out.push({ day: ev.day, time: '20:00', title: `Prepara la valigia e i documenti: ${t.title}` });
  }
  const seen = new Set<string>();
  return out.filter((r) => r.day >= today && !seen.has(r.day + r.time + r.title) && seen.add(r.day + r.time + r.title)).sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
}

/** I tuoi impegni di lavoro nei giorni della trasferta: da spostare o da seguire a distanza. */
export function planClashes(t: Pick<Trip, 'from_day' | 'to_day'>, events: Record<string, { time: string; title: string; team?: string; wid?: string }[]>, skipWid: Set<string> = new Set()): { day: string; time: string; title: string }[] {
  const out: { day: string; time: string; title: string }[] = [];
  for (let d = t.from_day; d <= t.to_day; d = addDays(d, 1)) for (const e of events[d] ?? []) if (e.team && !(e.wid && skipWid.has(e.wid))) out.push({ day: d, time: e.time, title: e.title });
  return out.sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
}

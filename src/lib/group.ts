/** Gruppo di lavoro (modulo PURO, nessun alias '@/'): turni, sovrapposizioni, ore, conferma mensile con PDF, messaggi d'errore del server.
 *  Il datore vede solo ore, ferie e piani: qui non esiste nessun calcolo di soldi. */
const pad = (n: number) => String(n).padStart(2, '0');
export const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const mins = (t: string) => { const [h, m] = t.split(':').map(Number) as [number, number]; return h * 60 + m; };
const dateOf = (day: string) => new Date(day + 'T12:00:00Z');
const dayDiff = (a: string, b: string) => Math.round((dateOf(a).getTime() - dateOf(b).getTime()) / 86400000);
export const addDays = (day: string, n: number): string => { const d = dateOf(day); d.setUTCDate(d.getUTCDate() + n); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
export const weekdayOf = (day: string): number => (dateOf(day).getUTCDay() + 6) % 7;
export const weekStart = (day: string): string => addDays(day, -weekdayOf(day));
export const monthOfDay = (day: string): string => day.slice(0, 7);
export const prevMonth = (day: string): string => { const [y, m] = day.slice(0, 7).split('-').map(Number) as [number, number]; const d = new Date(Date.UTC(y, m - 2, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; };
export const daysOfMonth = (month: string): string[] => { const [y, m] = month.split('-').map(Number) as [number, number]; const n = new Date(Date.UTC(y, m, 0)).getUTCDate(); return Array.from({ length: n }, (_, i) => `${month}-${pad(i + 1)}`); };

export type GShift = { id: string; team_id: string; user_id: string; day: string; start_t: string; end_t: string; label: string; status: 'confirmed' | 'proposed' | 'declined'; removal: boolean };
export const shiftHours = (s: Pick<GShift, 'start_t' | 'end_t'>): number => { if (!isTime(s.start_t) || !isTime(s.end_t)) return 0; let d = mins(s.end_t) - mins(s.start_t); if (d <= 0) d += 1440; return Math.round(d / 60 * 100) / 100; };
const span = (day: string, base: string, s: string, e: string): [number, number] => { const o = dayDiff(day, base) * 1440; const a = o + mins(s); let b = o + mins(e); if (mins(e) <= mins(s)) b += 1440; return [a, b]; };

/** Questo orario si sovrappone a un altro turno (anche oltre la mezzanotte, nei giorni vicini)? Lo stesso controllo lo fa il server: qui serve a mostrare subito chi è libero. */
export function clashes(shifts: Pick<GShift, 'id' | 'day' | 'start_t' | 'end_t' | 'status'>[], day: string, start: string, end: string, exceptId?: string): boolean {
  if (!isTime(start) || !isTime(end)) return false;
  const [a1, a2] = span(day, day, start, end);
  return shifts.some((s) => s.status !== 'declined' && s.id !== exceptId && Math.abs(dayDiff(s.day, day)) <= 1 && (() => { const [b1, b2] = span(s.day, day, s.start_t, s.end_t); return a1 < b2 && b1 < a2; })());
}
export const absenceCovers = (abs: { from_day: string; to_day: string; status: string }[], day: string): boolean => abs.some((a) => a.status === 'approved' && day >= a.from_day && day <= a.to_day);

/** Ore pianificate (turni confermati) in un intervallo, e ore da contratto per lo stesso periodo. */
export function planned(shifts: GShift[], from: string, to: string): number { return Math.round(shifts.filter((s) => s.status === 'confirmed' && s.day >= from && s.day <= to).reduce((t, s) => t + shiftHours(s), 0) * 100) / 100; }
export const targetHours = (weekly: number, from: string, to: string): number => Math.round(weekly * (dayDiff(to, from) + 1) / 7 * 100) / 100;
/** Sopra o sotto il contratto: positivo = ore in più, negativo = sotto di ore (sta recuperando, o mancano turni). */
export const balanceOf = (plannedH: number, targetH: number): number => Math.round((plannedH - targetH) * 100) / 100;

export type Person = { user_id: string; name: string; role: string; weekly_hours: number; vacation_days: number; overtime_mode: string; ends_on?: string | null; planned: number; target: number; pending_shifts: number; vacation_taken: number; cover: boolean; month_confirmed: boolean | null };
export type Flag = { kind: 'under' | 'over' | 'pending' | 'month' | 'leaving'; text: string };
/** Cosa deve guardare il datore per ogni persona, in ordine di importanza. */
export function flagsOf(p: Person, today: string): Flag[] {
  const out: Flag[] = []; const d = balanceOf(p.planned, p.target);
  if (p.ends_on && p.ends_on >= today && dayDiff(p.ends_on, today) <= 60) out.push({ kind: 'leaving', text: `Lascia il lavoro il ${p.ends_on}` });
  if (p.pending_shifts) out.push({ kind: 'pending', text: `${p.pending_shifts} ${p.pending_shifts === 1 ? 'turno da confermare' : 'turni da confermare'}` });
  if (d <= -1) out.push({ kind: 'under', text: `Sotto di ${Math.round(Math.abs(d) * 10) / 10} h rispetto al contratto` });
  if (d >= 1) out.push({ kind: 'over', text: `${Math.round(d * 10) / 10} h in più del contratto` });
  if (p.month_confirmed === false) out.push({ kind: 'month', text: 'Mese non ancora confermato' });
  return out;
}
export const vacationLeft = (p: Pick<Person, 'vacation_days' | 'vacation_taken'>): number => Math.max(0, p.vacation_days - p.vacation_taken);

export const OT_LABEL: Record<string, string> = { paid: 'Straordinari pagati con maggiorazione', plain: 'Straordinari pagati', bank: 'Straordinari recuperati con riposo', mixed: 'Straordinari in parte pagati, in parte recuperati' };

/** Messaggi del server in italiano chiaro. */
export function groupError(e: unknown): string {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e ?? '');
  if (/sovrapposto/.test(m)) return 'Si sovrappone a un altro turno o a una assenza: scegli un altro orario.';
  if (/gia_coperto/.test(m)) return 'Qualcuno l\'ha già preso.';
  if (/non_autorizzato/.test(m)) return 'Non hai il permesso per farlo.';
  if (/non_trovato/.test(m)) return 'Non lo trovo più: forse è già stato cambiato.';
  if (/ora_non_valida/.test(m)) return 'Scrivi gli orari così: 09:00 e 17:00.';
  if (/non_nel_team/.test(m)) return 'Questa persona non fa parte del gruppo.';
  if (/mese_non_valido/.test(m)) return 'Mese non valido.';
  if (/troppi_team/.test(m)) return 'Hai già 10 gruppi: eliminane uno prima di crearne un altro.';
  if (/PT401|unauthorized|JWT|not authenticated|Auth session missing/i.test(m)) return 'La tua sessione è scaduta: esci e rientra nell\'account, poi riprova.';
  if (/Server non collegato/.test(m)) return 'Non c\'è il collegamento con il server: serve un account verificato e la rete.';
  const raw = m.replace(/\s+/g, ' ').trim().slice(0, 90);
  return `Non sono riuscita a farlo: controlla la connessione e riprova.${raw ? ` (${raw})` : ''}`;
}

/** Il PDF mensile: ore per giorno, totale e firma digitale (impronta) di ciò che il dipendente conferma. Senza importi. */
export type MonthRow = { day: string; start: string; end: string; label: string; hours: number };
export const monthRows = (shifts: GShift[], month: string): MonthRow[] => shifts.filter((s) => s.status === 'confirmed' && s.day.startsWith(month)).sort((a, b) => a.day.localeCompare(b.day) || a.start_t.localeCompare(b.start_t)).map((s) => ({ day: s.day, start: s.start_t, end: s.end_t, label: s.label, hours: shiftHours(s) }));
/** Impronta semplice e stabile (non è una firma legale): cambia se cambia anche una sola riga. */
export function digestOf(rows: MonthRow[], month: string, who: string): string {
  const src = `${month}|${who}|` + rows.map((r) => `${r.day}${r.start}${r.end}${r.hours}`).join(';'); let h1 = 0x811c9dc5, h2 = 0x1b873593;
  for (let i = 0; i < src.length; i++) { const c = src.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = (Math.imul(h2 ^ c, 2246822519) + i) >>> 0; }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const IT_MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const monthName = (m: string): string => `${IT_MONTHS[Number(m.slice(5, 7)) - 1] ?? ''} ${m.slice(0, 4)}`;
export function monthPdfHtml(o: { group: string; person: string; month: string; rows: MonthRow[]; digest: string; confirmedAt?: string }): string {
  const total = Math.round(o.rows.reduce((t, r) => t + r.hours, 0) * 100) / 100;
  const body = o.rows.length ? o.rows.map((r) => `<tr><td>${esc(r.day.slice(8))}/${esc(r.day.slice(5, 7))}</td><td>${esc(r.start)} - ${esc(r.end)}</td><td>${esc(r.label)}</td><td style="text-align:right">${r.hours}</td></tr>`).join('') : '<tr><td colspan="4">Nessun turno in questo mese.</td></tr>';
  return `<html><head><meta charset="utf-8"/><style>body{font-family:Helvetica,Arial,sans-serif;color:#10151d;margin:32px}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;font-weight:400;margin:0 0 18px;color:#566070}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:6px 8px;border-bottom:1px solid #d3dae5;text-align:left}th{background:#eef1f6}.tot{margin-top:14px;font-size:15px;font-weight:700}.foot{margin-top:26px;font-size:11px;color:#566070}</style></head><body><h1>Ore del mese: ${esc(monthName(o.month))}</h1><h2>${esc(o.group)} · ${esc(o.person)}</h2><table><tr><th>Giorno</th><th>Orario</th><th>Turno</th><th style="text-align:right">Ore</th></tr>${body}</table><div class="tot">Totale ore: ${total}</div><div class="foot">Confermato dal dipendente${o.confirmedAt ? ` il ${esc(o.confirmedAt)}` : ''} · impronta ${esc(o.digest)}<br/>Il documento riporta solo ore e turni, nessun importo.</div></body></html>`;
}

/** La panoramica del datore costruita dai dati già letti (il server permette al datore di leggere tutto il gruppo). Solo ore, ferie e conferme: nessun importo. */
export type OvIn = {
  members: { user_id: string; name: string; role: string }[]; shifts: GShift[];
  contracts: { user_id: string; weekly_hours: number; vacation_days: number; overtime_mode: string; ends_on: string | null }[];
  absences: { user_id: string; kind: string; from_day: string; to_day: string; status: string }[];
  cover: { user_id: string; available: boolean }[]; months: { user_id: string; month: string; status: string }[];
};
export function overviewOf(d: OvIn, from: string, to: string): Person[] {
  const year = from.slice(0, 4);
  return d.members.map((m): Person => {
    const c = d.contracts.find((x) => x.user_id === m.user_id); const mine = d.shifts.filter((s) => s.user_id === m.user_id);
    const taken = d.absences.filter((a) => a.user_id === m.user_id && a.kind === 'ferie' && a.status === 'approved' && a.to_day >= `${year}-01-01` && a.from_day <= `${year}-12-31`)
      .reduce((t, a) => t + dayDiff(a.to_day < `${year}-12-31` ? a.to_day : `${year}-12-31`, a.from_day > `${year}-01-01` ? a.from_day : `${year}-01-01`) + 1, 0);
    const mo = d.months.find((x) => x.user_id === m.user_id && x.month === from.slice(0, 7));
    return {
      user_id: m.user_id, name: m.name, role: m.role, weekly_hours: c?.weekly_hours ?? 40, vacation_days: c?.vacation_days ?? 20, overtime_mode: c?.overtime_mode ?? 'paid', ends_on: c?.ends_on ?? null,
      planned: planned(mine, from, to), target: targetHours(c?.weekly_hours ?? 40, from, to), pending_shifts: mine.filter((s) => s.status === 'proposed').length, vacation_taken: taken,
      cover: d.cover.find((x) => x.user_id === m.user_id)?.available ?? false, month_confirmed: mo ? mo.status === 'confirmed' : null,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/** Fino a quando ha senso confrontare le ore con il contratto: fino all'ultimo turno pianificato del mese (o a oggi, se è dopo), mai oltre la fine del mese. Così un mese non ancora pianificato non sembra «sotto di ore». */
export function windowEnd(shifts: Pick<GShift, 'day' | 'status'>[], today: string, monthEnd: string): string {
  const last = shifts.filter((s) => s.status === 'confirmed' && s.day <= monthEnd && s.day.slice(0, 7) === monthEnd.slice(0, 7)).reduce((m, s) => (s.day > m ? s.day : m), '');
  const e = last > today ? last : today;
  return e > monthEnd ? monthEnd : e < `${monthEnd.slice(0, 7)}-01` ? monthEnd : e;
}
export const r1 = (n: number): number => Math.round(n * 10) / 10;

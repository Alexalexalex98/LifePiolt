/** Ore e stipendio (modulo PURO, nessun alias '@/'): dal contratto e dalle ore di ogni giorno al lordo, al netto «da contratto», agli straordinari, alle ferie,
 *  e alla stima che si affina con le buste paga e con quello che entra sul conto. Il netto qui NON è il netto fiscale: usa solo le trattenute indicate dal contratto
 *  e poi quelle vere viste nelle buste paga. Le imposte sul reddito sono un'altra cosa (scheda Dichiarazione fiscale). */
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const dateOf = (day: string) => new Date(day + 'T12:00:00Z');
const r2 = (n: number) => Math.round(n * 100) / 100;
const r1 = (n: number) => Math.round(n * 10) / 10;
export const validDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(dateOf(s).getTime()) && isoOf(dateOf(s)) === s;
export const validMonth = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const addDays = (day: string, n: number): string => { const d = dateOf(day); d.setUTCDate(d.getUTCDate() + n); return isoOf(d); };
/** 0 = lunedì … 6 = domenica */
export const weekdayOf = (day: string): number => (dateOf(day).getUTCDay() + 6) % 7;
export const monthOf = (day: string): string => day.slice(0, 7);
export function daysOfMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${pad(i + 1)}`);
}
export const addMonth = (month: string, n: number): string => { const [y, m] = month.split('-').map(Number) as [number, number]; const d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; };
/** Lunedì della settimana di quel giorno: serve a contare gli straordinari settimana per settimana. */
export const weekStart = (day: string): string => addDays(day, -weekdayOf(day));

export type Contract = {
  /** a ore (paga per ora) o a stipendio fisso mensile */
  kind: 'hourly' | 'monthly';
  /** lordo all'ora (contratto a ore) */
  hourly?: number;
  /** lordo al mese (contratto fisso) */
  monthly?: number;
  /** ore settimanali da contratto */
  weekHours: number;
  /** quanto resta in busta dopo le trattenute del CONTRATTO (contributi ecc.), in %: è il punto di partenza finché non ci sono buste paga */
  netPct: number;
  overtimePct: number; nightPct: number; sundayPct: number; holidayPct: number;
  /** giorni di ferie all'anno */
  vacationDays: number;
  /** ferie e malattia pagate come una giornata di contratto */
  paidLeave: boolean;
  /** pausa non pagata di default, in minuti */
  pauseMin: number;
  currency: 'EUR' | 'CHF';
  /** inizio del contratto YYYY-MM-DD (facoltativo) */
  from?: string;
  employer?: string;
  pdf?: string; pages?: string[];
};
export const defaultContract = (): Contract => ({ kind: 'hourly', hourly: 0, weekHours: 40, netPct: 85, overtimePct: 25, nightPct: 25, sundayPct: 50, holidayPct: 50, vacationDays: 20, paidLeave: true, pauseMin: 0, currency: 'EUR' });

export type DayKind = 'work' | 'vacation' | 'sick' | 'holiday' | 'off';
export const DAY_KINDS: { k: DayKind; n: string }[] = [{ k: 'work', n: 'Lavoro' }, { k: 'vacation', n: 'Ferie' }, { k: 'sick', n: 'Malattia' }, { k: 'holiday', n: 'Festivo non lavorato' }, { k: 'off', n: 'Riposo' }];
export type Day = {
  date: string; kind: DayKind;
  /** HH:MM; se mancano si usano le `hours` scritte */
  start?: string; end?: string; pause?: number; hours: number;
  /** festivo lavorato: maggiorazione festivo */
  holiday?: boolean;
  /** confermato da te (altrimenti è una previsione, per esempio dai turni) */
  confirmed: boolean;
  shiftName?: string; note?: string;
  source: 'manuale' | 'turno' | 'foto';
};

export const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const mins = (t: string) => { const [h, m] = t.split(':').map(Number) as [number, number]; return h * 60 + m; };
/** Ore tra due orari, anche oltre la mezzanotte, meno la pausa. */
export function hoursBetween(start: string, end: string, pause = 0): number {
  if (!isTime(start) || !isTime(end)) return 0;
  let d = mins(end) - mins(start); if (d <= 0) d += 1440;
  return Math.max(0, r2((d - Math.max(0, pause)) / 60));
}
/** Ore di notte (22:00-06:00) dentro un turno. */
export function nightHours(start: string, end: string, pause = 0): number {
  if (!isTime(start) || !isTime(end)) return 0;
  let a = mins(start), b = mins(end); if (b <= a) b += 1440;
  let n = 0;
  for (const [lo, hi] of [[0, 360], [1320, 1800], [2760, 2880]] as const) n += Math.max(0, Math.min(b, hi) - Math.max(a, lo));
  const total = b - a; const scaled = total > 0 ? n * Math.max(0, total - Math.max(0, pause)) / total : 0;
  return r2(scaled / 60);
}
/** Le ore di un giorno: da inizio/fine se ci sono, altrimenti quelle scritte. Giorni di ferie/malattia/festivo valgono come una giornata di contratto se `paidLeave`. */
export function dayHours(d: Day, c: Contract): number {
  if (d.kind === 'off') return 0;
  if (d.kind !== 'work') return c.paidLeave ? r2(c.weekHours / 5) : 0;
  if (d.start && d.end && isTime(d.start) && isTime(d.end)) return hoursBetween(d.start, d.end, d.pause ?? c.pauseMin);
  return Math.max(0, d.hours || 0);
}
/** Quanto vale un'ora: la paga oraria, oppure per il contratto fisso la paga mensile spalmata sulle ore del contratto. */
export function hourlyRate(c: Contract): number {
  if (c.kind === 'hourly') return Math.max(0, c.hourly ?? 0);
  const wk = Math.max(1, c.weekHours); return r2(Math.max(0, c.monthly ?? 0) * 12 / (wk * 52));
}

/** `gross`/`net` entrano nei totali; `value`/`valueNet` sono quanto «vale» la giornata (per il contratto fisso: ore × paga oraria equivalente), da mostrare giorno per giorno. */
export type DayPay = { date: string; hours: number; base: number; extra: number; gross: number; net: number; value: number; valueNet: number; confirmed: boolean; kind: DayKind };
export type MonthPay = {
  month: string; days: DayPay[];
  hours: number; confirmedHours: number; overtimeHours: number;
  /** lordo di ciò che hai confermato / di tutto il mese (compresi i giorni solo previsti) */
  confirmedGross: number; gross: number;
  /** netto «da contratto», poi calibrato con le buste paga */
  confirmedNet: number; net: number;
  ratio: number; ratioFrom: 'contratto' | 'buste paga';
  /** per il contratto fisso: la parte fissa */
  fixed: number; pending: number;
};

/** Il lordo di un giorno senza lo straordinario (che si calcola sulla settimana): base + maggiorazioni notte/domenica/festivo. */
function dayBase(d: Day, c: Contract): { hours: number; base: number; extra: number } {
  const h = dayHours(d, c); const rate = hourlyRate(c);
  if (d.kind !== 'work') return { hours: h, base: c.kind === 'hourly' ? r2(h * rate) : 0, extra: 0 };
  let extra = 0;
  if (d.start && d.end) extra += nightHours(d.start, d.end, d.pause ?? c.pauseMin) * rate * (c.nightPct / 100);
  if (weekdayOf(d.date) === 6) extra += h * rate * (c.sundayPct / 100);
  if (d.holiday) extra += h * rate * (c.holidayPct / 100);
  return { hours: h, base: c.kind === 'hourly' ? r2(h * rate) : 0, extra: r2(extra) };
}

/** Le ore oltre il contratto, settimana per settimana (si contano le ore di lavoro e i giorni pagati). */
export function overtimeByWeek(days: Day[], c: Contract): Map<string, { hours: number; over: number }> {
  const w = new Map<string, { hours: number; over: number }>();
  for (const d of days) { const k = weekStart(d.date); const e = w.get(k) ?? { hours: 0, over: 0 }; e.hours += dayHours(d, c); w.set(k, e); }
  for (const e of w.values()) { e.hours = r2(e.hours); e.over = r2(Math.max(0, e.hours - Math.max(0, c.weekHours))); }
  return w;
}

/** Il netto che si stima: parte dalle trattenute del contratto e passa alle trattenute vere viste nelle buste paga man mano che ne carichi (le ultime 3 pesano di più). */
export type Payslip = { id: string; month: string; gross: number; net: number; hours?: number; pdf?: string; pages: string[]; source: 'foto' | 'file' | 'scan' | 'manuale'; createdAt: string; bankDate?: string; note?: string };
export function netRatio(c: Contract, slips: Payslip[]): { ratio: number; from: 'contratto' | 'buste paga'; n: number } {
  const base = Math.min(1, Math.max(0.3, (c.netPct || 85) / 100));
  const ok = slips.filter((s) => s.gross > 0 && s.net > 0 && s.net <= s.gross).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 3);
  if (!ok.length) return { ratio: base, from: 'contratto', n: 0 };
  const W = [3, 2, 1]; let sw = 0, sr = 0;
  ok.forEach((s, i) => { sw += W[i]!; sr += (s.net / s.gross) * W[i]!; });
  const obs = sr / sw; const trust = Math.min(1, ok.length / 3 + 0.34);
  return { ratio: r2((obs * trust + base * (1 - trust)) * 1000) / 1000, from: 'buste paga', n: ok.length };
}

/** Conto del mese: per ogni giorno lordo e netto, e il totale. `days` sono le giornate (confermate o previste) di quel mese. */
export function monthPay(month: string, all: Day[], c: Contract, slips: Payslip[] = []): MonthPay {
  const inMonth = all.filter((d) => monthOf(d.date) === month).sort((a, b) => a.date.localeCompare(b.date));
  const { ratio, from } = netRatio(c, slips);
  // gli straordinari si contano sulla settimana intera, anche se a cavallo di due mesi
  const wk = overtimeByWeek(all.filter((d) => { const m = monthOf(d.date); return m === month || m === addMonth(month, -1) || m === addMonth(month, 1); }), c);
  const rate = hourlyRate(c);
  const seen = new Set<string>(); const days: DayPay[] = [];
  let overtimeHours = 0;
  for (const d of inMonth) {
    const b = dayBase(d, c);
    // lo straordinario si assegna al giorno in cui la settimana supera le ore del contratto
    let extra = b.extra; let ot = 0;
    const w = wk.get(weekStart(d.date));
    if (w && w.over > 0 && d.kind === 'work') {
      const before = all.filter((x) => weekStart(x.date) === weekStart(d.date) && x.date < d.date).reduce((s, x) => s + dayHours(x, c), 0);
      const beyond = Math.max(0, Math.min(b.hours, before + b.hours - Math.max(0, c.weekHours)));
      ot = beyond; extra += beyond * rate * (c.overtimePct / 100) + (c.kind === 'monthly' ? beyond * rate : 0);
    }
    overtimeHours += ot; seen.add(d.date);
    const gross = r2(b.base + extra);
    const value = c.kind === 'hourly' ? gross : r2(b.hours * rate + extra);
    days.push({ date: d.date, hours: b.hours, base: b.base, extra: r2(extra), gross, net: r2(gross * ratio), value, valueNet: r2(value * ratio), confirmed: d.confirmed, kind: d.kind });
  }
  const fixed = c.kind === 'monthly' ? Math.max(0, c.monthly ?? 0) : 0;
  const sum = (f: (d: DayPay) => number, only?: boolean) => days.filter((d) => only === undefined || d.confirmed === only).reduce((s, d) => s + f(d), 0);
  const confirmedGross = r2(sum((d) => d.gross, true) + fixed); const gross = r2(sum((d) => d.gross) + fixed);
  return {
    month, days, hours: r2(sum((d) => d.hours)), confirmedHours: r2(sum((d) => d.hours, true)), overtimeHours: r2(overtimeHours),
    confirmedGross, gross, confirmedNet: r2(confirmedGross * ratio), net: r2(gross * ratio), ratio, ratioFrom: from, fixed, pending: days.filter((d) => !d.confirmed && d.kind === 'work').length,
  };
}

/** I turni dell'app diventano giornate previste (da confermare). Un turno oltre la mezzanotte conta nel giorno in cui inizia. Non tocca i giorni già inseriti. */
export type ShiftLike = { name: string; start: string; end: string; weekdays: number[]; dates: string[] };
export function planFromShifts(shifts: ShiftLike[], month: string, existing: Record<string, Day>, c: Contract): Day[] {
  const out: Day[] = [];
  for (const date of daysOfMonth(month)) {
    if (existing[date]) continue;
    const wd = weekdayOf(date);
    const s = shifts.find((x) => isTime(x.start) && isTime(x.end) && (x.weekdays.includes(wd) || x.dates.includes(date)));
    if (!s) continue;
    out.push({ date, kind: 'work', start: s.start, end: s.end, pause: c.pauseMin, hours: hoursBetween(s.start, s.end, c.pauseMin), confirmed: false, shiftName: s.name, source: 'turno' });
  }
  return out;
}

/** Ferie e ore in più dell'anno. Le ferie maturano mese per mese dall'inizio dell'anno (o del contratto). */
export type Balance = { year: string; vacationTotal: number; vacationAccrued: number; vacationTaken: number; vacationLeft: number; vacationLeftAccrued: number; overtimeHours: number; sickDays: number; workedHours: number };
export function balance(all: Day[], c: Contract, today: string): Balance {
  const year = today.slice(0, 4);
  const mine = all.filter((d) => d.date.startsWith(year));
  const taken = mine.filter((d) => d.kind === 'vacation' && d.confirmed).length;
  const startMonth = c.from && c.from.startsWith(year) ? Number(c.from.slice(5, 7)) : 1;
  const curMonth = Number(today.slice(5, 7));
  const months = Math.max(0, curMonth - startMonth + 1);
  const total = Math.max(0, c.vacationDays);
  const accrued = r1(Math.min(total, total * (c.from && c.from.startsWith(year) ? months / (13 - startMonth) : months / 12)));
  const conf = mine.filter((d) => d.confirmed);
  const wk = overtimeByWeek(conf, c);
  let over = 0; for (const e of wk.values()) over += e.over;
  return {
    year, vacationTotal: total, vacationAccrued: accrued, vacationTaken: taken, vacationLeft: r1(total - taken), vacationLeftAccrued: r1(accrued - taken),
    overtimeHours: r2(over), sickDays: conf.filter((d) => d.kind === 'sick').length, workedHours: r2(conf.reduce((s, d) => s + (d.kind === 'work' ? dayHours(d, c) : 0), 0)),
  };
}

/** Quanto è davvero entrato: cerca sul conto l'accredito che somiglia al netto di quella busta paga (di solito a fine mese o nei primi giorni del successivo). */
export type BankMove = { date: string; label: string; amount: number };
export function matchBank(moves: BankMove[], slip: Pick<Payslip, 'month' | 'net'>): { move: BankMove; diff: number } | null {
  if (!(slip.net > 0)) return null;
  const from = `${slip.month}-15`; const to = `${addMonth(slip.month, 1)}-20`;
  const near = moves.filter((m) => m.amount > 0 && m.date >= from && m.date <= to);
  const tol = Math.max(5, slip.net * 0.04);
  const salary = /stipend|salar|lohn|gehalt|paga|emolument|competenz/i;
  const cands = near.map((m) => ({ move: m, diff: r2(m.amount - slip.net) })).filter((x) => Math.abs(x.diff) <= tol);
  if (!cands.length) return null;
  cands.sort((a, b) => (salary.test(b.move.label) ? 1 : 0) - (salary.test(a.move.label) ? 1 : 0) || Math.abs(a.diff) - Math.abs(b.diff));
  return cands[0]!;
}

/** La stima del mese in una frase: quanto ti aspetti sul conto, e quanto è già sicuro. */
export function estimateLine(p: MonthPay): { expected: number; sure: number; text: string } {
  return { expected: p.net, sure: p.confirmedNet, text: p.pending ? `${p.pending} giorni da confermare` : 'Tutto confermato' };
}

// ---------- lettura dei documenti con l'AI (non ci si fida: tutto si controlla e si corregge a mano) ----------
const num = (v: unknown): number | undefined => { const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(/\./g, (m, i, s: string) => (s.indexOf(',') > -1 && i < s.indexOf(',') ? '' : m)).replace(',', '.')) : NaN; return Number.isFinite(n) && n >= 0 ? r2(n) : undefined; };
const txt = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const json = (text: string): Record<string, unknown> | null => { const m = text.match(/\{[\s\S]*\}/); if (!m) return null; try { const j = JSON.parse(m[0]) as unknown; return j && typeof j === 'object' ? (j as Record<string, unknown>) : null; } catch { return null; } };
const timeOf = (v: unknown): string | undefined => { if (typeof v !== 'string') return undefined; const m = v.trim().match(/^(\d{1,2})[:.hH](\d{2})$/); if (!m) return undefined; const t = `${pad(Number(m[1]))}:${m[2]}`; return isTime(t) ? t : undefined; };

export const CONTRACT_PROMPT = 'Questa è la foto o la scansione di un contratto di lavoro. Leggi le condizioni economiche e di orario e rispondi SOLO con un oggetto JSON, senza testo prima o dopo: {"tipo":"ore oppure fisso","paga_oraria_lorda":null,"stipendio_mensile_lordo":null,"ore_settimanali":null,"maggiorazione_straordinario_percento":null,"maggiorazione_notturno_percento":null,"maggiorazione_domenica_percento":null,"maggiorazione_festivo_percento":null,"ferie_giorni_anno":null,"pausa_non_pagata_minuti":null,"valuta":"EUR oppure CHF","inizio":"YYYY-MM-DD","datore":"nome dell\'azienda"}. Metti null per ciò che non trovi: non inventare nulla.';
export function parseContract(text: string): Partial<Contract> | null {
  const j = json(text); if (!j) return null;
  const out: Partial<Contract> = {};
  const kind = txt(j.tipo, 20).toLowerCase(); const hourly = num(j.paga_oraria_lorda); const monthly = num(j.stipendio_mensile_lordo);
  if (hourly && (kind.startsWith('or') || !monthly)) { out.kind = 'hourly'; out.hourly = hourly; } else if (monthly) { out.kind = 'monthly'; out.monthly = monthly; }
  const wk = num(j.ore_settimanali); if (wk && wk > 0 && wk <= 60) out.weekHours = wk;
  for (const [key, to] of [['maggiorazione_straordinario_percento', 'overtimePct'], ['maggiorazione_notturno_percento', 'nightPct'], ['maggiorazione_domenica_percento', 'sundayPct'], ['maggiorazione_festivo_percento', 'holidayPct']] as const) { const v = num(j[key]); if (v != null && v <= 200) out[to] = v; }
  const f = num(j.ferie_giorni_anno); if (f != null && f <= 60) out.vacationDays = f;
  const p = num(j.pausa_non_pagata_minuti); if (p != null && p <= 180) out.pauseMin = Math.round(p);
  const cur = txt(j.valuta, 5).toUpperCase(); if (cur === 'EUR' || cur === 'CHF') out.currency = cur;
  if (validDay(j.inizio)) out.from = j.inizio;
  const e = txt(j.datore, 80); if (e) out.employer = e;
  return Object.keys(out).length ? out : null;
}

export const PAYSLIP_PROMPT = 'Questa è la foto o la scansione di una busta paga (cedolino). Rispondi SOLO con un oggetto JSON, senza testo prima o dopo: {"mese":"YYYY-MM mese di competenza","lordo":0,"netto":0,"ore":null,"valuta":"EUR oppure CHF"}. "lordo" è il totale delle competenze lorde, "netto" è l\'importo netto in busta (netto a pagare). Metti null per ciò che non trovi: non inventare nulla.';
export function parsePayslip(text: string): { month?: string; gross?: number; net?: number; hours?: number; currency?: 'EUR' | 'CHF' } | null {
  const j = json(text); if (!j) return null;
  const month = typeof j.mese === 'string' && validMonth(j.mese.trim()) ? j.mese.trim() : undefined;
  const gross = num(j.lordo); const net = num(j.netto); const hours = num(j.ore);
  const cur = txt(j.valuta, 5).toUpperCase();
  if (!month && !gross && !net) return null;
  return { ...(month ? { month } : {}), ...(gross ? { gross } : {}), ...(net ? { net } : {}), ...(hours && hours < 400 ? { hours } : {}), ...(cur === 'EUR' || cur === 'CHF' ? { currency: cur } : {}) };
}

export const HOURS_PROMPT = 'Questa è la foto di un foglio ore, di un planning o di un turno di lavoro. Leggi TUTTE le righe e rispondi SOLO con un oggetto JSON, senza testo prima o dopo: {"giorni":[{"data":"YYYY-MM-DD","inizio":"HH:MM","fine":"HH:MM","pausa_minuti":null,"ore":null,"tipo":"lavoro oppure ferie oppure malattia oppure festivo oppure riposo"}]}. Se manca l\'anno usa quello indicato qui sotto. Se una riga ha solo le ore totali, metti "ore" e lascia inizio e fine vuoti. Non inventare righe.';
export type ReadDay = { date: string; kind: DayKind; start?: string; end?: string; pause?: number; hours: number };
export function parseHours(text: string, today: string): ReadDay[] {
  const j = json(text); if (!j || !Array.isArray(j.giorni)) return [];
  const out: ReadDay[] = []; const seen = new Set<string>();
  for (const r of j.giorni.slice(0, 62)) {
    const o = (r ?? {}) as Record<string, unknown>;
    let date = typeof o.data === 'string' ? o.data.trim() : '';
    if (/^\d{1,2}[/.-]\d{1,2}$/.test(date)) { const [d, m] = date.split(/[/.-]/).map(Number) as [number, number]; date = `${today.slice(0, 4)}-${pad(m)}-${pad(d)}`; }
    if (!validDay(date) || seen.has(date)) continue;
    const t = txt(o.tipo, 20).toLowerCase();
    const kind: DayKind = t.startsWith('fer') ? 'vacation' : t.startsWith('mal') ? 'sick' : t.startsWith('fes') ? 'holiday' : t.startsWith('ris') ? 'off' : 'work';
    const start = timeOf(o.inizio), end = timeOf(o.fine); const pause = num(o.pausa_minuti); const h = num(o.ore);
    const hours = start && end ? hoursBetween(start, end, pause ?? 0) : h && h <= 24 ? h : 0;
    if (kind === 'work' && !hours) continue;
    seen.add(date); out.push({ date, kind, ...(start && end ? { start, end } : {}), ...(pause != null ? { pause: Math.round(pause) } : {}), hours });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

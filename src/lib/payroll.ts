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

export type OvertimeMode = 'paid' | 'plain' | 'bank' | 'mixed';
export const OVERTIME_MODES: { k: OvertimeMode; n: string; d: string }[] = [
  { k: 'paid', n: 'Pagate con maggiorazione', d: 'Le ore in più si pagano di più (per esempio +25%).' },
  { k: 'plain', n: 'Pagate senza maggiorazione', d: 'Le ore in più si pagano come le altre.' },
  { k: 'bank', n: 'Recuperate con riposo', d: 'Le ore in più vanno in una banca ore e le recuperi con giorni liberi.' },
  { k: 'mixed', n: 'In parte pagate, in parte recuperate', d: 'Fino a una soglia al mese si pagano, il resto va in banca ore.' },
];
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
  /** come si trattano le ore oltre il contratto: pagate con maggiorazione, pagate senza maggiorazione, recuperate con riposo (banca ore), oppure miste */
  overtimeMode: OvertimeMode;
  /** maggiorazione dello straordinario pagato, in % (vale per «pagate con maggiorazione» e per la parte pagata delle miste) */
  overtimePct: number; nightPct: number; sundayPct: number; holidayPct: number;
  /** miste: quante ore al mese si pagano prima di passare al recupero */
  paidUpTo?: number;
  /** recupero: ore di riposo per ogni ora in più (1 = ora per ora; 1,25 = il recupero vale il 25% in più) */
  bankRatio: number;
  /** le ore in banca vanno recuperate entro tanti mesi (vuoto = nessuna scadenza) */
  bankExpiryMonths?: number;
  /** tetto della banca ore, in ore (vuoto = nessun tetto): oltre, ti avviso */
  bankCap?: number;
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
  /** i campi che hanno un valore vero: letto dal contratto (e verificato) o scritto da te. Gli altri restano vuoti e il calcolo usa valori standard. Vuoto/assente = contratto salvato prima di questa regola: si mostra tutto. */
  known?: string[];
  /** per i campi letti dal contratto: la frase copiata dal documento, da controllare */
  found?: Record<string, string>;
};
export const defaultContract = (): Contract => ({ kind: 'hourly', hourly: 0, weekHours: 40, netPct: 85, overtimeMode: 'paid', overtimePct: 25, bankRatio: 1, nightPct: 25, sundayPct: 50, holidayPct: 50, vacationDays: 20, paidLeave: true, pauseMin: 0, currency: 'EUR' });

export type DayKind = 'work' | 'vacation' | 'sick' | 'holiday' | 'recovery' | 'off';
export const DAY_KINDS: { k: DayKind; n: string }[] = [{ k: 'work', n: 'Lavoro' }, { k: 'vacation', n: 'Ferie' }, { k: 'sick', n: 'Malattia' }, { k: 'holiday', n: 'Festivo non lavorato' }, { k: 'recovery', n: 'Recupero ore (dalla banca)' }, { k: 'off', n: 'Riposo' }];
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
  if (d.kind === 'off' || d.kind === 'recovery') return 0; // il recupero non conta tra le ore lavorate: scala la banca ore
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
export type DayPay = { date: string; hours: number; base: number; extra: number; gross: number; net: number; value: number; valueNet: number; /** ore guadagnate in banca ore quel giorno (già con il rapporto di recupero) */ bankHours: number; confirmed: boolean; kind: DayKind };
export type MonthPay = {
  month: string; days: DayPay[];
  hours: number; confirmedHours: number; overtimeHours: number;
  /** ore in più pagate e ore che vanno in banca ore questo mese (già con il rapporto di recupero) */
  paidOvertimeHours: number; bankHours: number;
  /** lordo di ciò che hai confermato / di tutto il mese (compresi i giorni solo previsti) */
  confirmedGross: number; gross: number;
  /** netto «da contratto», poi calibrato con le buste paga */
  confirmedNet: number; net: number;
  ratio: number; ratioFrom: 'contratto' | 'buste paga';
  /** per il contratto fisso: la parte fissa */
  fixed: number; pending: number;
};

const contractDay = (c: Contract): number => r2(Math.max(0, c.weekHours) / 5);
/** Il lordo di un giorno senza lo straordinario (che si calcola sulla settimana): base + maggiorazioni notte/domenica/festivo. Un giorno di recupero si paga come una giornata di contratto (le ore sono già state lavorate). */
function dayBase(d: Day, c: Contract): { hours: number; base: number; extra: number } {
  const rate = hourlyRate(c);
  if (d.kind === 'recovery') return { hours: 0, base: c.kind === 'hourly' ? r2(contractDay(c) * rate) : 0, extra: 0 };
  const h = dayHours(d, c);
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

/** Le ore in più di un giorno e dove vanno: `pay` si pagano, `bank` vanno in banca ore (secondo la regola del contratto). Si contano sulla settimana intera. */
export type Split = { ot: number; pay: number; bank: number };
export function overtimeSplit(month: string, all: Day[], c: Contract): Map<string, Split> {
  const out = new Map<string, Split>();
  const days = all.filter((d) => monthOf(d.date) === month && d.kind === 'work').sort((a, b) => a.date.localeCompare(b.date));
  let paidSoFar = 0;
  for (const d of days) {
    const h = dayHours(d, c);
    const before = all.filter((x) => weekStart(x.date) === weekStart(d.date) && x.date < d.date).reduce((t, x) => t + dayHours(x, c), 0);
    const ot = r2(Math.max(0, Math.min(h, before + h - Math.max(0, c.weekHours)))); if (!ot) continue;
    let pay = ot, bank = 0;
    if (c.overtimeMode === 'bank') { pay = 0; bank = ot; }
    else if (c.overtimeMode === 'mixed') { pay = r2(Math.min(ot, Math.max(0, (c.paidUpTo ?? 0) - paidSoFar))); bank = r2(ot - pay); paidSoFar += pay; }
    out.set(d.date, { ot, pay, bank });
  }
  return out;
}

const addMonthsISO = (day: string, n: number): string => { const m = addMonth(day.slice(0, 7), n); const last = daysOfMonth(m).length; return `${m}-${pad(Math.min(Number(day.slice(8)), last))}`; };

/** La banca ore: ore guadagnate (con il rapporto di recupero) meno i giorni di recupero presi. Le ore scadono dopo `bankExpiryMonths` mesi (si consumano le più vecchie per prime).
 *  Il saldo può andare sotto zero: vuol dire che hai preso più recupero di quanto avevi maturato. */
export type BankLedger = { on: boolean; balance: number; accrued: number; recovered: number; expired: number; debt: number; nextExpiry: { date: string; hours: number } | null; overCap: number; recoveryDays: number };
export function bankLedger(all: Day[], c: Contract, today: string, includePlanned = false): BankLedger {
  const on = c.overtimeMode === 'bank' || c.overtimeMode === 'mixed';
  const zero: BankLedger = { on, balance: 0, accrued: 0, recovered: 0, expired: 0, debt: 0, nextExpiry: null, overCap: 0, recoveryDays: 0 };
  const pool = all.filter((d) => includePlanned || d.confirmed);
  if (!on && !pool.some((d) => d.kind === 'recovery')) return zero;
  const events: { date: string; kind: 'acc' | 'rec'; h: number }[] = [];
  const months = [...new Set(pool.filter((d) => d.kind === 'work').map((d) => monthOf(d.date)))].sort();
  if (on) for (const m of months) for (const [date, sp] of overtimeSplit(m, pool, c)) if (sp.bank > 0) events.push({ date, kind: 'acc', h: r2(sp.bank * (c.bankRatio || 1)) });
  const rec = contractDay(c);
  for (const d of pool) if (d.kind === 'recovery') events.push({ date: d.date, kind: 'rec', h: rec });
  events.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'acc' ? -1 : 1));
  const exp = c.bankExpiryMonths && c.bankExpiryMonths > 0 ? c.bankExpiryMonths : 0;
  const lots: { date: string; left: number; until: string | null }[] = [];
  let accrued = 0, recovered = 0, expired = 0, debt = 0, recoveryDays = 0;
  const lapse = (now: string) => { for (const l of lots) if (l.left > 0 && l.until && l.until < now) { expired += l.left; l.left = 0; } };
  for (const e of events) {
    lapse(e.date);
    if (e.kind === 'acc') { accrued += e.h; lots.push({ date: e.date, left: e.h, until: exp ? addMonthsISO(e.date, exp) : null }); continue; }
    recoveryDays++; recovered += e.h; let need = e.h;
    for (const l of lots) { if (need <= 0) break; const t = Math.min(l.left, need); l.left -= t; need -= t; }
    debt += need;
  }
  lapse(today);
  const alive = lots.filter((l) => l.left > 0);
  const left = alive.reduce((t, l) => t + l.left, 0);
  const next = alive.filter((l) => l.until).sort((a, b) => (a.until as string).localeCompare(b.until as string))[0];
  const balance = r2(left - debt);
  return { on, balance, accrued: r2(accrued), recovered: r2(recovered), expired: r2(expired), debt: r2(debt), nextExpiry: next ? { date: next.until as string, hours: r2(next.left) } : null, overCap: c.bankCap && balance > c.bankCap ? r2(balance - c.bankCap) : 0, recoveryDays };
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
  const split = overtimeSplit(month, all, c);
  const rate = hourlyRate(c); const pct = c.overtimeMode === 'plain' ? 0 : c.overtimePct;
  const days: DayPay[] = [];
  let overtimeHours = 0, paidOt = 0, bankHours = 0;
  for (const d of inMonth) {
    const b = dayBase(d, c); const sp = split.get(d.date) ?? { ot: 0, pay: 0, bank: 0 };
    let base = b.base; let extra = b.extra;
    // le ore che vanno in banca non si pagano adesso (si recuperano con riposo); quelle pagate si maggiorano
    if (c.kind === 'hourly') { base = r2(base - sp.bank * rate); extra += sp.pay * rate * (pct / 100); }
    else extra += sp.pay * rate * (1 + pct / 100);
    overtimeHours += sp.ot; paidOt += sp.pay; const bh = r2(sp.bank * (c.bankRatio || 1)); bankHours += bh;
    const gross = r2(base + extra);
    const value = c.kind === 'hourly' ? gross : r2(b.hours * rate + extra);
    days.push({ date: d.date, hours: b.hours, base, extra: r2(extra), gross, net: r2(gross * ratio), value, valueNet: r2(value * ratio), bankHours: bh, confirmed: d.confirmed, kind: d.kind });
  }
  const fixed = c.kind === 'monthly' ? Math.max(0, c.monthly ?? 0) : 0;
  const sum = (f: (d: DayPay) => number, only?: boolean) => days.filter((d) => only === undefined || d.confirmed === only).reduce((s, d) => s + f(d), 0);
  const confirmedGross = r2(sum((d) => d.gross, true) + fixed); const gross = r2(sum((d) => d.gross) + fixed);
  return {
    month, days, hours: r2(sum((d) => d.hours)), confirmedHours: r2(sum((d) => d.hours, true)), overtimeHours: r2(overtimeHours), paidOvertimeHours: r2(paidOt), bankHours: r2(bankHours),
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

export const CONTRACT_PROMPT = 'Questa è la foto, la scansione o il PDF di un contratto di lavoro. Estrai SOLO ciò che è scritto in modo esplicito. Per ogni campo rispondi con {"valore":…,"citazione":"la frase ESATTA copiata dal contratto che contiene il dato"} oppure con null se il contratto non lo dice chiaramente. Non dedurre, non calcolare, non usare valori tipici, non prendere i dati da altri contratti o da esempi: se hai un dubbio, null. Distingui lordo e netto (usa solo il LORDO), orario e mensile, settimanale e annuale. Rispondi SOLO con un oggetto JSON senza testo prima o dopo, con queste chiavi: "paga_oraria_lorda" (euro o franchi lordi all\'ora), "stipendio_mensile_lordo" (lordo al mese), "stipendio_annuo_lordo" (RAL, lordo all\'anno) e "mensilita" (quante mensilità l\'anno, es. 13), "ore_settimanali", "maggiorazione_straordinario_percento", "maggiorazione_notturno_percento", "maggiorazione_domenica_percento", "maggiorazione_festivo_percento", "straordinari" (valore: "pagati", "recuperati" o "misti"), "ferie_giorni_anno", "pausa_non_pagata_minuti", "valuta" (valore: "EUR" o "CHF"), "inizio" (valore: data YYYY-MM-DD), "datore" (nome dell\'azienda).';

type Cite = { value: unknown; quote: string };
const cite = (v: unknown): Cite | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>; const quote = txt(o.citazione, 400);
  return o.valore == null || !quote ? null : { value: o.valore, quote };
};
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
/** Il numero c'è davvero nella frase citata? (12,50 = 12.50 = 12,5). Se no, il dato non è sul documento e non lo uso. */
const inQuote = (n: number, quote: string): boolean => (quote.match(/\d+(?:[.,]\d+)*/g) ?? []).some((m) => [num(m), /^\d{1,3}(\.\d{3})+$/.test(m) ? Number(m.replace(/\./g, '')) : undefined].some((x) => x != null && Math.abs(x - n) < 0.006));
const numCited = (v: unknown): { n: number; quote: string } | null => { const c = cite(v); if (!c) return null; const n = num(c.value); return n != null && inQuote(n, c.quote) ? { n, quote: c.quote } : null; };

/** Legge la risposta dell'AI senza fidarsi: ogni dato deve avere la frase del contratto che lo contiene e il numero deve comparire in quella frase. Quello che non torna resta vuoto. */
export function parseContract(text: string): Partial<Contract> | null {
  const j = json(text); if (!j) return null;
  const out: Partial<Contract> = {}; const found: Record<string, string> = {};
  const take = (k: string, quote: string) => { found[k] = quote; };
  const hourly = numCited(j.paga_oraria_lorda); let monthly = numCited(j.stipendio_mensile_lordo);
  if (!monthly) { const ann = numCited(j.stipendio_annuo_lordo); const m = numCited(j.mensilita); if (ann && m && m.n >= 12 && m.n <= 16 && Number.isInteger(m.n)) monthly = { n: Math.round((ann.n / m.n) * 100) / 100, quote: `${ann.quote} · ${m.quote}` }; }
  if (hourly && hourly.n > 0 && hourly.n < 500) { out.kind = 'hourly'; out.hourly = hourly.n; take('hourly', hourly.quote); }
  else if (monthly && monthly.n > 0 && monthly.n < 100000) { out.kind = 'monthly'; out.monthly = monthly.n; take('monthly', monthly.quote); }
  const wk = numCited(j.ore_settimanali); if (wk && wk.n > 0 && wk.n <= 60) { out.weekHours = wk.n; take('weekHours', wk.quote); }
  for (const [key, to] of [['maggiorazione_straordinario_percento', 'overtimePct'], ['maggiorazione_notturno_percento', 'nightPct'], ['maggiorazione_domenica_percento', 'sundayPct'], ['maggiorazione_festivo_percento', 'holidayPct']] as const) {
    const v = numCited(j[key]); if (v && v.n >= 0 && v.n <= 200) { out[to] = v.n; take(to, v.quote); }
  }
  const so = cite(j.straordinari); if (so) { const m = txt(so.value, 20).toLowerCase(); const mode = m.startsWith('pag') ? 'paid' : m.startsWith('rec') ? 'bank' : m.startsWith('mis') ? 'mixed' : null; if (mode) { out.overtimeMode = mode; take('overtimeMode', so.quote); } }
  const f = numCited(j.ferie_giorni_anno); if (f && f.n > 0 && f.n <= 60) { out.vacationDays = f.n; take('vacationDays', f.quote); }
  const p = numCited(j.pausa_non_pagata_minuti); if (p && p.n >= 0 && p.n <= 180) { out.pauseMin = Math.round(p.n); take('pauseMin', p.quote); }
  const cur = cite(j.valuta); if (cur) { const v = txt(cur.value, 5).toUpperCase(); if ((v === 'EUR' || v === 'CHF') && (v === 'EUR' ? /€|eur/i : /chf|fr\.|franch/i).test(cur.quote)) { out.currency = v; take('currency', cur.quote); } }
  const st = cite(j.inizio); if (st && validDay(st.value) && /\d/.test(st.quote)) { out.from = st.value as string; take('from', st.quote); }
  const em = cite(j.datore); if (em) { const name = txt(em.value, 80); if (name && norm(em.quote).includes(norm(name))) { out.employer = name; take('employer', em.quote); } }
  if (!Object.keys(found).length) return null;
  return { ...out, found, known: Object.keys(found) };
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

export const HOURS_PROMPT = 'Questa è la foto di un foglio ore, di un planning o di un turno di lavoro. Leggi TUTTE le righe e rispondi SOLO con un oggetto JSON, senza testo prima o dopo: {"giorni":[{"data":"YYYY-MM-DD","inizio":"HH:MM","fine":"HH:MM","pausa_minuti":null,"ore":null,"tipo":"lavoro oppure ferie oppure malattia oppure festivo oppure recupero oppure riposo"}]}. Se manca l\'anno usa quello indicato qui sotto. Se una riga ha solo le ore totali, metti "ore" e lascia inizio e fine vuoti. Non inventare righe.';
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
    const kind: DayKind = t.startsWith('fer') ? 'vacation' : t.startsWith('mal') ? 'sick' : t.startsWith('fes') ? 'holiday' : t.startsWith('rec') ? 'recovery' : t.startsWith('ris') ? 'off' : 'work';
    const start = timeOf(o.inizio), end = timeOf(o.fine); const pause = num(o.pausa_minuti); const h = num(o.ore);
    const hours = start && end ? hoursBetween(start, end, pause ?? 0) : h && h <= 24 ? h : 0;
    if (kind === 'work' && !hours) continue;
    seen.add(date); out.push({ date, kind, ...(start && end ? { start, end } : {}), ...(pause != null ? { pause: Math.round(pause) } : {}), hours });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { bankLedger, overtimeSplit, defaultContract, hoursBetween, nightHours, hourlyRate, dayHours, monthPay, netRatio, planFromShifts, balance, matchBank, parseContract, parsePayslip, parseHours, weekStart, weekdayOf, daysOfMonth, addMonth } from '../src/lib/payroll.ts';

const C = (x = {}) => ({ ...defaultContract(), kind: 'hourly', hourly: 10, weekHours: 40, netPct: 80, ...x });
const D = (date, start, end, extra = {}) => ({ date, kind: 'work', start, end, pause: 0, hours: 0, confirmed: true, source: 'manuale', ...extra });

test('date e settimane', () => {
  assert.equal(weekdayOf('2026-11-02'), 0); assert.equal(weekdayOf('2026-11-08'), 6);
  assert.equal(weekStart('2026-11-05'), '2026-11-02'); assert.equal(daysOfMonth('2026-02').length, 28); assert.equal(addMonth('2026-12', 1), '2027-01');
});
test('ore tra due orari: anche oltre la mezzanotte, con la pausa', () => {
  assert.equal(hoursBetween('09:00', '17:00'), 8); assert.equal(hoursBetween('09:00', '17:30', 30), 8); assert.equal(hoursBetween('22:00', '06:00'), 8);
  assert.equal(hoursBetween('xx', '17:00'), 0); assert.equal(nightHours('22:00', '06:00'), 8); assert.equal(nightHours('09:00', '17:00'), 0); assert.equal(nightHours('20:00', '23:00'), 1);
});
test('paga oraria e fissa', () => {
  assert.equal(hourlyRate(C()), 10); assert.equal(hourlyRate(C({ kind: 'monthly', monthly: 2080 })), 12);
});
test('giorno semplice: lordo e netto da contratto', () => {
  const p = monthPay('2026-11', [D('2026-11-02', '09:00', '17:00')], C());
  assert.equal(p.gross, 80); assert.equal(p.net, 64); assert.equal(p.days[0].net, 64); assert.equal(p.ratioFrom, 'contratto');
});
test('i giorni non confermati sono previsione: contano nel totale ma non nel sicuro', () => {
  const p = monthPay('2026-11', [D('2026-11-02', '09:00', '17:00'), D('2026-11-03', '09:00', '17:00', { confirmed: false })], C());
  assert.equal(p.gross, 160); assert.equal(p.confirmedGross, 80); assert.equal(p.pending, 1);
});
test('notte, domenica e festivo maggiorano', () => {
  assert.equal(monthPay('2026-11', [D('2026-11-02', '22:00', '06:00')], C()).gross, 100); // 80 + 8h notte * 10 * 25%
  assert.equal(monthPay('2026-11', [D('2026-11-08', '09:00', '17:00')], C()).gross, 120); // domenica +50%
  assert.equal(monthPay('2026-11', [D('2026-11-03', '09:00', '17:00', { holiday: true })], C()).gross, 120);
});
test('straordinari: le ore oltre il contratto nella settimana, +25%', () => {
  const days = ['02', '03', '04', '05', '06'].map((d) => D(`2026-11-${d}`, '09:00', '18:00'));
  const p = monthPay('2026-11', days, C());
  assert.equal(p.overtimeHours, 5); assert.equal(p.hours, 45); assert.equal(p.gross, 462.5);
});
test('contratto fisso: la parte fissa più gli straordinari', () => {
  const c = C({ kind: 'monthly', monthly: 2080, hourly: undefined });
  assert.equal(monthPay('2026-11', [], c).gross, 2080);
  const days = ['02', '03', '04', '05', '06'].map((d) => D(`2026-11-${d}`, '09:00', '18:00'));
  const p = monthPay('2026-11', days, c); // 5 ore extra pagate 12 €/h con +25%
  assert.equal(p.overtimeHours, 5); assert.equal(p.gross, 2080 + 5 * 12 * 1.25);
});
test('ferie e malattia contano come giornata di contratto se pagate', () => {
  const v = { date: '2026-11-02', kind: 'vacation', hours: 0, confirmed: true, source: 'manuale' };
  assert.equal(dayHours(v, C()), 8); assert.equal(dayHours(v, C({ paidLeave: false })), 0); assert.equal(monthPay('2026-11', [v], C()).gross, 80);
});
test('il netto si affina con le buste paga (le ultime pesano di più)', () => {
  const slip = (m, g, n) => ({ id: m, month: m, gross: g, net: n, pages: [], source: 'manuale', createdAt: '2026-01-01' });
  assert.equal(netRatio(C(), []).ratio, 0.8);
  const one = netRatio(C(), [slip('2026-09', 1000, 750)]); assert.equal(one.from, 'buste paga'); assert.ok(one.ratio > 0.75 && one.ratio < 0.8);
  const three = netRatio(C(), [slip('2026-07', 1000, 750), slip('2026-08', 1000, 750), slip('2026-09', 1000, 750)]); assert.equal(three.ratio, 0.75);
  assert.equal(netRatio(C(), [slip('2026-09', 1000, 1200)]).from, 'contratto'); // busta incoerente: ignorata
  const p = monthPay('2026-11', [D('2026-11-02', '09:00', '17:00')], C(), [slip('2026-07', 1000, 750), slip('2026-08', 1000, 750), slip('2026-09', 1000, 750)]);
  assert.equal(p.net, 60);
});
test('dai turni: giorni previsti da confermare, senza toccare quelli già scritti', () => {
  const shifts = [{ name: 'Mattina', start: '06:00', end: '14:00', weekdays: [0, 1], dates: [] }];
  const out = planFromShifts(shifts, '2026-11', { '2026-11-02': D('2026-11-02', '08:00', '12:00') }, C({ pauseMin: 30 }));
  assert.ok(out.length >= 7); assert.ok(!out.some((d) => d.date === '2026-11-02')); assert.equal(out[0].date, '2026-11-03');
  assert.equal(out[0].confirmed, false); assert.equal(out[0].hours, 7.5); assert.equal(out[0].shiftName, 'Mattina');
});
test('ferie maturate, godute e ore in più', () => {
  const days = [{ date: '2026-03-02', kind: 'vacation', hours: 0, confirmed: true, source: 'manuale' }, { date: '2026-03-03', kind: 'vacation', hours: 0, confirmed: true, source: 'manuale' }, ...['02', '03', '04', '05', '06'].map((d) => D(`2026-11-${d}`, '09:00', '18:00'))];
  const b = balance(days, C({ vacationDays: 24 }), '2026-06-15');
  assert.equal(b.vacationTotal, 24); assert.equal(b.vacationAccrued, 12); assert.equal(b.vacationTaken, 2); assert.equal(b.vacationLeft, 22); assert.equal(b.vacationLeftAccrued, 10); assert.equal(b.overtimeHours, 5);
});
test('confronto con il conto: trova l\'accredito vicino al netto', () => {
  const moves = [{ date: '2026-11-03', label: 'Spesa', amount: -40 }, { date: '2026-11-05', label: 'ACCREDITO STIPENDIO ACME', amount: 1503 }, { date: '2026-11-06', label: 'Rimborso', amount: 1500 }];
  const m = matchBank(moves, { month: '2026-10', net: 1500 }); assert.equal(m.move.label, 'ACCREDITO STIPENDIO ACME'); assert.equal(m.diff, 3);
  assert.equal(matchBank(moves, { month: '2026-10', net: 900 }), null); assert.equal(matchBank(moves, { month: '2026-10', net: 0 }), null);
});
const Q = (valore, citazione) => ({ valore, citazione });
test('lettura contratto: ogni dato ha la sua frase e il numero deve esserci; il resto resta vuoto', () => {
  const r = parseContract('ecco ' + JSON.stringify({ paga_oraria_lorda: Q('12,50', 'La retribuzione è di CHF 12,50 lordi all\'ora'), ore_settimanali: Q(38, 'orario di 38 ore settimanali'), maggiorazione_notturno_percento: Q(30, 'lavoro notturno +30%'), ferie_giorni_anno: Q(22, '22 giorni di ferie'), valuta: Q('CHF', 'CHF 12,50'), inizio: Q('2026-02-01', 'dal 1 febbraio 2026'), datore: Q('Acme SA', 'tra Acme SA e il dipendente') }));
  assert.equal(r.kind, 'hourly'); assert.equal(r.hourly, 12.5); assert.equal(r.weekHours, 38); assert.equal(r.nightPct, 30); assert.equal(r.vacationDays, 22); assert.equal(r.currency, 'CHF'); assert.equal(r.from, '2026-02-01'); assert.equal(r.employer, 'Acme SA');
  assert.equal(r.sundayPct, undefined); assert.equal(r.overtimePct, undefined); assert.ok(r.known.includes('hourly') && !r.known.includes('sundayPct')); assert.match(r.found.hourly, /12,50/);
  assert.equal(parseContract('{"stipendio_mensile_lordo":' + JSON.stringify(Q('2.450,00', 'stipendio lordo mensile di euro 2.450,00')) + '}').monthly, 2450);
  assert.equal(parseContract('niente json'), null); assert.equal(parseContract('{"ore_settimanali":200}'), null);
});
test('lettura contratto: senza frase, o con un numero che nella frase non c\'è, il dato viene scartato', () => {
  assert.equal(parseContract('{"paga_oraria_lorda":10}'), null);
  assert.equal(parseContract('{"paga_oraria_lorda":' + JSON.stringify(Q(10, 'paga oraria da definire')) + '}'), null);
  const r = parseContract(JSON.stringify({ paga_oraria_lorda: Q(9, '9 euro l\'ora'), ore_settimanali: Q(40, 'orario da concordare'), valuta: Q('CHF', 'euro') }));
  assert.equal(r.hourly, 9); assert.equal(r.weekHours, undefined); assert.equal(r.currency, undefined);
});
test('lettura contratto: la RAL si divide per le mensilità solo se ci sono entrambe', () => {
  const ok = parseContract(JSON.stringify({ stipendio_annuo_lordo: Q(26000, 'RAL euro 26.000'), mensilita: Q(13, 'tredici mensilità (13)') }));
  assert.equal(ok.monthly, 2000);
  assert.equal(parseContract(JSON.stringify({ stipendio_annuo_lordo: Q(26000, 'RAL euro 26.000') })), null);
});
test('lettura busta paga', () => {
  const r = parsePayslip('{"mese":"2026-10","lordo":"2.000,00","netto":1580.5,"ore":160}');
  assert.equal(r.month, '2026-10'); assert.equal(r.gross, 2000); assert.equal(r.net, 1580.5); assert.equal(r.hours, 160);
  assert.equal(parsePayslip('{"mese":"ottobre"}'), null); assert.equal(parsePayslip('boh'), null);
});
test('lettura del foglio ore: orari, ferie, giorni senza anno, righe vuote scartate', () => {
  const r = parseHours('{"giorni":[{"data":"2026-11-02","inizio":"9:00","fine":"17:30","pausa_minuti":30},{"data":"03/11","ore":6},{"data":"2026-11-04","tipo":"ferie"},{"data":"2026-11-05","tipo":"lavoro"},{"data":"2026-11-02","ore":3},{"data":"2026-13-40","ore":3}]}', '2026-11-13');
  assert.deepEqual(r.map((x) => [x.date, x.kind, x.hours]), [['2026-11-02', 'work', 8], ['2026-11-03', 'work', 6], ['2026-11-04', 'vacation', 0]]);
  assert.equal(r[0].start, '09:00'); assert.deepEqual(parseHours('x', '2026-11-13'), []);
});

const week = (from, n = 5, start = '09:00', end = '18:00') => Array.from({ length: n }, (_, i) => D(`2026-11-${String(from + i).padStart(2, '0')}`, start, end));
test('regola «pagate senza maggiorazione»: le ore in più valgono come le altre', () => {
  const p = monthPay('2026-11', week(2), C({ overtimeMode: 'plain' }));
  assert.equal(p.gross, 450); assert.equal(p.overtimeHours, 5); assert.equal(p.paidOvertimeHours, 5); assert.equal(p.bankHours, 0);
});
test('regola «recuperate»: le ore in più non si pagano e vanno in banca ore', () => {
  const p = monthPay('2026-11', week(2), C({ overtimeMode: 'bank' }));
  assert.equal(p.gross, 400); assert.equal(p.bankHours, 5); assert.equal(p.paidOvertimeHours, 0); assert.equal(p.days.at(-1).bankHours, 5);
  assert.equal(monthPay('2026-11', week(2), C({ overtimeMode: 'bank', bankRatio: 1.25 })).bankHours, 6.25);
});
test('regola mista: fino alla soglia si pagano (con maggiorazione), il resto va in banca', () => {
  const p = monthPay('2026-11', week(2), C({ overtimeMode: 'mixed', paidUpTo: 2 }));
  assert.equal(p.paidOvertimeHours, 2); assert.equal(p.bankHours, 3); assert.equal(p.gross, 425);
  assert.equal(overtimeSplit('2026-11', week(2), C({ overtimeMode: 'mixed', paidUpTo: 2 })).get('2026-11-06').bank, 3);
});
test('contratto fisso con recupero: niente extra, solo ore in banca', () => {
  const c = C({ kind: 'monthly', monthly: 2080, hourly: undefined, overtimeMode: 'bank' });
  const p = monthPay('2026-11', week(2), c); assert.equal(p.gross, 2080); assert.equal(p.bankHours, 5);
});
test('banca ore: giorni di recupero scalano il saldo; il recupero non conta come ore lavorate', () => {
  const days = [...week(2), ...week(9), { date: '2026-11-20', kind: 'recovery', hours: 0, confirmed: true, source: 'manuale' }];
  const b = bankLedger(days, C({ overtimeMode: 'bank' }), '2026-11-25');
  assert.equal(b.accrued, 10); assert.equal(b.recovered, 8); assert.equal(b.balance, 2); assert.equal(b.debt, 0); assert.equal(b.recoveryDays, 1);
  const p = monthPay('2026-11', [...week(2, 4), { date: '2026-11-06', kind: 'recovery', hours: 0, confirmed: true, source: 'manuale' }], C({ overtimeMode: 'bank' }));
  assert.equal(p.gross, 4 * 90 + 80); // 4 giorni da 9 h (36 h, sotto le 40) + il recupero pagato come una giornata di contratto
});
test('banca ore: recupero preso prima di averlo maturato = saldo negativo (sei sotto di ore)', () => {
  const days = [...week(2), { date: '2026-11-13', kind: 'recovery', hours: 0, confirmed: true, source: 'manuale' }];
  const b = bankLedger(days, C({ overtimeMode: 'bank' }), '2026-11-20');
  assert.equal(b.balance, -3); assert.equal(b.debt, 3);
});
test('banca ore: le ore scadono, le più vecchie per prime; non confermate solo con includePlanned', () => {
  const days = [...week(2), ...week(9)];
  const b = bankLedger(days, C({ overtimeMode: 'bank', bankExpiryMonths: 1 }), '2026-12-10');
  assert.equal(b.expired, 5); assert.equal(b.balance, 5); assert.deepEqual(b.nextExpiry, { date: '2026-12-13', hours: 5 });
  const plan = week(2).map((d) => ({ ...d, confirmed: false }));
  assert.equal(bankLedger(plan, C({ overtimeMode: 'bank' }), '2026-11-20').balance, 0); assert.equal(bankLedger(plan, C({ overtimeMode: 'bank' }), '2026-11-20', true).balance, 5);
  assert.equal(bankLedger(days, C({ overtimeMode: 'bank', bankCap: 8 }), '2026-11-25').overCap, 2);
  assert.equal(bankLedger(days, C({ overtimeMode: 'paid' }), '2026-11-25').balance, 0);
});
test('lettura contratto: regola degli straordinari; foglio ore: recupero', () => {
  const w = (so, q) => JSON.stringify({ paga_oraria_lorda: Q(10, '10 euro all\'ora'), straordinari: Q(so, q) });
  assert.equal(parseContract(w('recuperati', 'le ore in più si recuperano con riposo')).overtimeMode, 'bank');
  assert.equal(parseContract(w('pagati', 'le ore in più sono pagate')).overtimeMode, 'paid');
  assert.equal(parseHours('{"giorni":[{"data":"2026-11-04","tipo":"recupero"}]}', '2026-11-13')[0].kind, 'recovery');
});

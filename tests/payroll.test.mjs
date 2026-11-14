import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultContract, hoursBetween, nightHours, hourlyRate, dayHours, monthPay, netRatio, planFromShifts, balance, matchBank, parseContract, parsePayslip, parseHours, weekStart, weekdayOf, daysOfMonth, addMonth } from '../src/lib/payroll.ts';

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
test('lettura contratto: tipo, paga, maggiorazioni; non si fida', () => {
  const r = parseContract('ecco {"tipo":"ore","paga_oraria_lorda":"12,50","ore_settimanali":38,"maggiorazione_notturno_percento":30,"ferie_giorni_anno":22,"valuta":"chf","inizio":"2026-02-01","datore":"Acme SA"}');
  assert.equal(r.kind, 'hourly'); assert.equal(r.hourly, 12.5); assert.equal(r.weekHours, 38); assert.equal(r.nightPct, 30); assert.equal(r.vacationDays, 22); assert.equal(r.currency, 'CHF'); assert.equal(r.from, '2026-02-01'); assert.equal(r.employer, 'Acme SA');
  assert.equal(parseContract('{"tipo":"fisso","stipendio_mensile_lordo":"2.450,00"}').monthly, 2450);
  assert.equal(parseContract('niente json'), null); assert.equal(parseContract('{"ore_settimanali":200}'), null);
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

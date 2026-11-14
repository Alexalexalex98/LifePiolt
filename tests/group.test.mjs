import test from 'node:test';
import assert from 'node:assert/strict';
import { shiftHours, clashes, absenceCovers, planned, targetHours, balanceOf, flagsOf, vacationLeft, groupError, monthRows, digestOf, monthPdfHtml, monthName, overviewOf, windowEnd, r1, prevMonth, weekStart, daysOfMonth } from '../src/lib/group.ts';

const S = (id, day, start_t, end_t, extra = {}) => ({ id, team_id: 't', user_id: 'u', day, start_t, end_t, label: 'Turno', status: 'confirmed', removal: false, ...extra });

test('ore di un turno, anche oltre la mezzanotte', () => { assert.equal(shiftHours(S('a', '2026-12-07', '09:00', '17:30')), 8.5); assert.equal(shiftHours(S('a', '2026-12-07', '22:00', '06:00')), 8); assert.equal(shiftHours({ start_t: 'x', end_t: '10:00' }), 0); });
test('sovrapposizioni: stesso giorno, oltre la mezzanotte, giorni vicini, rifiutati ignorati', () => {
  const l = [S('a', '2026-12-07', '09:00', '17:00'), S('n', '2026-12-09', '22:00', '06:00'), S('x', '2026-12-12', '09:00', '17:00', { status: 'declined' })];
  assert.equal(clashes(l, '2026-12-07', '16:00', '20:00'), true); assert.equal(clashes(l, '2026-12-07', '17:00', '20:00'), false);
  assert.equal(clashes(l, '2026-12-10', '01:00', '05:00'), true, 'il turno di notte del 9 finisce alle 6 del 10');
  assert.equal(clashes(l, '2026-12-10', '06:00', '09:00'), false);
  assert.equal(clashes(l, '2026-12-12', '10:00', '12:00'), false);
  assert.equal(clashes(l, '2026-12-07', '09:00', '17:00', 'a'), false, 'il turno stesso non conta');
});
test('assenze approvate bloccano il giorno', () => { assert.equal(absenceCovers([{ from_day: '2026-12-07', to_day: '2026-12-09', status: 'approved' }], '2026-12-08'), true); assert.equal(absenceCovers([{ from_day: '2026-12-07', to_day: '2026-12-09', status: 'requested' }], '2026-12-08'), false); });
test('ore pianificate contro contratto', () => {
  const l = [S('a', '2026-12-07', '09:00', '17:00'), S('b', '2026-12-08', '09:00', '17:00'), S('c', '2026-12-09', '09:00', '13:00', { status: 'proposed' })];
  assert.equal(planned(l, '2026-12-07', '2026-12-13'), 16); assert.equal(targetHours(40, '2026-12-07', '2026-12-13'), 40); assert.equal(balanceOf(16, 40), -24);
});
const P = (x = {}) => ({ user_id: 'u', name: 'Ann', role: 'member', weekly_hours: 40, vacation_days: 20, overtime_mode: 'paid', planned: 40, target: 40, pending_shifts: 0, vacation_taken: 5, cover: false, month_confirmed: true, ...x });
test('cosa guarda il datore: sotto/sopra di ore, turni da confermare, mese, uscita', () => {
  assert.deepEqual(flagsOf(P(), '2026-12-01'), []);
  assert.deepEqual(flagsOf(P({ planned: 30 }), '2026-12-01').map((f) => f.kind), ['under']);
  assert.deepEqual(flagsOf(P({ planned: 46, pending_shifts: 2, month_confirmed: false, ends_on: '2026-12-20' }), '2026-12-01').map((f) => f.kind), ['leaving', 'pending', 'over', 'month']);
  assert.equal(vacationLeft(P()), 15); assert.equal(vacationLeft(P({ vacation_taken: 30 })), 0);
});
test('errori del server in italiano', () => { assert.match(groupError(new Error('sovrapposto')), /sovrappone/); assert.match(groupError({ message: 'gia_coperto' }), /già preso/); assert.match(groupError('boh'), /connessione/); });
test('PDF mensile: righe, totale, impronta stabile e nessun importo', () => {
  const l = [S('b', '2026-11-03', '09:00', '13:00'), S('a', '2026-11-02', '09:00', '17:00'), S('c', '2026-12-01', '09:00', '10:00'), S('d', '2026-11-04', '09:00', '10:00', { status: 'proposed' })];
  const rows = monthRows(l, '2026-11'); assert.deepEqual(rows.map((r) => r.day), ['2026-11-02', '2026-11-03']);
  const d1 = digestOf(rows, '2026-11', 'Ann'); assert.equal(d1, digestOf(rows, '2026-11', 'Ann')); assert.notEqual(d1, digestOf(rows.slice(1), '2026-11', 'Ann'));
  const html = monthPdfHtml({ group: 'Bar <Sole>', person: 'Ann', month: '2026-11', rows, digest: d1, confirmedAt: '30/11/2026' });
  assert.match(html, /novembre 2026/); assert.match(html, /Totale ore: 12/); assert.match(html, new RegExp(d1)); assert.match(html, /Bar &lt;Sole&gt;/); assert.doesNotMatch(html, /€|lordo|netto|paga/i);
  assert.equal(monthName('2026-02'), 'febbraio 2026'); assert.equal(prevMonth('2026-01-15'), '2025-12'); assert.equal(weekStart('2026-12-09'), '2026-12-07'); assert.equal(daysOfMonth('2026-02').length, 28);
});

test('panoramica del datore dai dati letti: ore, saldo, ferie godute, disponibilità; nessun importo', () => {
  const members = [{ user_id: 'a', name: 'Zoe', role: 'member' }, { user_id: 'b', name: 'Ann', role: 'member' }];
  const shifts = [S('1', '2026-12-07', '09:00', '17:00', { user_id: 'a' }), S('2', '2026-12-08', '09:00', '17:00', { user_id: 'a' }), S('3', '2026-12-09', '09:00', '17:00', { user_id: 'a', status: 'proposed' })];
  const ov = overviewOf({ members, shifts, contracts: [{ user_id: 'a', weekly_hours: 20, vacation_days: 22, overtime_mode: 'bank', ends_on: null }], absences: [{ user_id: 'a', kind: 'ferie', from_day: '2026-12-21', to_day: '2026-12-23', status: 'approved' }, { user_id: 'a', kind: 'ferie', from_day: '2026-12-28', to_day: '2026-12-29', status: 'requested' }], cover: [{ user_id: 'a', available: true }], months: [{ user_id: 'a', month: '2026-12', status: 'confirmed' }] }, '2026-12-01', '2026-12-31');
  assert.deepEqual(ov.map((p) => p.name), ['Ann', 'Zoe']);
  const z = ov[1]; assert.equal(z.planned, 16); assert.equal(z.pending_shifts, 1); assert.equal(z.vacation_taken, 3); assert.equal(z.cover, true); assert.equal(z.month_confirmed, true); assert.equal(z.weekly_hours, 20); assert.equal(z.overtime_mode, 'bank');
  assert.equal(ov[0].weekly_hours, 40); assert.equal(ov[0].month_confirmed, null); assert.equal(Object.keys(z).some((k) => /pay|salary|gross|net|euro/i.test(k)), false);
});

test('finestra di confronto: fino all\'ultimo turno pianificato, mai oltre il mese', () => {
  const l = [S('a', '2026-12-07', '09:00', '17:00'), S('b', '2026-12-18', '09:00', '17:00'), S('c', '2026-12-28', '09:00', '17:00', { status: 'proposed' }), S('d', '2027-01-05', '09:00', '17:00')];
  assert.equal(windowEnd(l, '2026-12-10', '2026-12-31'), '2026-12-18'); assert.equal(windowEnd(l, '2026-12-20', '2026-12-31'), '2026-12-20'); assert.equal(windowEnd([], '2026-12-10', '2026-12-31'), '2026-12-10');
  assert.equal(windowEnd(l, '2027-01-02', '2026-12-31'), '2026-12-31'); assert.equal(r1(85.714), 85.7);
});

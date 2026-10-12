import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/lib/lpStatement.ts';

const T = (m, day) => new Date(2026, m, day, 12).getTime();
const moves = [
  { id: '1', ts: T(0, 5), kind: 'earn', source: 'giornaliero', label: 'Dono', amount: 10 },
  { id: '2', ts: T(2, 5), kind: 'earn', source: 'iscrizioni', label: 'Corso', amount: 200 },
  { id: '3', ts: T(3, 1), kind: 'spend', label: 'Seminario', amount: 25 },
  { id: '4', ts: T(5, 1), kind: 'withdraw', label: 'Ritiro', amount: 100 },
  { id: '5', ts: new Date(2025, 11, 31, 12).getTime(), kind: 'earn', source: 'idee', label: 'Fuori periodo', amount: 999 },
];
test('commissione del 5% solo sul ritiro', () => {
  assert.deepEqual(S.withdrawFee(100), { fee: 5, net: 95 });
  assert.deepEqual(S.withdrawFee(0), { fee: 0, net: 0 });
  assert.deepEqual(S.withdrawFee(-5), { fee: 0, net: 0 });
  assert.equal(S.withdrawFee(33.33).fee, 1.67);
});
test('rendiconto del periodo', () => {
  const { from, to } = S.yearRange(2026);
  const s = S.buildStatement(moves, from, to);
  assert.equal(s.earned.total, 210);
  assert.equal(s.earned.bySource.giornaliero, 10);
  assert.equal(s.earned.bySource.iscrizioni, 200);
  assert.equal(s.spent.total, 25);
  assert.deepEqual([s.withdrawn.gross, s.withdrawn.fee, s.withdrawn.net], [100, 5, 95]);
  assert.equal(s.kept, 85);
});
test('senza ritiri nessuna commissione', () => {
  const { from, to } = S.yearRange(2026);
  const s = S.buildStatement(moves.filter((m) => m.kind !== 'withdraw'), from, to);
  assert.equal(s.withdrawn.fee, 0);
  assert.equal(s.kept, 185);
});
test('testo condivisibile', () => {
  const { from, to } = S.yearRange(2026);
  const t = S.statementText(S.buildStatement(moves, from, to), 2026, 'Anna');
  assert.match(t, /Commissione 5%: 5 LP/);
  assert.match(t, /Anna/);
});

test('ritiro: i Giornalieri si sbloccano solo con 1000 donatori diversi', () => {
  const m = [
    { id: 'a', ts: 1, kind: 'earn', source: 'giornaliero', label: 'g', amount: 40 },
    { id: 'b', ts: 2, kind: 'earn', source: 'iscrizioni', label: 'c', amount: 100 },
    { id: 'c', ts: 3, kind: 'spend', label: 's', amount: 30 },
  ];
  const w = S.withdrawInfo(m, 10, 500);
  assert.equal(w.dailyUnlocked, false);
  assert.equal(w.fromActivities, 100 - 0); // gli acquisti consumano prima i non ritirabili (40) poi 0 dalle attività... 30 < 40
  assert.equal(w.withdrawable, 100);
  assert.equal(w.locked, 10);
  const u = S.withdrawInfo(m, 1000, 500);
  assert.equal(u.dailyUnlocked, true);
  assert.equal(u.withdrawable, 110);
  assert.equal(S.withdrawInfo(m, 10, 20).withdrawable, 20); // mai oltre il saldo
  assert.equal(S.withdrawInfo([], 5000, 100).withdrawable, 0);
});

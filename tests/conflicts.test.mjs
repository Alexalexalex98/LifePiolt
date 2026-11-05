import test from 'node:test';
import assert from 'node:assert/strict';
import { overlaps, conflictsWith, freeStarts, incomingConflicts, rangeOf } from '../src/lib/conflicts.ts';

test('sovrapposizioni: toccarsi non è scontrarsi', () => {
  assert.equal(overlaps([600, 660], [630, 690]), true); assert.equal(overlaps([600, 660], [660, 720]), false); assert.equal(overlaps([600, 660], [540, 600]), false);
  assert.deepEqual(rangeOf({ time: '09:30' }), [570, 630]); assert.deepEqual(rangeOf({ time: '09:30', dur: 15 }), [570, 585]);
});
test('impegni che si scontrano con la riunione', () => {
  const l = [{ time: '09:00', dur: 60, title: 'Palestra' }, { time: '10:30', dur: 30, title: 'Dentista' }, { time: '00:00', dur: 1440, title: 'Festa' }, { time: '--:--', title: 'Senza ora' }, { time: '14:00', title: 'Pomeriggio' }];
  assert.deepEqual(conflictsWith(l, '10:00', 60).map((x) => x.e.title), ['Dentista']);
  assert.deepEqual(conflictsWith(l, '09:30', 30).map((x) => x.idx), [0]);
  assert.deepEqual(conflictsWith(l, '11:00', 60), []);
  assert.deepEqual(conflictsWith(l, '10:00', 60, (e) => e.title === 'Dentista'), []);
});
test('orari liberi dove entra l\'impegno', () => {
  assert.deepEqual(freeStarts([[540, 660]], 60, [540, 780]), ['11:00', '11:30', '12:00']);
  assert.deepEqual(freeStarts([[0, 2000]], 30), []); assert.equal(freeStarts([], 60)[0], '08:00');
});
test('impegno in arrivo contro i miei, senza contare se stesso', () => {
  const mine = [{ time: '10:00', dur: 60, title: 'Dentista' }, { time: '10:00', dur: 60, title: 'Riunione', wid: 'w1' }];
  assert.deepEqual(incomingConflicts(mine, { time: '10:30', dur: 30, wid: 'w1' }).map((x) => x.e.title), ['Dentista']);
});

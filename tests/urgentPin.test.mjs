import test from 'node:test';
import assert from 'node:assert/strict';
import { urgentPin } from '../src/lib/urgentPin.ts';

test('notifica fissa: solo urgenti di oggi non finiti', () => {
  const ev = [{ time: '09:00', title: 'Riunione', important: true, dur: 60 }, { time: '15:00', title: 'Dentista', important: true }, { time: '16:00', title: 'Caffè' }];
  const p = urgentPin(ev, [{ t: 'Pagare bolletta', urgent: true }, { t: 'x', urgent: true, done: true }], 10 * 60 + 30);
  assert.equal(p.count, 2);
  assert.match(p.body, /15:00 {2}Dentista/);
  assert.match(p.body, /Da fare: Pagare bolletta/);
  assert.doesNotMatch(p.body, /Riunione|Caffè/);
});
test('niente urgenti: nessuna notifica', () => {
  assert.equal(urgentPin([{ time: '09:00', title: 'a' }], [{ t: 'b' }], 0), null);
  assert.equal(urgentPin(undefined, undefined, 0), null);
});

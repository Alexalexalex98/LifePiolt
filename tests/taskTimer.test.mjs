import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../src/lib/taskTimer.ts';

test('timer: avvia, pausa, riprendi', () => {
  let t = T.startTimer(undefined, 1000);
  assert.ok(T.isRunning(t));
  assert.equal(T.elapsedMs(t, 61000), 60000);
  t = T.pauseTimer(t, 61000);
  assert.ok(!T.isRunning(t));
  assert.equal(T.elapsedMs(t, 999999), 60000);
  t = T.startTimer(t, 100000);
  assert.equal(T.elapsedMs(t, 130000), 90000);
  assert.equal(T.startTimer(t, 200000), t); // già in corso: invariato
});
test('timer: formato', () => {
  assert.equal(T.fmtElapsed(65000), '01:05');
  assert.equal(T.fmtElapsed(3725000), '1:02:05');
});
test('primi task da fare: urgenti e scadenze prima, completati esclusi', () => {
  const tasks = [{ t: 'a' }, { t: 'b', done: true, urgent: true }, { t: 'c', due: '2026-10-20' }, { t: 'd', urgent: true }, { t: 'e', due: '2026-10-13' }];
  assert.deepEqual(T.firstOpen(tasks, (x) => !!x.done, 3).map((x) => x.t), ['d', 'e', 'c']);
});

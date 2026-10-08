import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceTodayMood } from '../src/lib/moodLog.ts';

const old = [{ date: 'lun 1', mood: 'Felice', day: '2026-10-01' }];

test('prima scelta: aggiunge', () => {
  const r = replaceTodayMood(old, 'Calmo', '2026-10-08', 'gio 8');
  assert.equal(r.length, 2); assert.equal(r[0].mood, 'Calmo');
});
test('cambio umore: sostituisce quello di oggi senza duplicarlo', () => {
  const a = replaceTodayMood(old, 'Calmo', '2026-10-08', 'gio 8');
  const b = replaceTodayMood(a, 'Triste', '2026-10-08', 'gio 8');
  assert.equal(b.length, 2); assert.equal(b.filter((m) => m.day === '2026-10-08').length, 1); assert.equal(b[0].mood, 'Triste');
});
test('null: rimuove solo la voce di oggi', () => {
  const a = replaceTodayMood(old, 'Calmo', '2026-10-08', 'gio 8');
  assert.deepEqual(replaceTodayMood(a, null, '2026-10-08', 'gio 8'), old);
});

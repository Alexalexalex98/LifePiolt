import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMemo, nextOccurrences, occursOn, planMemos, whenOf, sortedMemos } from '../src/lib/memo.ts';

const now = new Date(2026, 9, 29, 10, 0).getTime(); // giovedi 29 ottobre 2026, 10:00
const at = (r) => new Date(r.at);

test('ricordami: domani alle 9', () => {
  const r = parseMemo("ricordami di chiamare l'idraulico domani alle 9", now);
  assert.equal(r.text, "Chiamare l'idraulico");
  assert.deepEqual([at(r).getDate(), at(r).getHours(), at(r).getMinutes()], [30, 9, 0]);
});
test('ricordami: ripetizione, stasera, tra due ore, data, giorno della settimana', () => {
  assert.equal(parseMemo('ricordami di prendere le pillole ogni giorno alle 8:30', now).repeat, 'daily');
  assert.equal(at(parseMemo('ricordami di comprare il pane stasera', now)).getHours(), 20);
  assert.equal(parseMemo('ricordami di chiamare mamma tra 2 ore', now).at, now + 2 * 3600000);
  assert.equal(at(parseMemo("ricordami di pagare l'affitto il 1/11 alle 10", now)).getMonth(), 10);
  assert.equal(at(parseMemo('ricordami di portare fuori la spazzatura venerdì alle 19', now)).getDate(), 30);
});
test('ricordami: senza ora non inventa', () => {
  assert.equal(parseMemo('ricordami di andare dal dentista', now).missing, 'time');
  assert.equal(parseMemo('ciao come stai', now), null);
});
test('ricordami: solo ora -> oggi se e\' futura, altrimenti domani', () => {
  assert.equal(at(parseMemo('ricordami di bere alle 18', now)).getDate(), 29);
  assert.equal(at(parseMemo('ricordami di bere alle 8', now)).getDate(), 30);
});
test('occorrenze: giornaliero, settimanale, mensile, una volta', () => {
  const base = whenOf('2026-10-01', '08:00');
  assert.equal(nextOccurrences({ id: 'a', text: 'x', at: base, repeat: 'none' }, now).length, 0);
  assert.equal(new Date(nextOccurrences({ id: 'a', text: 'x', at: base, repeat: 'daily' }, now)[0]).getDate(), 30);
  assert.equal(new Date(nextOccurrences({ id: 'a', text: 'x', at: base, repeat: 'weekly' }, now)[0]).getDay(), 4);
  assert.equal(new Date(nextOccurrences({ id: 'a', text: 'x', at: whenOf('2026-01-31', '08:00'), repeat: 'monthly' }, now)[0]).getDate(), 31);
  assert.equal(nextOccurrences({ id: 'a', text: 'x', at: now + 3600000, repeat: 'none', done: true }, now).length, 0);
});
test('giorno: il promemoria compare nel suo giorno', () => {
  const m = { id: 'a', text: 'x', at: whenOf('2026-11-02', '09:00'), repeat: 'weekly' };
  assert.equal(occursOn(m, '2026-11-02'), true);
  assert.equal(occursOn(m, '2026-11-09'), true);
  assert.equal(occursOn(m, '2026-11-03'), false);
  assert.equal(occursOn(m, '2026-10-26'), false);
});
test('programmazione: dal piu\' vicino e con un tetto', () => {
  const list = Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, text: 't', at: now + (i + 1) * 3600000, repeat: 'daily' }));
  const p = planMemos(list, now, 10);
  assert.equal(p.length, 10);
  assert.ok(p.every((x, i) => i === 0 || p[i - 1].at <= x.at));
  const s = sortedMemos([{ id: 'p', text: 'passato', at: now - 3600000, repeat: 'none' }, { id: 'f', text: 'futuro', at: now + 3600000, repeat: 'none' }], now);
  assert.equal(s.upcoming.length, 1); assert.equal(s.overdue.length, 1);
});

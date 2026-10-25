import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionFromOf, relevantHistory } from '../src/lib/assistant/session.ts';

const H = 3600000, now = 100 * H;
const m = (who, text, ago) => ({ who, text, ts: now - ago * H });
const log = [m('me', 'Quanto spendo di affitto al mese?', 30), m('ai', 'Circa 1500 franchi.', 30), m('me', 'Che tempo fa domani?', 29), m('ai', 'Sole.', 29), m('me', 'ciao', 0.2)];

test('la conversazione di adesso comincia dopo una pausa di piu\' di due ore', () => {
  assert.equal(sessionFromOf(log, now), 4);
  assert.equal(sessionFromOf(log, now + 5 * H), 5);
  assert.equal(sessionFromOf([], now), 0);
});
test('senza «Storico» il passato non entra mai', () => {
  assert.deepEqual(relevantHistory(log, 'e l\'affitto di ottobre?', false, now), []);
});
test('con «Storico» entra solo cio\' che c\'entra con la domanda', () => {
  const r = relevantHistory(log, 'quanto è l\'affitto?', true, now);
  assert.equal(r.length, 1); assert.match(r[0][0].text, /affitto/);
  assert.deepEqual(relevantHistory(log, 'com\'è nato l\'universo?', true, now), []);
});

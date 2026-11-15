import test from 'node:test';
import assert from 'node:assert/strict';
import { CLUB_RULES, CLUB_RULES_VERSION, canPublish, adultGate, isUrgent, RULES_CONSEQUENCES } from '../src/lib/club/rules.ts';

test('regole: ci sono tutte, con titolo e testo; i divieti assoluti sono scritti chiaramente', () => {
  assert.ok(CLUB_RULES.length >= 8); assert.equal(new Set(CLUB_RULES.map((r) => r.id)).size, CLUB_RULES.length);
  for (const r of CLUB_RULES) { assert.ok(r.title.length > 5 && r.text.length > 30, r.id); }
  const all = CLUB_RULES.map((r) => r.id);
  for (const id of ['minori', 'consenso', 'esplicito', 'diritti', 'adulti']) assert.ok(all.includes(id), id);
  assert.match(CLUB_RULES.find((r) => r.id === 'minori').text, /vietato in assoluto/); assert.match(CLUB_RULES.find((r) => r.id === 'esplicito').text, /ammessi se non espliciti/);
  assert.match(RULES_CONSEQUENCES, /autorità/);
});
test('pubblicare: serve accettare le regole attuali', () => {
  assert.equal(canPublish(undefined).ok, false); assert.equal(canPublish({ version: CLUB_RULES_VERSION - 1, at: 1 }).ok, false); assert.match(canPublish({ version: 0, at: 1 }).why, /cambiate/);
  assert.equal(canPublish({ version: CLUB_RULES_VERSION, at: 1 }).ok, true);
});
test('18+: club normali sempre ok; minorenni bloccati; età ignota = conferma una volta', () => {
  assert.equal(adultGate({ adultClub: false, birthYear: 2015, ack: false, year: 2026 }), 'ok');
  assert.equal(adultGate({ adultClub: undefined, birthYear: null, ack: false, year: 2026 }), 'ok');
  assert.equal(adultGate({ adultClub: true, birthYear: 2012, ack: true, year: 2026 }), 'blocked', 'anche se ha confermato');
  assert.equal(adultGate({ adultClub: true, birthYear: 2009, ack: false, year: 2026 }), 'blocked');
  assert.equal(adultGate({ adultClub: true, birthYear: 1998, ack: false, year: 2026 }), 'ask');
  assert.equal(adultGate({ adultClub: true, birthYear: '1998', ack: true, year: 2026 }), 'ok');
  assert.equal(adultGate({ adultClub: true, birthYear: null, ack: false, year: 2026 }), 'ask'); assert.equal(adultGate({ adultClub: true, birthYear: '', ack: true, year: 2026 }), 'ok');
  assert.equal(adultGate({ adultClub: true, birthYear: 2008, ack: true, year: 2026 }), 'ok', '18 anni nell\'anno: si tratta da maggiorenne');
});
test('segnalazioni urgenti', () => { assert.equal(isUrgent('minori'), true); assert.equal(isUrgent('illegale'), true); assert.equal(isUrgent('spam'), false); });

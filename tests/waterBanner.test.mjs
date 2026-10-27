import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAmountMl, bannerMinutes, DRINKS, GLASS_ML } from '../src/lib/fitness/waterBanner.ts';

const at = (h, m = 0) => new Date(2026, 9, 21, h, m).getTime();
const base = { on: true, afterMin: 120, from: '09:00', to: '21:00', lastDrink: 0, snoozeUntil: 0, todayMl: 500, goalMl: 2000 };

test('banner: compare dopo il tempo scelto dall\'ultima acqua segnata', () => {
  assert.equal(bannerMinutes({ ...base, now: at(14), lastDrink: at(11, 30) }), 150);
  assert.equal(bannerMinutes({ ...base, now: at(13), lastDrink: at(12) }), null);
});
test('banner: se oggi non hai segnato nulla si parte dall\'inizio della giornata', () => {
  assert.equal(bannerMinutes({ ...base, now: at(10), lastDrink: 0 }), null);
  assert.equal(bannerMinutes({ ...base, now: at(11, 30), lastDrink: 0 }), 150);
});
test('banner: non compare fuori orario, spento, rimandato o a obiettivo raggiunto', () => {
  assert.equal(bannerMinutes({ ...base, now: at(7) }), null);
  assert.equal(bannerMinutes({ ...base, now: at(22) }), null);
  assert.equal(bannerMinutes({ ...base, now: at(15), on: false }), null);
  assert.equal(bannerMinutes({ ...base, now: at(15), snoozeUntil: at(15, 20) }), null);
  assert.equal(bannerMinutes({ ...base, now: at(15), todayMl: 2000 }), null);
});
test('bevande: valori sensati', () => {
  assert.equal(GLASS_ML, 250);
  for (const d of DRINKS) { assert.ok(d.ml > 0 && d.hydrate >= 0 && d.hydrate <= 1, d.id); }
});

import { FOOD } from '../src/lib/fitness/nutrition.ts';
test('bevande con calorie: ogni id esiste davvero nel database', () => {
  for (const d of DRINKS) if (d.food) assert.ok(FOOD(d.food), d.id);
});

test('quantità scritta a mano', () => {
  assert.equal(parseAmountMl('350'), 350);
  assert.equal(parseAmountMl('1,5 l'), 1500);
  assert.equal(parseAmountMl('mezzo litro'), 500);
  assert.equal(parseAmountMl('2 bicchieri'), 400);
  assert.equal(parseAmountMl('33 cl'), 330);
  assert.equal(parseAmountMl(''), null);
  assert.equal(parseAmountMl('boh'), null);
  assert.equal(parseAmountMl('9000'), null);
});

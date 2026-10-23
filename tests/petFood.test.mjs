import test from 'node:test';
import assert from 'node:assert/strict';
import { FOODS, foodOf, ownedFoods, reactionOf } from '../src/lib/petFood.ts';
import { newPet, give, tick, moodOf, FLOOR } from '../src/lib/pet.ts';

const day = '2026-10-23';
const E = { snack: 5, water: 5, fit: 1, love: 1 };

test('la frutta dà energia e salute, i fritti le tolgono ma danno allegria', () => {
  const p = { ...newPet(0), energy: 60, health: 60, joy: 50 };
  const a = give(p, 'snack', E, day, 0, foodOf('apple').fx).pet;
  assert.ok(a.energy > 60 && a.health > 60);
  const b = give(p, 'snack', E, day, 0, foodOf('fries').fx).pet;
  assert.ok(b.energy < 60 && b.health < 60 && b.joy > 50);
});
test('niente punizioni: non si scende sotto la soglia', () => {
  let p = { ...newPet(0), energy: FLOOR + 1, health: FLOOR + 1 };
  for (let i = 0; i < 4; i++) p = give(p, 'snack', E, day, 0, foodOf('burger').fx).pet;
  assert.equal(p.energy, FLOOR); assert.equal(p.health, FLOOR);
});
test('serve il gettone: senza non cambia niente', () => {
  const p = newPet(0);
  const r = give(p, 'snack', { ...E, snack: 0 }, day, 0, foodOf('apple').fx);
  assert.equal(r.ok, false);
});
test('energia e salute calano piano col tempo, la salute molto meno', () => {
  const t = tick({ ...newPet(0) }, 10 * 3600000);
  assert.ok(70 - t.energy > 70 - t.health);
});
test('vecchi salvataggi senza energia e salute funzionano', () => {
  const old = { ...newPet(0) }; delete old.energy; delete old.health;
  const t = tick(old, 3600000);
  assert.ok(t.energy < 70 && t.health < 70);
  assert.ok(moodOf(old, 12).label);
});
test('riconosce i tuoi alimenti per categoria, senza alcol né condimenti', () => {
  const o = ownedFoods(['fragole', 'maionese', 'ketchup', 'bevanda d\'avena', 'cetrioli sottaceto', 'acqua', 'caffè freddo', 'birra', 'patatine al formaggio', 'succo di limone', 'pasta', 'fragole']);
  const byLabel = Object.fromEntries(o.map((x) => [x.label, x.def.id]));
  assert.equal(byLabel['fragole'], 'apple');
  assert.equal(byLabel['bevanda d\'avena'], 'milk');
  assert.equal(byLabel['acqua'], 'water');
  assert.equal(byLabel['cetrioli sottaceto'], 'salad');
  assert.equal(byLabel['patatine al formaggio'], 'fries');
  assert.ok(!('maionese' in byLabel) && !('ketchup' in byLabel) && !('birra' in byLabel) && !('caffè freddo' in byLabel) && !('pasta' in byLabel));
  assert.equal(o.filter((x) => x.label === 'fragole').length, 1);
});
test('ogni alimento ha un effetto e una reazione gentile', () => {
  for (const f of FOODS) { assert.ok(f.fx.xp >= 0); assert.ok(reactionOf(f).text); }
  assert.equal(reactionOf(foodOf('donut')).good, false);
});

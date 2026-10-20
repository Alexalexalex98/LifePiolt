import test from 'node:test';
import assert from 'node:assert/strict';
import { gymStanding, findGyms } from '../src/lib/fitness/gymSearch.ts';
import { PARTNER_GYMS } from '../src/lib/fitness/data.ts';
import { figurePanels, FAMILIES } from '../src/lib/fitness/poses.ts';

test('un centro del programma si trova per nome o città', () => {
  assert.ok(findGyms('riva', PARTNER_GYMS).length >= 1);
  assert.equal(gymStanding('palestra riva', PARTNER_GYMS, [], []).kind, 'convenzionato');
});
test('centro sconosciuto: non convenzionato; poi invitato; poi rifiutato', () => {
  assert.equal(gymStanding('Super Gym Xyz', PARTNER_GYMS, [], []).kind, 'non-convenzionato');
  const inv = { id: '1', name: 'Super Gym Xyz', ts: 1, status: 'invitato' };
  assert.equal(gymStanding('super gym xyz', PARTNER_GYMS, [], [inv]).kind, 'invitato');
  assert.equal(gymStanding('super gym xyz', PARTNER_GYMS, [], [{ ...inv, status: 'rifiutato' }]).kind, 'rifiutato');
  assert.equal(gymStanding('Super Gym Xyz', PARTNER_GYMS, [{ name: 'Super Gym Xyz', status: 'in verifica' }], []).kind, 'in-verifica');
});
test('omini: ogni famiglia ha testa, maglia e pelle', () => {
  for (const f of Object.values(FAMILIES)) for (const p of figurePanels(f)) {
    assert.ok(p.lines.some((l) => l.c === 'shirt') && p.circles.some((c) => c.col === 'skin'), f.id);
  }
});

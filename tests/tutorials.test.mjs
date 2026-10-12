import test from 'node:test';
import assert from 'node:assert/strict';
import { TUTORIALS, autoTutorialFor, tutorialById, tutorialForPage } from '../src/lib/tutorials.ts';

test('ogni tutorial ha passi, id unici e una pagina', () => {
  assert.ok(TUTORIALS.length >= 15);
  assert.equal(new Set(TUTORIALS.map((t) => t.id)).size, TUTORIALS.length);
  assert.equal(new Set(TUTORIALS.map((t) => t.page)).size, TUTORIALS.length);
  for (const t of TUTORIALS) {
    assert.ok(t.id.startsWith('sec-') && t.page && t.title && t.steps.length >= 2, t.id);
    assert.equal(new Set(t.steps.map((s) => s.id)).size, t.steps.length, t.id);
    for (const s of t.steps) assert.ok(s.title && s.text.length > 20, `${t.id}/${s.id}`);
  }
});
test('parte da solo solo la prima volta e se non disattivati', () => {
  assert.equal(autoTutorialFor('plan', [], false)?.id, 'sec-plan');
  assert.equal(autoTutorialFor('plan', ['sec-plan'], false), null);
  assert.equal(autoTutorialFor('plan', [], true), null);
  assert.equal(autoTutorialFor('home', [], false), null); // la Dashboard ha già il benvenuto
  assert.equal(autoTutorialFor('pagina-inesistente', [], false), null);
});
test('ricerca per id e per pagina', () => {
  assert.equal(tutorialById('sec-lifefinance')?.page, 'lifefinance');
  assert.equal(tutorialForPage('payments')?.id, 'sec-payments');
});

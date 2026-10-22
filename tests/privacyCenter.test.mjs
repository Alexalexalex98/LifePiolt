import test from 'node:test';
import assert from 'node:assert/strict';
import { gate, pushConsent, exportJson, modeOf, CATS } from '../src/lib/privacyCenter.ts';

test('consenso per categoria: sempre invia, mai blocca, di default chiede', () => {
  const g = gate(['finance', 'health', 'agenda', 'finance'], { finance: 'always', health: 'never' });
  assert.deepEqual(g, { send: ['finance'], ask: ['agenda'], blocked: ['health'] });
  assert.equal(modeOf(undefined, 'travel'), 'ask');
});

test('registro delle scelte: tiene le ultime 200', () => {
  let l = [];
  for (let i = 0; i < 250; i++) l = pushConsent(l, { ts: i, cat: 'finance', mode: 'ask' });
  assert.equal(l.length, 200);
  assert.equal(l[0].ts, 50);
});

test('esportazione: senza funzioni e senza file incorporati enormi', () => {
  const j = JSON.parse(exportJson({ a: 1, f: () => 1, img: 'data:image/png;base64,' + 'A'.repeat(3000), n: 'ok' }));
  assert.deepEqual(Object.keys(j).sort(), ['a', 'img', 'n']);
  assert.equal(j.img, '[file non incluso]');
});

test('le categorie sensibili sono marcate', () => {
  for (const id of ['finance', 'health', 'fitness']) assert.ok(CATS.find((c) => c.id === id)?.special);
});

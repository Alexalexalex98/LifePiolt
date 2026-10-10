import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKnowledge, groupKnowledge, shouldGroup, groupOf, matchCatalog } from '../src/lib/knowledge.ts';

const base = { chosen: [], custom: [], recent: [], trips: [], goals: [], workouts: [], dismissed: [] };
const cat = [{ id: 'caffe', label: 'Bar e caffetterie' }, { id: 'architettura', label: 'Architettura' }];

test('unisce le fonti senza doppioni', () => {
  const k = buildKnowledge({ ...base, chosen: [{ id: 'caffe', label: 'Bar e caffetterie' }], custom: [{ id: '1', label: 'bar e caffetterie' }], trips: [{ id: 't', city: 'Parigi' }], recent: [{ q: 'Parigi', ts: 1 }] });
  assert.equal(k.length, 2);
});
test('le voci eliminate non tornano', () => {
  const k = buildKnowledge({ ...base, trips: [{ id: 't', city: 'Parigi' }], dismissed: ['t:parigi'] });
  assert.equal(k.length, 0);
});
test('macro categorie', () => {
  assert.equal(groupOf('Weekend a Roma'), 'Viaggi');
  assert.equal(groupOf('Pizza napoletana'), 'Cibo e locali');
  assert.equal(groupOf('qualcosa di strano'), 'Altro');
  const items = buildKnowledge({ ...base, custom: Array.from({ length: 13 }, (_, i) => ({ id: String(i), label: i % 2 ? 'Yoga ' + i : 'Pizza ' + i })) });
  assert.equal(shouldGroup(items), true);
  assert.deepEqual(groupKnowledge(items).map((g) => g.group), ['Cibo e locali', 'Natura e sport']);
});
test('testo libero collegato al catalogo', () => {
  assert.equal(matchCatalog('Caffè', cat), 'caffe');
  assert.equal(matchCatalog('architettura moderna', cat), 'architettura');
  assert.equal(matchCatalog('filatelia', cat), null);
});
import { norm, SOURCE_LABEL } from '../src/lib/knowledge.ts';
test('norm per la ricerca: accenti e maiuscole', () => {
  assert.equal(norm('  CaffÈ   e  BAR '), 'caffe e bar');
  assert.ok(norm('Bar e caffetterie').includes(norm('CAFFÈ')));
  assert.ok(Object.keys(SOURCE_LABEL).length >= 6);
});

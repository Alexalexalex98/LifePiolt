import test from 'node:test';
import assert from 'node:assert/strict';
import { addReport, filterVisible, isVisible, makeReport, modKey, removeReport } from '../src/lib/modRules.ts';

test('segnalare nasconde, annullare riporta il contenuto', () => {
  const r = makeReport({ kind: 'post', ref: 'standalone:3', label: 'Ciao', author: 'Anna', reason: 'spam', note: ' x ' }, 'r1', 1);
  assert.equal(r.key, 'post:standalone:3');
  assert.equal(r.note, 'x');
  let reports = addReport([], r);
  assert.equal(isVisible(r.key, 'Anna', reports, {}, []), false);
  assert.equal(isVisible('post:standalone:4', 'Anna', reports, {}, []), true);
  reports = removeReport(reports, 'r1');
  assert.equal(isVisible(r.key, 'Anna', reports, {}, []), true);
});

test('una sola segnalazione per contenuto', () => {
  const a = makeReport({ kind: 'idea', ref: 1, label: 'i', reason: 'spam' }, 'a', 1);
  const b = makeReport({ kind: 'idea', ref: 1, label: 'i', reason: 'truffa' }, 'b', 2);
  const list = addReport(addReport([], a), b);
  assert.equal(list.length, 1);
  assert.equal(list[0].reason, 'truffa');
});

test('nascosti e utenti bloccati spariscono', () => {
  const hidden = { [modKey('seminar', 7)]: { label: 's', kind: 'seminar', ts: 1 } };
  assert.equal(isVisible('seminar:7', 'X', [], hidden, []), false);
  assert.equal(isVisible('seminar:8', 'Bob', [], hidden, ['Bob']), false);
  const posts = [{ id: 1, a: 'A' }, { id: 2, a: 'Bob' }, { id: 3, a: 'C' }];
  const out = filterVisible(posts, (p) => modKey('post', 'standalone:' + p.id), (p) => p.a, [], { 'post:standalone:3': { label: '', kind: 'post', ts: 1 } }, ['Bob']);
  assert.deepEqual(out.map((p) => p.id), [1]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_EXERCISES, CATS, filterExercises, metaOf, narrationPlan, exerciseById } from '../src/lib/mindLibrary.ts';
import { recommend } from '../src/lib/mindRecommend.ts';

test('almeno 100 esercizi, id unici, ogni esercizio ha passi e categoria', () => {
  assert.ok(ALL_EXERCISES.length >= 100, String(ALL_EXERCISES.length));
  assert.equal(new Set(ALL_EXERCISES.map((e) => e.id)).size, ALL_EXERCISES.length);
  const cats = new Set(CATS.map((c) => c.id));
  for (const e of ALL_EXERCISES) { assert.ok(e.steps.length > 0 && e.title && e.closing, e.id); assert.ok(cats.has(metaOf(e.id).cat), e.id); assert.equal(new Set(e.steps.map((s) => s.id)).size, e.steps.length, e.id); }
});
test('ogni categoria ha esercizi base', () => { for (const c of CATS) assert.ok(filterExercises({ cat: c.id, level: 'base' }).length > 0, c.id); });
test('copione per ascoltare: durata coerente con i minuti', () => {
  const e = exerciseById('c-scan10'); const plan = narrationPlan(e);
  const pause = plan.filter((p) => p.kind === 'pause').reduce((a, p) => a + p.ms, 0) / 1000;
  const say = plan.filter((p) => p.kind === 'say').reduce((a, p) => a + p.text.length, 0) / 14;
  assert.ok(pause + say > 8 * 60 && pause + say < 11 * 60, String(pause + say));
  assert.equal(plan.at(-1).kind, 'say');
});
test('consigli personalizzati: sera, sonno corto, umore giù; senza ripetere', () => {
  const a = recommend({ weak: [{ id: 'sonno', why: 'Dormi poco' }, { id: 'tensione', why: 'Tensione alta' }], sleepAvg: 5.5, mood: 2, hour: 22, recent: [], seed: 1 });
  assert.equal(a[0].exId, 's-winddown'); assert.equal(a.length, 3); assert.equal(new Set(a.map((x) => x.exId)).size, 3);
  assert.ok(a.every((x) => x.reason.length > 5));
  const b = recommend({ weak: [], hour: 9, recent: ['r-box'], seed: 1 });
  assert.equal(b.length, 3); assert.ok(!b.some((x) => x.exId === 'r-box'));
  assert.deepEqual(recommend({ weak: [], hour: 9, recent: [], seed: 4 }), recommend({ weak: [], hour: 9, recent: [], seed: 4 }));
});

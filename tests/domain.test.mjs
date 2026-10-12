import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emit, on, registerModule, resetBus, setErrorSink, handlerCount, handlersOf } from '../src/domain/events.ts';
import { registerStore, resetOperations, runOperation, isDone, forgetKey } from '../src/domain/operation.ts';

const store = (init) => {
  let s = init;
  return { getState: () => s, setState: (p, replace) => { s = replace ? p : { ...s, ...(typeof p === 'function' ? p(s) : p) }; } };
};

test('eventi: ordine per order e poi per registrazione', () => {
  resetBus();
  const seen = [];
  on('bill.paid', 'a', () => seen.push('a100'));
  on('bill.paid', 'b', () => seen.push('b10'), { order: 10 });
  on('bill.paid', 'c', () => seen.push('c100'));
  on('bill.paid', 'd', () => seen.push('d50'), { order: 50 });
  const r = emit('bill.paid', { id: '1', fullyPaid: true, recorded: false });
  assert.deepEqual(seen, ['b10', 'd50', 'a100', 'c100']);
  assert.equal(r.delivered, 4);
  assert.equal(r.failed, 0);
  assert.deepEqual(handlersOf('bill.paid'), ['b:handler', 'd:handler', 'a:handler', 'c:handler']);
});

test('eventi: un handler che lancia non rompe gli altri e finisce nel sink', () => {
  resetBus();
  const errors = [];
  setErrorSink((e, w) => errors.push([e.message, w.module, w.event]));
  const seen = [];
  on('mood.logged', 'm1', () => seen.push(1));
  on('mood.logged', 'bad', () => { throw new Error('boom'); });
  on('mood.logged', 'm3', () => seen.push(3));
  const r = emit('mood.logged', { mood: 'ok' });
  assert.deepEqual(seen, [1, 3]);
  assert.equal(r.failed, 1);
  assert.equal(r.delivered, 2);
  assert.deepEqual(errors, [['boom', 'bad', 'mood.logged']]);
});

test('eventi: rifiuto di una promise async va al sink senza essere "non gestito"', async () => {
  resetBus();
  const errors = [];
  setErrorSink((e) => errors.push(e.message));
  on('task.completed', 'x', async () => { throw new Error('async-fail'); });
  emit('task.completed', { id: 't' });
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(errors, ['async-fail']);
});

test('eventi: un sink che lancia non interrompe l\'emissione; loop di riemissione fermato', () => {
  resetBus();
  setErrorSink(() => { throw new Error('sink rotto'); });
  const seen = [];
  on('bill.created', 'bad', () => { throw new Error('x'); });
  on('bill.created', 'ok', () => seen.push('ok'));
  assert.doesNotThrow(() => emit('bill.created', { id: '1' }));
  assert.deepEqual(seen, ['ok']);
  resetBus();
  const errs = [];
  setErrorSink((e) => errs.push(e.message));
  let n = 0;
  on('clock.changed', 'loop', () => { n++; emit('clock.changed', { reason: 'manual' }); });
  emit('clock.changed', { reason: 'manual' });
  assert.ok(n <= 8 && n >= 1);
  assert.ok(errs.some((m) => /annidati/.test(m)));
});

test('registerModule e\' idempotente e on() restituisce la funzione per togliere', () => {
  resetBus();
  let c = 0;
  assert.equal(registerModule('m', () => { c++; on('bill.paid', 'm', () => {}); }), true);
  assert.equal(registerModule('m', () => { c++; }), false);
  assert.equal(c, 1);
  const off = on('bill.paid', 'z', () => {});
  assert.equal(handlerCount('bill.paid'), 2);
  off();
  assert.equal(handlerCount('bill.paid'), 1);
});

test('operazioni: successo, eventi dopo il commit e valori dei passi', () => {
  resetBus(); resetOperations();
  const a = store({ n: 1 }), b = store({ list: [] });
  registerStore('a', a); registerStore('b', b);
  const events = [];
  on('booking.cancelled', 't', (p) => events.push(p.id));
  const r = runOperation('t', [
    { name: 'uno', stores: ['a'], run: (c) => { a.setState({ n: 2 }); c.set('x', 42); } },
    { name: 'due', stores: ['b'], run: () => b.setState({ list: [1] }) },
  ], { events: (c) => [['booking.cancelled', { id: String(c.get('x')), kind: 'seminar', title: 't' }]] });
  assert.equal(r.ok, true);
  assert.equal(r.value.x, 42);
  assert.deepEqual(a.getState(), { n: 2 });
  assert.deepEqual(events, ['42']);
});

test('operazioni: se un passo fallisce gli store toccati tornano com\'erano e non partono eventi', () => {
  resetBus(); resetOperations();
  const a = store({ n: 1, other: 'x' }), b = store({ list: ['k'] }), c = store({ untouched: true });
  registerStore('a', a); registerStore('b', b); registerStore('c', c);
  const events = [];
  on('booking.cancelled', 't', () => events.push('ev'));
  const sinkCalls = [];
  const errs = [];
  setErrorSink((e) => errs.push(e));
  const r = runOperation('pay', [
    { name: 'uno', stores: ['a'], run: () => a.setState({ n: 99 }) },
    { name: 'due', stores: ['b'], run: () => { b.setState({ list: [] }); } },
    { name: 'tre', stores: ['c'], run: () => { c.setState({ untouched: false }); throw new Error('KO al terzo'); } },
  ], { events: () => [['booking.cancelled', { id: '1', kind: 'service', title: 'x' }]] });
  assert.equal(r.ok, false);
  assert.equal(r.failedStep, 'tre');
  assert.match(r.error, /KO al terzo/);
  assert.deepEqual(r.rolledBack.sort(), ['a', 'b', 'c']);
  assert.deepEqual(a.getState(), { n: 1, other: 'x' });
  assert.deepEqual(b.getState(), { list: ['k'] });
  assert.deepEqual(c.getState(), { untouched: true });
  assert.deepEqual(events, []);
  void sinkCalls; void errs;
});

test('operazioni: un passo che non dichiara lo store non lo ripristina; "*" li ripristina tutti; store sconosciuto = errore', () => {
  resetBus(); resetOperations();
  const a = store({ n: 1 }), b = store({ m: 1 });
  registerStore('a', a); registerStore('b', b);
  let r = runOperation('x', [{ name: 'p', stores: '*', run: () => { a.setState({ n: 5 }); b.setState({ m: 5 }); throw new Error('e'); } }]);
  assert.equal(r.ok, false);
  assert.deepEqual([a.getState(), b.getState()], [{ n: 1 }, { m: 1 }]);
  r = runOperation('y', [{ name: 'p', stores: ['nope'], run: () => {} }]);
  assert.equal(r.ok, false);
  assert.match(r.error, /non registrato/);
});

test('operazioni: idempotenza con chiave (solo dopo un successo) e forgetKey', () => {
  resetBus(); resetOperations();
  const a = store({ n: 0 });
  registerStore('a', a);
  const step = [{ name: 'inc', stores: ['a'], run: () => a.setState((s) => ({ n: s.n + 1 })) }];
  assert.equal(runOperation('inc', step, { key: 'k1' }).ok, true);
  const again = runOperation('inc', step, { key: 'k1' });
  assert.equal(again.ok && again.skipped, true);
  assert.equal(a.getState().n, 1);
  assert.equal(isDone('k1'), true);
  forgetKey('k1');
  assert.equal(runOperation('inc', step, { key: 'k1' }).ok, true);
  assert.equal(a.getState().n, 2);
  // un fallimento non consuma la chiave
  const bad = [{ name: 'boom', stores: ['a'], run: () => { throw new Error('x'); } }];
  assert.equal(runOperation('bad', bad, { key: 'k2' }).ok, false);
  assert.equal(isDone('k2'), false);
  assert.equal(runOperation('inc', step, { key: 'k2' }).ok, true);
});

test('operazioni: un handler che fallisce dopo il commit non annulla l\'operazione', () => {
  resetBus(); resetOperations();
  const a = store({ n: 0 });
  registerStore('a', a);
  const errs = [];
  setErrorSink((e) => errs.push(e.message));
  on('bill.reopened', 'bad', () => { throw new Error('handler KO'); });
  const r = runOperation('x', [{ name: 'p', stores: ['a'], run: () => a.setState({ n: 7 }) }], { events: () => [['bill.reopened', { id: '1' }]] });
  assert.equal(r.ok, true);
  assert.equal(a.getState().n, 7);
  assert.deepEqual(errs, ['handler KO']);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uuidv7, hash53, derivedId, stableStringify, deepEqual } from '../src/sync/ids.ts';
import { createClock, compareHlc, parseHlc, formatHlc, ClockSkewError, hlcWall, isHlc } from '../src/sync/clock.ts';
import { newSnapshot, scanCollection, snapshotFromBaseline, snapshotHashes, snapshotSlots, diffWire } from '../src/sync/diff.ts';
import { listAdapter, bucketedAdapter, setAdapter, nestedAdapter, recordAdapter } from '../src/sync/adapters.ts';
import { Outbox } from '../src/sync/outbox.ts';
import { wireChangeSchema, hlcSchema } from '../src/schemas/change.ts';

// ---------- ids ----------
test('uuidv7: formato valido, ordinabile per tempo, validato dallo schema condiviso', () => {
  const a = uuidv7(1_700_000_000_000), b = uuidv7(1_700_000_000_001), c = uuidv7(1_800_000_000_000);
  for (const u of [a, b, c]) assert.match(u, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.ok(a.slice(0, 13) < b.slice(0, 13) && b.slice(0, 13) < c.slice(0, 13));
  assert.equal(new Set(Array.from({ length: 2000 }, () => uuidv7())).size, 2000);
});
test('hash53 e id derivati sono stabili e sensibili al contenuto', () => {
  assert.equal(hash53('ciao'), hash53('ciao'));
  assert.notEqual(hash53('ciao'), hash53('ciaO'));
  assert.equal(derivedId('ev', '2026-01-01', '10:00', 'Riunione'), derivedId('ev', '2026-01-01', '10:00', 'Riunione'));
  assert.notEqual(derivedId('ev', 'a', 'bc'), derivedId('ev', 'ab', 'c'));
});
test('stableStringify e deepEqual ignorano l\'ordine delle chiavi e i valori undefined', () => {
  assert.equal(stableStringify({ b: 1, a: [1, { y: 2, x: 1 }] }), stableStringify({ a: [1, { x: 1, y: 2 }], b: 1, z: undefined }));
  assert.ok(deepEqual({ a: [1, 2], b: { c: 1 } }, { b: { c: 1 }, a: [1, 2] }));
  assert.ok(!deepEqual({ a: [1, 2] }, { a: [2, 1] }));
});

// ---------- HLC ----------
test('HLC: monotono anche se l\'ora del telefono torna indietro', () => {
  let t = 1_800_000_000_000;
  const c = createClock({ node: 'A', now: () => t });
  const seq = [c.tick(), c.tick()];
  t -= 60_000; // l'orologio torna indietro di un minuto
  seq.push(c.tick(), c.tick());
  for (let i = 1; i < seq.length; i++) assert.ok(compareHlc(seq[i - 1], seq[i]) < 0, `${seq[i - 1]} < ${seq[i]}`);
  assert.ok(isHlc(seq[0]) && hlcSchema.safeParse(seq[0]).success);
  const p = parseHlc(seq[0]);
  assert.equal(formatHlc(p.wall, p.counter, p.node), seq[0]);
});
test('HLC: receive supera sempre il timestamp ricevuto; deriva eccessiva rifiutata', () => {
  let ta = 1_800_000_000_000, tb = 1_800_000_000_000 - 5_000; // B ha l'ora indietro di 5 s
  const a = createClock({ node: 'A', now: () => ta }), b = createClock({ node: 'B', now: () => tb });
  const ha = a.tick();
  const hb = b.receive(ha);
  assert.ok(hb > ha);
  assert.ok(b.tick() > hb);
  const far = formatHlc(ta + 3 * 86400_000, 0, 'X');
  assert.throws(() => b.receive(far), ClockSkewError);
  // dopo l'errore l'orologio resta utilizzabile e monotono
  assert.ok(b.tick() > hb);
  assert.equal(hlcWall(ha), ta);
});
test('HLC: il contatore regge molte emissioni nello stesso millisecondo e si riprende dallo stato salvato', () => {
  const c = createClock({ node: 'A', now: () => 1_800_000_000_000 });
  let prev = c.tick();
  for (let i = 0; i < 5000; i++) { const n = c.tick(); assert.ok(n > prev); prev = n; }
  const c2 = createClock({ node: 'A', now: () => 1_700_000_000_000, initial: c.last() });
  assert.ok(c2.tick() > prev);
});

// ---------- diff ----------
const tasks = listAdapter({
  get: (s) => s.tasks, set: (tasks) => ({ tasks }), idOf: (e) => e.id,
  toWire: (e) => { const { id, ...r } = e; return r; }, fromWire: (id, w) => ({ ...w, id }),
});
let nid = 0;
const opts = (extra = {}) => ({ newId: () => 'n' + ++nid, ...extra });

test('diff per id: added, updated (a livello di campo), removed', () => {
  const snap = newSnapshot();
  const s1 = { tasks: [{ id: 'a', t: 'uno' }, { id: 'b', t: 'due', done: false }] };
  let r = scanCollection(tasks, s1, snap, opts());
  assert.deepEqual(r.added.map((x) => x.id), ['a', 'b']);
  const s2 = { tasks: [{ id: 'a', t: 'uno' }, { id: 'b', t: 'due', done: true, urgent: true }] };
  r = scanCollection(tasks, s2, snap, opts());
  assert.equal(r.added.length, 0);
  assert.deepEqual(r.updated.map((x) => [x.id, x.fields, x.unset]), [['b', { done: true, urgent: true }, []]]);
  const s3 = { tasks: [{ id: 'b', t: 'due' }] };
  r = scanCollection(tasks, s3, snap, opts());
  assert.deepEqual(r.removed, ['a']);
  assert.deepEqual(r.updated.map((x) => [x.id, x.fields, x.unset]), [['b', {}, ['done', 'urgent']]]);
});
test('diff: oggetti invariati (stesso riferimento) non vengono nemmeno trasformati; riferimento nuovo ma contenuto uguale non genera record', () => {
  const snap = newSnapshot();
  const items = Array.from({ length: 100 }, (_, i) => ({ id: 'i' + i, t: 'x' + i }));
  scanCollection(tasks, { tasks: items }, snap, opts());
  let calls = 0;
  const counting = { ...tasks, toWire: (r, b) => { calls++; return tasks.toWire(r, b); }, items: (b, ref) => tasks.items(b, ref).map((it) => ({ ...it, wire: () => { calls++; return it.wire(); } })) };
  const next = items.slice(); next[5] = { ...items[5] }; next[6] = { ...items[6], t: 'cambiato' };
  const r = scanCollection(counting, { tasks: next }, snap, opts());
  assert.equal(r.updated.length, 1);
  assert.equal(r.updated[0].id, 'i6');
  assert.ok(calls <= 6, 'solo le 2 entita\' con riferimento nuovo (e i loro vecchi valori) sono state lette: ' + calls);
  const again = scanCollection(counting, { tasks: next }, snap, opts());
  assert.equal(again.scanned, 0, 'stesso riferimento dell\'array: nessuna scansione');
});
test('diff: ripresa dopo il riavvio con le impronte salvate (baseline) trova modifiche e cancellazioni avvenute nel frattempo', () => {
  const snap = newSnapshot();
  const s1 = { tasks: [{ id: 'a', t: '1' }, { id: 'b', t: '2' }, { id: 'c', t: '3' }] };
  scanCollection(tasks, s1, snap, opts());
  const base = snapshotHashes(snap);
  const re = snapshotFromBaseline(base);
  const s2 = { tasks: [{ id: 'a', t: '1' }, { id: 'b', t: 'DUE' }, { id: 'd', t: '4' }] };
  const r = scanCollection(tasks, s2, re, opts());
  assert.deepEqual(r.added.map((x) => x.id), ['d']);
  assert.deepEqual(r.updated.map((x) => x.id), ['b']);
  assert.deepEqual(r.removed, ['c']);
});
test('diffWire', () => {
  assert.equal(diffWire({ a: 1 }, { a: 1 }), null);
  assert.deepEqual(diffWire({ a: 1, b: 2 }, { a: 1, c: 3 }), { fields: { c: 3 }, unset: ['b'] });
});

const events = bucketedAdapter({
  get: (s) => s.events, set: (events) => ({ events }), bucketOf: (w) => w.day,
  keyOf: (e, day) => `${day}|${e.time}|${e.title}|${e.ref ?? ''}`,
  toWire: (e, day) => ({ day, ...e }), fromWire: (id, w) => { const { day, ...r } = w; return r; },
});
test('eventi senza id: id assegnato e conservato, modifica sullo stesso posto = stessa entita\'', () => {
  const snap = newSnapshot();
  let r = scanCollection(events, { events: { '2026-10-12': [{ time: '10:00', title: 'Riunione' }, { time: '12:00', title: 'Pranzo' }] } }, snap, opts());
  assert.equal(r.added.length, 2);
  const [idRiu, idPra] = r.added.map((x) => x.id);
  // cambio l'ora della riunione (stessa posizione): e' una modifica, non cancellazione + creazione
  r = scanCollection(events, { events: { '2026-10-12': [{ time: '10:30', title: 'Riunione' }, { time: '12:00', title: 'Pranzo' }] } }, snap, opts());
  assert.equal(r.added.length, 0); assert.equal(r.removed.length, 0);
  assert.equal(r.updated.length, 1); assert.equal(r.updated[0].id, idRiu); assert.deepEqual(r.updated[0].fields, { time: '10:30' });
  // riordino: nessun record
  r = scanCollection(events, { events: { '2026-10-12': [{ time: '12:00', title: 'Pranzo' }, { time: '10:30', title: 'Riunione' }] } }, snap, opts());
  assert.deepEqual([r.added.length, r.updated.length, r.removed.length], [0, 0, 0]);
  // eliminazione di un giorno intero
  r = scanCollection(events, { events: {} }, snap, opts());
  assert.deepEqual(r.removed.sort(), [idRiu, idPra].sort());
});
test('eventi: duplicati identici nello stesso giorno hanno id distinti; la tabella degli slot sopravvive al riavvio', () => {
  const snap = newSnapshot();
  const st = { events: { d: [{ time: '9', title: 'Pillola' }, { time: '9', title: 'Pillola' }] } };
  const r = scanCollection(events, st, snap, opts());
  assert.equal(new Set(r.added.map((x) => x.id)).size, 2);
  const re = snapshotFromBaseline(snapshotHashes(snap), snapshotSlots(snap));
  const r2 = scanCollection(events, { events: { d: [{ time: '9', title: 'Pillola' }, { time: '9', title: 'Pillola' }, { time: '9', title: 'Pillola' }] } }, re, opts());
  assert.equal(r2.added.length, 1, 'solo il terzo e\' nuovo: gli id dei primi due sono rimasti');
  assert.equal(r2.updated.length + r2.removed.length, 0);
});
test('insiemi, mappe e voti annidati', () => {
  const setA = setAdapter({ get: (s) => s.following, set: (following) => ({ following }) });
  const snap = newSnapshot();
  scanCollection(setA, { following: ['anna', 'marco'] }, snap, opts());
  const r = scanCollection(setA, { following: ['marco', 'luca'] }, snap, opts());
  assert.deepEqual(r.added.map((x) => x.id), ['luca']); assert.deepEqual(r.removed, ['anna']);
  const nest = nestedAdapter({ get: (s) => s.votes, set: (votes) => ({ votes }) });
  const sn = newSnapshot();
  let rr = scanCollection(nest, { votes: { 'post1': { 1: 5, 2: 3 } } }, sn, opts());
  assert.deepEqual(rr.added.map((x) => [x.id, x.wire]), [['post1|1', { a: 'post1', b: '1', v: 5 }], ['post1|2', { a: 'post1', b: '2', v: 3 }]]);
  rr = scanCollection(nest, { votes: { 'post1': { 1: 4, 2: 3 } } }, sn, opts());
  assert.deepEqual(rr.updated.map((x) => [x.id, x.fields]), [['post1|1', { v: 4 }]]);
  const rec = recordAdapter({ get: (s) => s.clubs, set: (clubs) => ({ clubs }), toWire: (e) => ({ ...e }), fromWire: (id, w) => ({ ...w, id }) });
  const s3 = newSnapshot();
  scanCollection(rec, { clubs: { c1: { name: 'A' } } }, s3, opts());
  rr = scanCollection(rec, { clubs: { c1: { name: 'B' }, c2: { name: 'C' } } }, s3, opts());
  assert.deepEqual([rr.added.map((x) => x.id), rr.updated.map((x) => x.id)], [['c2'], ['c1']]);
});
test('adapter.apply: applica upsert e delete in modo immutabile', () => {
  const s = { tasks: [{ id: 'a', t: '1' }, { id: 'b', t: '2' }] };
  const frozen = JSON.stringify(s);
  const r = tasks.apply(s, new Map([['a', { t: 'UNO' }], ['z', { t: 'nuovo' }]]), new Set(['b']), { bucketOf: () => '', slots: () => [] });
  assert.deepEqual(r.patch.tasks, [{ t: 'UNO', id: 'a' }, { t: 'nuovo', id: 'z' }]);
  assert.equal(JSON.stringify(s), frozen);
  assert.equal(tasks.apply(s, new Map(), new Set(), { bucketOf: () => '', slots: () => [] }).patch, null);
});

// ---------- outbox ----------
const rec = (o) => ({ id: 'c' + Math.random(), collection: 'life.tasks', schemaV: 1, entityId: 'e1', hlc: 'h', deviceId: 'd', seq: 1, ...o });
test('outbox: compattazione create+update, update+update, update+delete', () => {
  const o = new Outbox();
  o.enqueue(rec({ op: 'create', fields: { t: 'a', done: false } }));
  o.enqueue(rec({ op: 'update', fields: { done: true }, hlc: 'h2' }));
  assert.equal(o.size, 1);
  let r = o.toArray()[0];
  assert.equal(r.op, 'create'); assert.deepEqual(r.fields, { t: 'a', done: true }); assert.equal(r.hlc, 'h2');
  const o2 = new Outbox();
  o2.enqueue(rec({ op: 'update', fields: { t: 'x' }, base: 'b0' }));
  o2.enqueue(rec({ op: 'update', fields: { done: true }, unset: ['due'] }));
  o2.enqueue(rec({ op: 'update', fields: { due: 'domani' } }));
  r = o2.toArray()[0];
  assert.deepEqual(r.fields, { t: 'x', done: true, due: 'domani' }); assert.equal(r.unset, undefined); assert.equal(r.base, 'b0');
  o2.enqueue(rec({ op: 'delete' }));
  assert.equal(o2.size, 1); assert.equal(o2.toArray()[0].op, 'delete'); assert.equal(o2.toArray()[0].fields, undefined);
});
test('outbox: cancellazione dopo creazione non sincronizzata annulla entrambe; con tombstone precedente no', () => {
  const o = new Outbox();
  o.enqueue(rec({ op: 'create', fields: { t: 'a' } }));
  assert.equal(o.enqueue(rec({ op: 'delete' })).kind, 'annihilated');
  assert.equal(o.size, 0);
  const o2 = new Outbox();
  o2.enqueue(rec({ op: 'delete' }));
  o2.enqueue(rec({ op: 'create', fields: { t: 'di nuovo' } }));
  assert.equal(o2.size, 1); assert.equal(o2.toArray()[0].op, 'create'); assert.equal(o2.toArray()[0].afterDelete, true);
  assert.equal(o2.enqueue(rec({ op: 'delete' })).kind, 'merged');
  assert.equal(o2.toArray()[0].op, 'delete', 'il server conosceva l\'entita\': la tombstone va inviata');
});
test('outbox: una voce gia\' in volo non si compatta; ack, release e rifiuti', () => {
  const o = new Outbox();
  const a = rec({ op: 'create', fields: { t: 'a' } });
  o.enqueue(a);
  const [taken] = o.take(10);
  assert.equal(taken.id, a.id);
  assert.equal(o.enqueue(rec({ op: 'update', fields: { t: 'b' } })).kind, 'added');
  assert.equal(o.size, 2);
  assert.equal(o.take(10).length, 1, 'quella in volo non si riprende');
  o.release([a.id], true);
  assert.equal(o.toArray().find((r) => r.id === a.id).attempts, 1);
  o.ack([a.id]);
  assert.equal(o.size, 1);
  assert.equal(o.dropWhere((r) => r.op === 'update'), 1);
});
test('outbox: take rispetta batch e dimensione massima', () => {
  const o = new Outbox();
  for (let i = 0; i < 50; i++) o.enqueue(rec({ entityId: 'e' + i, op: 'create', fields: { t: 'x'.repeat(1000) } }));
  assert.equal(o.take(20).length, 20);
  const small = o.take(100, () => true, 5000);
  assert.ok(small.length >= 1 && small.length <= 5);
});

// ---------- schema condiviso ----------
test('schema WireChange: accetta una busta valida, rifiuta campi extra e payload mancante', () => {
  const ok = { v: 1, id: uuidv7(), collection: 'life.tasks', schemaV: 1, entityId: 'e1', op: 'create', hlc: formatHlc(1_800_000_000_000, 0, 'A'), deviceId: 'A', seq: 1, codec: 'identity', payload: '{}' };
  assert.ok(wireChangeSchema.safeParse(ok).success);
  assert.ok(!wireChangeSchema.safeParse({ ...ok, extra: 1 }).success);
  assert.ok(!wireChangeSchema.safeParse({ ...ok, payload: undefined }).success);
  assert.ok(wireChangeSchema.safeParse({ ...ok, op: 'delete', payload: undefined }).success);
  assert.ok(!wireChangeSchema.safeParse({ ...ok, collection: 'tasks' }).success);
});

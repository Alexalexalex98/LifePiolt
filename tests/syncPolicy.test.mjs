import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRemote, metaAfterLocal, purgeTombstones, lastWrite } from '../src/sync/policy.ts';
import { formatHlc } from '../src/sync/clock.ts';
import { COLLECTIONS, collectionOf, registryProblems, categoryEligibility, syncCategories, EXCLUDED } from '../src/sync/registry.ts';
import { CATALOG } from '../src/lib/dataCatalog.ts';

const H = (n, node = 'A') => formatHlc(1_800_000_000_000 + n, 0, node);
const lww = { policy: 'lww' };

test('LWW per campo: campi diversi si fondono, lo stesso campo vince l\'HLC piu\' recente', () => {
  const local = { t: 'locale', due: 'lunedi' };
  const meta = { b: H(1), f: { t: H(5) } };
  // remoto: cambia due (piu' recente del base) e t (piu' vecchio del locale)
  const r = mergeRemote(lww, local, meta, { op: 'update', fields: { due: 'martedi', t: 'remoto' }, hlc: H(3) });
  assert.deepEqual(r.wire, { t: 'locale', due: 'martedi' });
  assert.equal(r.meta.f.due, H(3)); assert.equal(r.meta.f.t, H(5));
  assert.ok(r.changed);
  // stesso messaggio due volte: idempotente
  const r2 = mergeRemote(lww, r.wire, r.meta, { op: 'update', fields: { due: 'martedi', t: 'remoto' }, hlc: H(3) });
  assert.ok(!r2.changed); assert.deepEqual(r2.wire, r.wire);
});
test('LWW: l\'ordine di arrivo non conta (convergenza)', () => {
  const a = { op: 'update', fields: { t: 'A' }, hlc: H(2, 'A') }, b = { op: 'update', fields: { t: 'B' }, hlc: H(2, 'B') };
  const run = (order) => { let w = { t: 'x' }, m = { b: H(1) }; for (const c of order) { const r = mergeRemote(lww, w, m, c); w = r.wire; m = r.meta; } return w.t; };
  assert.equal(run([a, b]), run([b, a]));
  assert.equal(run([a, b]), 'B', 'a parita\' di tempo decide l\'id del nodo');
});
test('create su entita\' sconosciuta applica tutti i campi; update parziale senza campi obbligatori viene ignorato', () => {
  const def = { policy: 'lww', required: ['t'] };
  const r = mergeRemote(def, undefined, undefined, { op: 'create', fields: { t: 'nuovo', done: false }, hlc: H(1) });
  assert.deepEqual(r.wire, { t: 'nuovo', done: false }); assert.deepEqual(r.meta, { b: H(1) });
  const bad = mergeRemote(def, undefined, undefined, { op: 'update', fields: { done: true }, hlc: H(2) });
  assert.equal(bad.ignored, 'incomplete'); assert.equal(bad.wire, undefined);
});
test('campo rimosso (unset) segue LWW', () => {
  const r = mergeRemote(lww, { t: 'a', due: 'x' }, { b: H(1) }, { op: 'update', unset: ['due'], hlc: H(2) });
  assert.deepEqual(r.wire, { t: 'a' });
  const stale = mergeRemote(lww, { t: 'a', due: 'x' }, { b: H(1), f: { due: H(9) } }, { op: 'update', unset: ['due'], hlc: H(2) });
  assert.deepEqual(stale.wire, { t: 'a', due: 'x' });
});
test('tombstone: la cancellazione piu\' recente vince, una scrittura piu\' vecchia viene ignorata', () => {
  let r = mergeRemote(lww, { t: 'a' }, { b: H(1) }, { op: 'delete', hlc: H(5) });
  assert.equal(r.wire, undefined); assert.deepEqual(r.meta, { d: H(5) });
  const stale = mergeRemote(lww, undefined, r.meta, { op: 'update', fields: { t: 'b' }, hlc: H(3) });
  assert.equal(stale.ignored, 'tombstoned');
  const stale2 = mergeRemote(lww, undefined, r.meta, { op: 'create', fields: { t: 'b' }, hlc: H(4) });
  assert.equal(stale2.ignored, 'tombstoned');
  // delete duplicato: nessun cambiamento
  const dup = mergeRemote(lww, undefined, r.meta, { op: 'delete', hlc: H(5) });
  assert.ok(!dup.changed);
});
test('tombstone: una create piu\' recente resuscita; un update resuscita solo se la collezione ha aggiornamenti completi', () => {
  const m = { d: H(5) };
  const res = mergeRemote(lww, undefined, m, { op: 'create', fields: { t: 'tornata' }, hlc: H(8) });
  assert.deepEqual(res.wire, { t: 'tornata' }); assert.equal(res.meta.d, undefined);
  const delta = mergeRemote(lww, undefined, m, { op: 'update', fields: { t: 'x' }, hlc: H(8) });
  assert.equal(delta.ignored, 'tombstoned');
  const full = mergeRemote({ policy: 'lww', fullUpdates: true, required: ['text'] }, undefined, m, { op: 'update', fields: { text: 'modifica concorrente', date: 'oggi' }, hlc: H(8) });
  assert.equal(full.wire.text, 'modifica concorrente');
});
test('modifica concorrente a una cancellazione: nelle note vince la modifica, nei task la cancellazione; una ricreazione piu\' recente vince sempre', () => {
  const upd = { b: H(1), f: { t: H(9) } };
  assert.equal(mergeRemote({ policy: 'lww', fullUpdates: true }, { t: 'a' }, upd, { op: 'delete', hlc: H(5) }).ignored, 'newer-local');
  const del = mergeRemote(lww, { t: 'a' }, upd, { op: 'delete', hlc: H(5) });
  assert.equal(del.wire, undefined, 'task: la cancellazione batte la modifica concorrente');
  const recreated = mergeRemote(lww, { t: 'a' }, { b: H(9) }, { op: 'delete', hlc: H(5) });
  assert.equal(recreated.ignored, 'newer-local');
  // una modifica arrivata su un'entita' cancellata (task) e' ignorata; per le note usa la copia completa
  const full = mergeRemote({ policy: 'lww', fullUpdates: true, required: ['text'] }, undefined, { d: H(5) }, { op: 'update', fields: { date: 'x' }, full: { text: 'intero', date: 'x' }, hlc: H(8) });
  assert.deepEqual(full.wire, { text: 'intero', date: 'x' });
});
test('TTL delle tombstone: oltre il TTL si dimenticano, prima no', () => {
  const day = 86400000;
  const metas = { old: { d: formatHlc(1_000_000_000_000, 0, 'A') }, fresh: { d: formatHlc(1_000_000_000_000 + 80 * day, 0, 'A') }, live: { b: H(1) } };
  const n = purgeTombstones(metas, 1_000_000_000_000 + 100 * day, 90 * day);
  assert.equal(n, 1); assert.deepEqual(Object.keys(metas).sort(), ['fresh', 'live']);
});
test('unione di array (tag): le aggiunte concorrenti non si perdono', () => {
  const def = { policy: 'lww', fieldPolicies: { reactions: 'union' } };
  const r = mergeRemote(def, { reactions: ['a', 'b'] }, { b: H(1), f: { reactions: H(4) } }, { op: 'update', fields: { reactions: ['b', 'c'] }, hlc: H(3) });
  assert.deepEqual(r.wire.reactions, ['a', 'b', 'c']);
});
test('server-wins: il valore del server prevale anche se il locale e\' piu\' recente', () => {
  const def = { policy: 'server-wins' };
  const r = mergeRemote(def, { v: 5 }, { b: H(1), f: { v: H(50) } }, { op: 'update', fields: { v: 7 }, hlc: H(3) });
  assert.equal(r.wire.v, 7);
  const ignoredDelete = mergeRemote(def, { v: 5 }, { b: H(60) }, { op: 'delete', hlc: H(3) });
  assert.equal(ignoredDelete.wire, undefined, 'anche la cancellazione del server vince');
});
test('manual: modifiche concorrenti allo stesso testo -> vince l\'HLC, la versione perdente e\' segnalata (mai persa)', () => {
  const def = { policy: 'lww', fieldPolicies: { text: 'manual' }, fullUpdates: true };
  // il locale ha scritto dopo la base vista dall'autore remoto: concorrente
  const r = mergeRemote(def, { text: 'versione A' }, { b: H(1), f: { text: H(4) } }, { op: 'update', fields: { text: 'versione B' }, base: H(1), hlc: H(6) });
  assert.equal(r.wire.text, 'versione B');
  assert.deepEqual(r.conflicts.map((c) => [c.field, c.loserValue, c.remoteWon]), [['text', 'versione A', true]]);
  // il remoto e' piu' vecchio: il locale resta, la versione remota va in copia
  const r2 = mergeRemote(def, { text: 'versione A' }, { b: H(1), f: { text: H(9) } }, { op: 'update', fields: { text: 'versione B' }, base: H(1), hlc: H(6) });
  assert.equal(r2.wire.text, 'versione A');
  assert.deepEqual(r2.conflicts.map((c) => [c.loserValue, c.remoteWon]), [['versione B', false]]);
  // non concorrente (l'autore aveva gia' visto la nostra versione): si applica, nessun conflitto
  const r3 = mergeRemote(def, { text: 'versione A' }, { b: H(1), f: { text: H(4) } }, { op: 'update', fields: { text: 'A rivista' }, base: H(4), hlc: H(6) });
  assert.equal(r3.wire.text, 'A rivista'); assert.equal(r3.conflicts.length, 0);
  // stesso testo: nessun conflitto
  assert.equal(mergeRemote(def, { text: 'x' }, { b: H(1), f: { text: H(4) } }, { op: 'update', fields: { text: 'x' }, base: H(1), hlc: H(6) }).conflicts.length, 0);
});
test('insiemi: presenza con tombstone, le aggiunte concorrenti si uniscono', () => {
  const set = { policy: 'set' };
  const add = mergeRemote(set, undefined, undefined, { op: 'create', fields: {}, hlc: H(1) });
  assert.deepEqual(add.wire, {});
  const rem = mergeRemote(set, {}, add.meta, { op: 'delete', hlc: H(2) });
  assert.equal(rem.wire, undefined);
  const back = mergeRemote(set, undefined, rem.meta, { op: 'create', fields: {}, hlc: H(3) });
  assert.deepEqual(back.wire, {});
  const stale = mergeRemote(set, undefined, rem.meta, { op: 'create', fields: {}, hlc: H(1.5) });
  assert.equal(stale.ignored, 'tombstoned');
});
test('metaAfterLocal e lastWrite', () => {
  assert.deepEqual(metaAfterLocal(undefined, 'create', ['a'], [], H(1)), { b: H(1) });
  const m = metaAfterLocal({ b: H(1) }, 'update', ['a'], ['z'], H(2));
  assert.deepEqual(m.f, { a: H(2), z: H(2) }); assert.equal(lastWrite(m), H(2));
  assert.deepEqual(metaAfterLocal(m, 'delete', [], [], H(3)), { d: H(3) });
});

// ---------- registro e privacy ----------
test('registro: nessuna collezione punta a una categoria critica, bloccata o sconosciuta', () => {
  assert.deepEqual(registryProblems(), []);
  for (const c of COLLECTIONS) {
    const it = CATALOG.find((i) => i.id === c.category);
    assert.ok(it, c.name);
    assert.notEqual(it.sensitivity, 'critico', c.name);
  }
});
test('i dati critici non sono sincronizzabili: nessuna voce critica compare tra le categorie e categoryEligibility le rifiuta', () => {
  const critical = CATALOG.filter((i) => i.sensitivity === 'critico');
  assert.ok(critical.length >= 6);
  const cats = new Set(syncCategories().map((c) => c.id));
  for (const i of critical) { assert.ok(!cats.has(i.id), i.id); assert.equal(categoryEligibility(i.id).eligible, false, i.id); }
  for (const id of ['fin_cards', 'fin_csv', 'fin_accounts', 'fin_tax', 'health_clinical', 'doc_id', 'id_document']) assert.equal(categoryEligibility(id).eligible, false, id);
  // voci "sempre segrete" non critiche: bloccate comunque
  for (const id of ['plan_auto', 'loc_home', 'loc_search']) assert.equal(categoryEligibility(id).eligible, false, id);
  assert.equal(categoryEligibility('inesistente').eligible, false);
  assert.equal(categoryEligibility('plan_tasks').eligible, true);
});
test('le collezioni con dati dall\'altra persona richiedono la cifratura E2E', () => {
  for (const n of ['chat.messages', 'chat.chats', 'network.enrollments', 'network.bookings']) assert.ok(collectionOf(n).requiresE2E, n);
  assert.ok(!collectionOf('life.tasks').requiresE2E);
  assert.ok(EXCLUDED.length > 5 && EXCLUDED.every((e) => e.reason));
});
test('le note usano la politica manuale e aggiornamenti completi; follower e voti sono insiemi/server-wins', () => {
  const n = collectionOf('life.notes');
  assert.equal(n.fieldPolicies.text, 'manual'); assert.ok(n.fullUpdates);
  assert.equal(collectionOf('network.following').policy, 'set');
  assert.equal(collectionOf('network.votes').policy, 'server-wins');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/lib/dataCatalog.ts';
import * as E from '../src/lib/e2eModel.ts';

test('id unici e opzioni coerenti', () => {
  const ids = C.CATALOG.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const i of C.CATALOG) {
    assert.ok(i.options.length >= 1, i.id);
    assert.ok(i.options.some((o) => o.id === i.default), i.id + ' default');
    assert.ok(i.options.every((o) => o.hint && o.label), i.id);
    if (i.sensitivity === 'critico') assert.ok(i.options.every((o) => !o.shared), i.id + ' critico condiviso');
  }
});
test('i critici richiesti ci sono e sono segreti di default', () => {
  for (const id of ['fin_cards', 'fin_csv', 'fin_accounts', 'health_clinical', 'fin_tax']) {
    const it = C.itemOf(id);
    assert.equal(it.sensitivity, 'critico');
    assert.equal(C.optionOf(id, C.defaultChoices()).shared, false);
  }
});
test('un critico non può diventare condiviso', () => {
  const d = C.defaultChoices();
  assert.equal(C.setChoice(d, 'fin_cards', 'on').ok, false);
  assert.equal(C.isValidChoice('fin_cards', 'on'), false);
  const r = C.normalizeChoices({ fin_cards: 'on', fin_csv: 'xyz', ghost: 'on' });
  assert.equal(r.fin_cards, 'off');
  assert.equal(r.ghost, undefined);
});
test('default: meno importanti condivisi, il resto solo io', () => {
  const d = C.defaultChoices();
  assert.equal(C.optionOf('pub_name', d).shared, true);
  assert.equal(C.optionOf('pub_photo', d).shared, true);
  assert.equal(C.optionOf('pub_interests', d).shared, true);
  assert.equal(C.optionOf('pub_status', d).shared, true);
  for (const id of ['plan_notes', 'plan_mood', 'fin_invest', 'doc_drive', 'health_activity', 'fin_summary', 'loc_live', 'acc_email', 'card_phone']) assert.equal(C.optionOf(id, d).shared, false, id);
});
test('E2E: seminari/sedute sono end-to-end e mai pubblici', () => {
  for (const id of ['net_enroll', 'net_sessions', 'net_docs']) {
    const it = C.itemOf(id);
    assert.equal(it.e2e, true);
    assert.equal(it.where, 'cifrato end-to-end con l\'altra persona');
    assert.equal(it.status, 'predisposto');
  }
  assert.equal(E.E2E_ACTIVE, false);
  assert.match(E.e2eLabel(), /predisposta/);
});
test('riepilogo e diff', () => {
  const d = C.defaultChoices();
  const s = C.summarize(d);
  assert.equal(s.types, C.CATALOG.length);
  assert.equal(s.shared + s.secret, s.types);
  assert.equal(s.changed, 0);
  const r = C.setChoice(d, 'plan_notes', 'on');
  assert.ok(r.ok);
  assert.deepEqual(C.diffFromDefaults(r.choices), ['plan_notes']);
  assert.equal(C.summarize(r.choices).shared, s.shared + 1);
});
test('voci bloccate non cambiano', () => {
  const d = C.defaultChoices();
  assert.equal(C.setChoice(d, 'net_posts', 'off').ok, false);
  const p = C.allPrivate(d);
  assert.equal(p.net_posts, 'on');
  assert.equal(p.pub_name, 'off');
  assert.equal(p.plan_agenda, 'off');
  assert.deepEqual(C.diffFromDefaults(C.defaultChoices()), []);
});
test('agenda: livello massimo', () => {
  assert.equal(C.agendaAllows('free', 'liberi'), true);
  assert.equal(C.agendaAllows('free', 'dettagli'), false);
  assert.equal(C.agendaAllows('busy', 'occupato'), true);
  assert.equal(C.agendaAllows('full', 'dettagli'), true);
  assert.equal(C.agendaAllows('off', 'liberi'), false);
  assert.equal(C.agendaMaxMode('off'), null);
  assert.equal(C.agendaMaxMode('busy'), 'occupato');
});
test('ricerca e filtro solo condivisi', () => {
  const d = C.defaultChoices();
  assert.ok(C.filterItems('carte', false, d).some((i) => i.id === 'fin_cards'));
  assert.ok(C.filterItems('', true, d).every((i) => C.optionOf(i.id, d).shared));
  assert.equal(C.filterItems('zzzz', false, d).length, 0);
  const g = C.groupBySensitivity(C.CATALOG);
  assert.deepEqual(g.map((x) => x.sensitivity), ['critico', 'sensibile', 'normale', 'pubblico']);
});
test('sha256 e numero di sicurezza', () => {
  assert.equal(E.sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(E.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(E.sha256Hex('a'.repeat(1000)), '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
  const n = E.safetyNumber('AAA', 'BBB');
  assert.match(n, /^\d{5}( \d{5}){5}$/);
  assert.equal(n, E.safetyNumber('BBB', 'AAA'));
  assert.notEqual(n, E.safetyNumber('AAA', 'BBC'));
});

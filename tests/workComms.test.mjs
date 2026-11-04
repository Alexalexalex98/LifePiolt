import test from 'node:test';
import assert from 'node:assert/strict';
import { priorityOf, summarize, draftReplies, fillTemplate, TEMPLATES, mentionIds, autoReply } from '../src/lib/workComms.ts';

test('priorità dei messaggi', () => {
  assert.equal(priorityOf('Grazie!'), 'ignore');
  assert.equal(priorityOf('Serve subito il file del cliente', { mentionsMe: true }), 'urgent');
  assert.equal(priorityOf('Puoi mandarmi il preventivo entro venerdì?', { mentionsMe: true }), 'todo');
  assert.equal(priorityOf('Oggi la sala è chiusa per lavori'), 'info');
  assert.equal(priorityOf('Urgente: server fermo', {}), 'todo');
});
test('riassunto tiene le frasi con date e numeri', () => {
  const r = summarize(['Ciao a tutti. Ieri è andata bene. La consegna è fissata per venerdì. Il budget è di 1200 CHF. Grazie mille per il lavoro. Buon proseguimento.'], 3);
  assert.equal(r.length, 3);
  assert.ok(r.some((x) => /venerdì/.test(x))); assert.ok(r.some((x) => /1200/.test(x)));
  assert.deepEqual(summarize(['Una frase sola.']), ['Una frase sola.']);
});
test('risposte pronte', () => {
  assert.equal(draftReplies('Grazie').length, 3);
  assert.match(draftReplies('Puoi inviarmi il report?', { due: 'venerdì' })[0], /entro venerdì/);
  assert.match(draftReplies('Riunione domani alle 10')[0], /va bene/);
});
test('modelli e segnaposto', () => {
  const t = TEMPLATES.find((x) => x.id === 'sollecito');
  assert.equal(fillTemplate(t.text, { nome: 'Rossi', importo: '500 CHF' }).includes('500 CHF'), true);
  assert.match(fillTemplate('Ciao {nome}', {}), /\[nome\]/);
});
test('menzioni e assenza', () => {
  const ppl = [{ id: 'a', name: 'Giulia Verdi' }, { id: 'b', name: 'Marco' }];
  assert.deepEqual(mentionIds('Ciao @Giulia e @marco!', ppl).sort(), ['a', 'b']);
  assert.deepEqual(mentionIds('niente', ppl), []);
  assert.match(autoReply({ until: '2026-12-31', message: 'Per urgenze scrivi a Marco.' }, '2026-12-20', 'Giulia'), /31\/12/);
  assert.equal(autoReply({ until: '2026-12-01', message: '' }, '2026-12-20', 'Giulia'), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { todoSubject, isAddFollowUp } from '../src/lib/assistant/followup.ts';

test('«Devo fare la spesa» ha come argomento «Fare la spesa»', () => {
  assert.equal(todoSubject('Devo fare la spesa'), 'Fare la spesa');
  assert.equal(todoSubject('Ricordami di chiamare Marco'), 'Chiamare Marco');
  assert.equal(todoSubject('dovrei prenotare il dentista.'), 'Prenotare il dentista');
});
test('non sono argomenti: domande, saluti, richieste di salvare', () => {
  assert.equal(todoSubject('Voglio vedere le spese'), null);
  assert.equal(todoSubject('Devo mettere la task'), null);
  assert.equal(todoSubject('Come sto oggi?'), null);
});
test('seguiti: «Devo mettere la task», «aggiungila ai task», «sì aggiungi»', () => {
  for (const s of ['Devo mettere la task', 'aggiungila ai task', 'mettilo nei promemoria', 'sì aggiungi', 'metti la task', 'Aggiungi il task']) assert.ok(isAddFollowUp(s), s);
});
test('non è un seguito se porta un argomento nuovo', () => {
  for (const s of ['aggiungi task comprare latte', 'metti un promemoria per il dentista domani', 'aggiungi una nota']) assert.ok(!isAddFollowUp(s), s);
});

import { taskCommand, friendlyAiError } from '../src/lib/assistant/followup.ts';
test('«task spesa» è un task; frasi normali no', () => {
  assert.equal(taskCommand('task spesa'), 'Spesa');
  assert.equal(taskCommand('Nuovo task: chiamare Marco'), 'Chiamare Marco');
  assert.equal(taskCommand('promemoria dentista'), 'Dentista');
  assert.equal(taskCommand('come sto andando'), null);
});
test('errori del server AI spiegati in italiano', () => {
  assert.match(friendlyAiError('This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.'), /molto richiesto/);
  assert.match(friendlyAiError('429 Too Many Requests'), /minuto/);
  assert.equal(friendlyAiError('Qualcosa di strano'), 'Qualcosa di strano');
});

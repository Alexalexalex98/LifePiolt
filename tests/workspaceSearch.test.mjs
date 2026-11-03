import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkDocs, contextFor, rank, tokens } from '../src/lib/workspaceSearch.ts';
const docs = [
  { id: 'a', source: 'Contratto fornitore', text: 'Il fornitore consegna entro 30 giorni.\nPenale del 2% per ogni settimana di ritardo.' },
  { id: 'b', source: 'Riunione del 3 novembre', text: 'Si decide il budget marketing: 12000 franchi.\nProssimo passo: preventivo agenzia.' },
  { id: 'c', source: 'Ricette', text: 'Pasta al pomodoro con basilico.' },
];
test('token: senza parole vuote e accenti', () => { assert.deepEqual(tokens('Qual è la penale del ritardo?'), ['qual', 'penale', 'ritardo']); });
test('trova il documento giusto', () => {
  assert.equal(rank('quanto è la penale per il ritardo', chunkDocs(docs))[0].docId, 'a');
  assert.equal(rank('budget marketing', chunkDocs(docs))[0].docId, 'b');
});
test('contesto con fonti e limite di dimensione', () => {
  const c = contextFor('penale ritardo fornitore', docs); assert.deepEqual(c.sources, ['Contratto fornitore']); assert.match(c.text, /### Contratto fornitore/);
  const big = [{ id: 'x', source: 'Grande', text: Array.from({ length: 200 }, (_, i) => `riga ${i} penale`).join('\n') }];
  assert.ok(contextFor('penale', big, 3000).text.length <= 3200);
  assert.equal(contextFor('zzz', docs).text, '');
});

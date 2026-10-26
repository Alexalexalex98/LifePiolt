import test from 'node:test';
import assert from 'node:assert/strict';
import { closeSession, consolidate, memoryFor, compactMessages } from '../src/lib/assistant/memory.ts';

const D = 86400000;
const now = Date.UTC(2026, 9, 26);
const msgs = (ts, topic, pairs) => pairs.flatMap(([q, a], i) => [{ who: 'me', text: q, ts: ts + i * 1000, topic }, { who: 'ai', text: a, ts: ts + i * 1000 + 500, topic }]);
let n = 0; const id = () => `m${n++}`;

test('compatta una conversazione in una riga per argomento', () => {
  const log = [...msgs(now - 5 * D, 'Finanze', [['Voglio mettere da parte 400 franchi al mese per la vacanza', 'Va bene. Ti propongo di partire da marzo.']]), ...msgs(now - 5 * D + 60000, 'Salute', [['Dormo poco da una settimana', 'Capito. Nel sonno conta la regolarità.']])];
  const out = closeSession(log, 0, id);
  assert.equal(out.length, 2);
  assert.ok(out.find((m) => m.topic === 'Finanze').text.includes('400 franchi'));
  assert.ok(closeSession(log, now, id).length === 0);
});

test('il testo compatto resta entro il limite', () => {
  const big = msgs(now, 'Lavoro', Array.from({ length: 40 }, (_, i) => [`Domanda numero ${i} su un progetto molto lungo da raccontare per bene`, 'Risposta lunga. Altro testo.']));
  assert.ok(compactMessages(big).length <= 640);
});

test('i ricordi vecchi si fondono in mesi e anni', () => {
  const mk = (t, text) => ({ id: id(), topic: 'Viaggi', kind: 's', from: t, to: t, n: 2, text });
  const memos = [mk(now - 60 * D, 'a'), mk(now - 61 * D, 'b'), mk(now - 400 * D, 'c'), mk(now - 410 * D, 'd'), mk(now - 2 * D, 'recente')];
  const out = consolidate(memos, now);
  assert.ok(out.some((m) => m.kind === 'y' && m.text.includes('c') && m.text.includes('d')));
  assert.ok(out.some((m) => m.kind === 'm'));
  assert.ok(out.some((m) => m.kind === 's' && m.text === 'recente'));
  assert.ok(out.length < memos.length);
});

test('nel prompt entrano i ricordi pertinenti, con data, entro il budget', () => {
  const memos = [
    { id: '1', topic: 'Viaggi', kind: 'y', from: now - 380 * D, to: now - 380 * D, n: 4, text: 'Voglio visitare il Giappone in primavera, budget 3000 franchi' },
    { id: '2', topic: 'Cucina', kind: 's', from: now - 100 * D, to: now - 100 * D, n: 4, text: 'Ricetta del risotto allo zafferano' },
  ];
  const r = memoryFor(memos, 'quanto avevo deciso di spendere per il Giappone?', 2600, now);
  assert.ok(r.includes('Giappone'));
  assert.ok(/\[\d{4}/.test(r));
  assert.ok(memoryFor(memos, 'x', 60, now).length <= 120);
  assert.equal(memoryFor([], 'ciao', 2600, now), '');
});

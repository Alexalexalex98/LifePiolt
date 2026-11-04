import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDue, nextOccurrence, buildMinutes, actionsOf } from '../src/lib/meetings.ts';

const MON = new Date(2026, 10, 2, 9); // lunedì 2 novembre 2026
test('scadenze dette a voce', () => {
  assert.equal(resolveDue('entro domani', MON), '2026-11-03');
  assert.equal(resolveDue('entro venerdì', MON), '2026-11-06');
  assert.equal(resolveDue('lunedì', MON), '2026-11-09');
  assert.equal(resolveDue('entro fine mese', MON), '2026-11-30');
  assert.equal(resolveDue('entro il 15', MON), '2026-11-15');
  assert.equal(resolveDue('entro 20/11', MON), '2026-11-20');
  assert.equal(resolveDue('entro il 1 marzo', MON), '2027-03-01');
  assert.equal(resolveDue('quando puoi', MON), null);
  assert.equal(resolveDue(undefined, MON), null);
});
test('ricorrenza', () => {
  assert.equal(nextOccurrence('2026-11-02', 'weekly'), '2026-11-09');
  assert.equal(nextOccurrence('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(nextOccurrence('2026-11-02', 'none'), null);
});
test('verbale e azioni', () => {
  const notes = { decisions: [{ text: 'Si parte lunedì', speaker: 'Giulia', at: 1000 }], actions: [{ text: 'Preparo i testi', owner: 'Giulia', due: 'entro venerdì', at: 2000 }, { text: 'Prenotiamo la sala', owner: 'Tutti', at: 3000 }], questions: [], facts: [] };
  const m = buildMinutes({ title: 'Avvio', day: '2026-11-02', time: '09:30', names: ['Alex', 'Giulia'], agenda: '1. Tempi', notes, lines: [], nameOf: (x) => x });
  assert.match(m, /Verbale: Avvio/); assert.match(m, /Decisioni\n- Si parte lunedì \(Giulia\)/); assert.match(m, /Ordine del giorno\n1\. Tempi/);
  const a = actionsOf(notes, 'Alex', MON);
  assert.deepEqual(a.map((x) => [x.due, x.mine]), [['2026-11-06', false], [null, true]]);
});

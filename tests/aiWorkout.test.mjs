import test from 'node:test';
import assert from 'node:assert/strict';
import { extractWorkout, parseAiWorkout, workoutSummary, workoutTalk, findExercise } from '../src/lib/fitness/aiWorkout.ts';

const J = { nuovo: true, titolo: 'Forza a casa', obiettivo: 'forza', livello: 'intermedio', luogo: 'casa', giorni: 3, settimane: 8, note: 'Aumenta le ripetizioni ogni settimana.', sessioni: [
  { n: 'Giorno A · Gambe', es: [{ n: 'Squat a corpo libero', s: 4, r: 12, rec: 60 }, { n: 'Plank', s: 3, t: 40 }, { n: 'Salto del gatto laterale', s: 3, r: 10, m: 'gambe', a: 'nessuno', come: 'Salta di lato.' }] },
  { n: 'Giorno B · Spinta', es: [{ n: 'Flessioni', s: 4, r: 10 }, { n: 'esercizio senza serie', s: 0, r: 0 }] }] };

test('estrae il blocco', () => { const r = extractWorkout(`Ecco.\n[[ALLENAMENTO ${JSON.stringify(J)}]]`); assert.equal(r.text, 'Ecco.'); assert.ok(r.json); });
test('programma letto: esercizi noti, a tempo e nuovi', () => {
  const r = parseAiWorkout(J);
  const p = r.program; assert.ok(p);
  assert.equal(p.name, 'Forza a casa'); assert.equal(p.goal, 'forza'); assert.equal(p.level, 'intermedio'); assert.equal(p.sessions.length, 2); assert.equal(r.fresh, true);
  const plank = p.sessions[0].steps[1]; assert.equal(plank.secs, 40); assert.equal(plank.reps, undefined);
  assert.equal(r.custom.length, 1); assert.equal(p.sessions[0].steps[2].ex, r.custom[0].id);
  assert.equal(p.sessions[1].steps.length, 1); assert.ok(r.warnings.length >= 1);
});
test('aggiornamento: stesso id', () => { const r = parseAiWorkout({ ...J, nuovo: undefined }, [], 'ai-x'); assert.equal(r.program.id, 'ai-x'); assert.equal(r.fresh, false); });
test('senza sessioni valide: nessun programma', () => { assert.equal(parseAiWorkout({ sessioni: [] }).program, null); });
test('riassunto e riconoscimento della conversazione', () => {
  const r = parseAiWorkout(J); assert.match(workoutSummary(r.program, r.custom), /Giorno A/);
  assert.equal(workoutTalk('vorrei una scheda di allenamento', [], false), true);
  assert.equal(workoutTalk('sostituisci gli affondi con altro', [], true), false);
  assert.equal(workoutTalk('cambia gli esercizi del giorno B', [], true), true);
  assert.equal(workoutTalk('che tempo fa', [], true), false);
  assert.ok(findExercise('squat'));
});

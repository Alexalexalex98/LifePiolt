import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_EXERCISES, searchExercises, exById, makeCustom, guideOf } from '../src/lib/fitness/exerciseDb.ts';
import { FAMILIES, figurePanels, FAMILY_IDS } from '../src/lib/fitness/poses.ts';
import { PROGRAMS, EXERCISES } from '../src/lib/fitness/data.ts';
import { checkPrompt, parseCheck, frameTimes } from '../src/lib/fitness/execCheck.ts';
import { stepsOf, sessionMinutes, newStep, whyThis, recommend } from '../src/lib/fitness/plan.ts';

test('archivio: oltre 200 esercizi, id unici, tutti con famiglia valida', () => {
  assert.ok(ALL_EXERCISES.length >= 200, String(ALL_EXERCISES.length));
  assert.equal(new Set(ALL_EXERCISES.map((e) => e.id)).size, ALL_EXERCISES.length);
  for (const e of ALL_EXERCISES) { assert.ok(e.fam && FAMILIES[e.fam], `${e.id}: famiglia ${e.fam}`); assert.ok(e.how.length > 15, e.id); }
});
test('gli esercizi dei programmi esistono ancora', () => {
  for (const p of PROGRAMS) for (const s of p.sessions) for (const st of s.steps) assert.ok(exById(st.ex), `${p.id}: ${st.ex}`);
  assert.ok(EXERCISES.every((e) => exById(e.id)));
});
test('ogni famiglia ha pose valide, punti chiave ed errori', () => {
  for (const id of FAMILY_IDS) {
    const f = FAMILIES[id]; const pan = figurePanels(f);
    assert.equal(pan.length, f.b ? 2 : 1, id);
    for (const p of pan) for (const l of p.lines) for (const v of [...l.a, ...l.b]) assert.ok(Number.isFinite(v) && v > -20 && v < 120, `${id}: coordinata ${v}`);
    assert.ok(f.cues.length >= 3 && f.mistakes.length >= 2, id);
  }
});
test('ricerca per nome, muscolo e attrezzo; esercizi creati dall\'utente', () => {
  assert.ok(searchExercises({ q: 'squat' }).length >= 10);
  assert.ok(searchExercises({ q: 'curl', equip: 'manubri' }).every((e) => e.equip === 'manubri'));
  assert.ok(searchExercises({ muscle: 'schiena' }, [], 500).every((e) => e.muscle === 'schiena'));
  const c = makeCustom({ name: 'Il mio esercizio', muscle: 'core', equip: 'nessuno', how: 'Faccio così', fam: 'plank' }, 'c1');
  assert.ok(c && c.custom);
  assert.equal(searchExercises({ q: 'mio' }, [c])[0].id, 'c1');
  assert.equal(makeCustom({ name: ' ', muscle: 'core', equip: 'nessuno', how: '' }, 'x'), null);
  assert.ok(guideOf(c).cues.length > 2);
});
test('modifiche alle sessioni: passi e durata', () => {
  const p = PROGRAMS[0];
  const edits = { [`${p.id}:0`]: [newStep({ id: 'plank', timed: true }), newStep({ id: 'squat' })] };
  assert.equal(stepsOf(p, 0, edits).length, 2);
  assert.equal(stepsOf(p, 0).length, p.sessions[0].steps.length);
  assert.ok(sessionMinutes(p, 0, edits) >= 5);
});
test('perché un programma: motivi in parole', () => {
  const f = { goal: 'tonificare', level: 'principiante', place: 'casa', days: 3, minutes: 30 };
  const [best] = recommend(f, 1);
  const why = whyThis(best, f);
  assert.ok(why.length >= 4); assert.ok(why.some((x) => /obiettivo|Obiettivo/.test(x)));
});
test('controllo esecuzione: domanda, fotogrammi e lettura della risposta', () => {
  const q = checkPrompt(exById('squat'));
  assert.match(q, /Squat/); assert.match(q, /VERDETTO/); assert.match(q, /Punti chiave/);
  const t = frameTimes(10000); assert.equal(t.length, 6); assert.ok(t[0] > 0 && t[5] < 10000);
  const r = parseCheck('VERDETTO: Quasi corretta\nBENE:\n- schiena dritta\n- profondità giusta\nDA CORREGGERE:\n- ginocchia verso l\'interno: spingile in fuori');
  assert.equal(r.verdict, 'quasi'); assert.equal(r.good.length, 2); assert.equal(r.fix.length, 1);
  assert.equal(parseCheck('Non so').verdict, 'incerto');
});

import { EXTRA_PROGRAMS, ALL_PROGRAMS, PARSE_ERRORS, NEEDS, searchPrograms } from '../src/lib/fitness/programsExtra.ts';
test('schede su misura: almeno 80, tutte valide e con ragioni', () => {
  assert.deepEqual(PARSE_ERRORS, []);
  assert.ok(EXTRA_PROGRAMS.length >= 80, String(EXTRA_PROGRAMS.length));
  assert.equal(new Set(ALL_PROGRAMS.map((p) => p.id)).size, ALL_PROGRAMS.length);
  const needs = new Set(NEEDS.map((n) => n.id));
  for (const p of EXTRA_PROGRAMS) {
    assert.ok(p.sessions.length >= 2 || ['mattina-5', 'sonno'].includes(p.id), `${p.id}: sessioni`);
    assert.ok(p.who && p.who.length > 40, `${p.id}: per chi`);
    assert.ok(p.why && p.why.length > 40, `${p.id}: perché`);
    assert.ok(p.tags?.length, `${p.id}: bisogni`);
    for (const t of p.tags) assert.ok(needs.has(t), `${p.id}: bisogno ${t}`);
    for (const [i, s] of p.sessions.entries()) {
      assert.ok(s.steps.length >= 2, `${p.id}/${i}: passi`);
      for (const st of s.steps) { assert.ok(exById(st.ex), `${p.id}: ${st.ex}`); assert.ok(st.sets >= 1 && st.sets <= 10); assert.ok((st.reps ?? 0) <= 30 && (st.secs ?? 0) <= 4500); }
      const m = sessionMinutes(p, i);
      assert.ok(m >= 5 && m <= 110, `${p.id}/${i}: ${m} min`);
    }
  }
});
test('condizioni delicate: sempre un avviso e mai esercizi inadatti', () => {
  for (const id of ['postparto-1', 'postparto-2', 'gravidanza-1', 'gravidanza-3', 'cuore-cammino', 'ipertensione', 'diabete2', 'over70-sedia', 'over75-autonomia', 'artrosi-ginocchia']) {
    const p = ALL_PROGRAMS.find((x) => x.id === id); assert.ok(p?.caution && p.caution.length > 20, id);
  }
  const noJump = ['sovrappeso-casa', 'artrosi-ginocchia', 'over65-equilibrio', 'over70-sedia', 'gravidanza-1', 'gravidanza-3', 'postparto-1', 'cuore-cammino'];
  const bad = /salt|burpee|corsa|box-jump|pliom|battito/;
  for (const id of noJump) for (const s of ALL_PROGRAMS.find((x) => x.id === id).sessions) for (const st of s.steps) assert.ok(!bad.test(st.ex), `${id}: ${st.ex}`);
  const noFloorProne = ['gravidanza-1', 'gravidanza-3'];
  for (const id of noFloorProne) for (const s of ALL_PROGRAMS.find((x) => x.id === id).sessions) for (const st of s.steps) assert.ok(!/superman|crunch|plank|ab-wheel|pushup|flessioni/.test(st.ex), `${id}: ${st.ex}`);
});
test('i bisogni indicati portano in cima la scheda giusta', () => {
  const f = { goal: 'salute', level: 'principiante', place: 'casa', days: 3, minutes: 25 };
  assert.equal(recommend({ ...f, needs: ['cervicale'.replace('cervicale', 'collo-spalle'), 'sedentario'] }, 1)[0].tags.includes('collo-spalle'), true);
  assert.equal(recommend({ ...f, needs: ['postpartum'] }, 1)[0].tags.includes('postpartum'), true);
  assert.ok(searchPrograms('tennis', null).some((p) => p.id === 'racchetta'));
  assert.ok(searchPrograms('', 'corsa').length >= 4);
});

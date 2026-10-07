import test from 'node:test';
import assert from 'node:assert/strict';
import { Assistant } from '../src/lib/assistant/engine.ts';

function mkEnv() {
  const st = { events: { '2026-10-08': [{ time: '15:00', title: 'Dentista' }] }, tasks: [], priv: false };
  const env = {
    now: () => new Date(2026, 9, 7, 10, 0),
    events: () => st.events,
    addEvent: (d, e) => { (st.events[d] ??= []).push(e); },
    delEvent: (d, e) => { st.events[d] = (st.events[d] ?? []).filter((x) => !(x.time === e.time && x.title === e.title)); },
    tasks: () => st.tasks,
    addTask: (t) => { const id = String(st.tasks.length + 1); st.tasks.push({ id, t }); return id; },
    setTaskDone: (id, v) => { st.tasks.find((t) => t.id === id).done = v; },
    delTask: (id) => { const t = st.tasks.find((x) => x.id === id) ?? null; st.tasks = st.tasks.filter((x) => x.id !== id); return t; },
    restoreTask: (t) => { st.tasks.push(t); },
    renameTask: (id, t) => { st.tasks.find((x) => x.id === id).t = t; },
    addNote() {}, addGoal() {}, logMood() {},
    workHours: () => ({ start: '09:00', end: '18:00' }), setWorkHours() {}, setDark() {}, setNotifications() {},
    setPrivateProfile: (on) => { st.priv = on; }, isPrivateProfile: () => st.priv,
    pickProfilePhoto: async () => true,
    financeReport: () => 'fin', healthReport: () => 'sal', moodReport: () => 'umore',
    shareAgenda: () => null, userName: () => 'Alex',
  };
  return { env, st };
}

test('aggiungere al piano: chiede quando', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  const r1 = await a.handle('aggiungi riunione al piano');
  assert.ok(r1.handled && /quando|giorno/i.test(r1.text));
  await a.handle('domani alle 17');
  assert.ok(st.events['2026-10-08'].some((e) => e.title.toLowerCase().includes('riunione') && e.time === '17:00'));
});

test('conflitto: propone di cambiare o spostare, poi annulla', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  const r = await a.handle('aggiungi riunione al piano domani alle 15');
  assert.ok(/Dentista/.test(r.text));
  assert.ok(r.chips?.some((c) => /Cambia giorno/i.test(c)));
  assert.ok(r.chips?.some((c) => /Sposta/i.test(c)));
  await a.handle('Tieni entrambi');
  assert.equal(st.events['2026-10-08'].length, 2);
  const u = await a.handle('annulla');
  assert.ok(u.handled);
  assert.equal(st.events['2026-10-08'].length, 1);
});

test('task, privacy', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  await a.handle('aggiungi task comprare il latte');
  assert.equal(st.tasks.length, 1);
  await a.handle('rendi il mio profilo privato');
  assert.equal(st.priv, true);
  const r = await a.handle('blabla qwerty');
  assert.equal(r.handled, false);
});

test('un comando diverso interrompe la domanda in sospeso', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  await a.handle('aggiungi riunione al piano');
  assert.ok(a.pending);
  const r = await a.handle('rendi privato il mio profilo');
  assert.ok(r.handled && st.priv === true && !a.pending);
});

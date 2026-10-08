import test from 'node:test';
import assert from 'node:assert/strict';
import { Assistant } from '../src/lib/assistant/engine.ts';

function mkEnv() {
  const st = { events: { '2026-10-08': [{ time: '15:00', title: 'Dentista' }] }, tasks: [], priv: false };
  const env = {
    now: () => new Date(2026, 9, 7, 10, 0),
    events: () => st.events,
    addEvent: (d, e) => { (st.events[d] ??= []).push({ ...e }); },
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
    shareAgenda: (p) => (p === 'Marco' ? 'Inviata a Marco' : null), people: () => ['Marco T.', 'Giulia M.'],
    setTaskDue: (id, d) => { st.tasks.find((t) => t.id === id).due = d; },
    addRecurring: (day, ev, until, kind) => { const ref = 'rec:' + (st.n = (st.n || 0) + 1); const d = new Date(day + 'T00:00:00'); const end = new Date(until + 'T00:00:00'); const step = kind === 'weekly' ? 7 : 1; while (d <= end) { const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); (st.events[k] ??= []).push({ ...ev, ref }); d.setDate(d.getDate() + step); } return ref; },
    delByRef: (ref) => { for (const k of Object.keys(st.events)) st.events[k] = st.events[k].filter((e) => e.ref !== ref); },
    briefing: () => ({ title: 'Buongiorno, Alex', body: 'Oggi hai 1 impegno.' }),
    setTaskUrgent: (id, v) => { st.tasks.find((t) => t.id === id).urgent = v; }, setEventImportant: () => {}, userName: () => 'Alex',
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

test('scegli tu: sceglie l\'algoritmo', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  await a.handle('aggiungi riunione al piano');
  const r = await a.handle('scegli tu secondo quando mi è più comodo');
  assert.ok(/L’ho scelto io/.test(r.text), r.text);
  const all = Object.values(st.events).flat();
  assert.ok(all.some((e) => e.title.toLowerCase().includes('riunione')));
  assert.ok(!a.pending);
});

test('pianificami il mese: anteprima, applica, annulla', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  await a.handle('aggiungi task completare business plan');
  const before = Object.values(st.events).flat().length;
  const r = await a.handle('pianificami tutto il mese');
  assert.ok(r.chips?.includes('Applica'), r.text);
  assert.equal(Object.values(st.events).flat().length, before);
  await a.handle('Applica');
  assert.ok(Object.values(st.events).flat().length > before + 10);
  await a.handle('annulla');
  assert.equal(Object.values(st.events).flat().length, before);
});

test('cosa devo fare adesso: urgente e collegamenti', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  st.events['2026-10-08'].push({ time: '17:30', title: 'Chiamata investitori' });
  await a.handle('aggiungi task comprare il latte');
  await a.handle('aggiungi task completare business plan');
  const r = await a.handle('cosa devo fare adesso?');
  assert.match(r.text, /business plan/i);
  assert.match(r.text, /investitori/i);
  await a.handle('segna comprare il latte come urgente');
  const r2 = await a.handle('quale task faccio prima?');
  assert.match(r2.text, /latte/i);
});

test('frase all\'infinito: propone task', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  const r = await a.handle('Chiamare commercialista');
  assert.ok(r.handled && r.chips?.includes('Aggiungi come task'));
  await a.handle('Aggiungi come task');
  assert.equal(st.tasks.length, 1);
});

test('condividi agenda: chiede a chi', async () => {
  const { env } = mkEnv(); const a = new Assistant(env);
  const r = await a.handle('Condividi la mia agenda');
  assert.ok(/A chi/.test(r.text) && r.chips?.includes('Marco T.'));
});

test('non resta bloccato in un giro', async () => {
  const { env } = mkEnv(); const a = new Assistant(env);
  await a.handle('aggiungi riunione al piano domani');
  await a.handle('boh'); await a.handle('mah'); await a.handle('uffa');
  assert.ok(!a.pending);
});

test('i chip delle anteprime non vengono scambiati per nuovi comandi', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  await a.handle('pianificami il mese');
  const r = await a.handle('Più slot liberi');
  assert.ok(r.chips?.includes('Applica'), r.text);
  await a.handle('Applica');
  assert.ok(Object.values(st.events).flat().length > 10);
  await a.handle('Chiamare commercialista');
  await a.handle('Aggiungi come task');
  assert.equal(st.tasks[0].t, 'Chiamare commercialista');
});

test('impegno ricorrente da chat e annulla', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  const r = await a.handle('ogni martedì alle 18 palestra');
  assert.ok(/ogni/.test(r.text), r.text);
  const n = Object.values(st.events).flat().filter((e) => e.ref).length;
  assert.ok(n >= 12, String(n));
  await a.handle('annulla');
  assert.equal(Object.values(st.events).flat().filter((e) => e.ref).length, 0);
});

test('luogo e avviso di spostamento', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  await a.handle('aggiungi riunione a Lugano domani alle 10');
  assert.equal(st.events['2026-10-08'].find((e) => e.title.includes('Riunione')).place, 'Lugano');
  const r = await a.handle('aggiungi call con cliente a Zurigo domani alle 11');
  assert.ok(/ne servono circa 150/.test(r.text), r.text);
});

test('scadenza del task e riferimento "quello"', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  await a.handle('aggiungi task preparare relazione entro venerdì');
  assert.equal(st.tasks[0].due, '2026-10-09');
  await a.handle('aggiungi task comprare latte');
  await a.handle('il task relazione scade lunedì');
  assert.equal(st.tasks[0].due, '2026-10-12');
});

test('riferimenti agli impegni: "spostala", "a che ora?"', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  const q = await a.handle('a che ora è il dentista?');
  assert.match(q.text, /15:00/);
  await a.handle('sposta il dentista a venerdì alle 11');
  assert.ok(st.events['2026-10-09'].some((e) => e.title === 'Dentista'));
  const r = await a.handle('spostala a lunedì alle 9');
  assert.ok(st.events['2026-10-12']?.some((e) => e.title === 'Dentista'), r.text);
});

test('ripianifica le sessioni saltate', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  await a.handle('aggiungi task business plan');
  st.events['2026-10-06'] = [{ time: '10:30', title: 'Lavoro su: Business plan', dur: 60 }];
  const r = await a.handle('ripianifica le sessioni saltate');
  assert.ok(r.chips?.includes('Applica'), r.text);
  await a.handle('Applica');
  assert.equal((st.events['2026-10-06'] ?? []).length, 0);
  assert.ok(Object.values(st.events).flat().some((e) => e.title === 'Lavoro su: Business plan'));
});

test('briefing', async () => {
  const { env } = mkEnv(); const a = new Assistant(env);
  const r = await a.handle('riepilogo della giornata');
  assert.match(r.text, /Buongiorno, Alex/);
});

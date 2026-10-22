import test from 'node:test';
import assert from 'node:assert/strict';
import { planWeek } from '../src/lib/theia/week.ts';

const now = new Date(2026, 9, 21, 8, 0); // mer 21 ott, 08:00
const base = { now, events: {}, shifts: [], workStart: '09:00', workEnd: '18:00', tasks: [], workouts: [] };
const overlap = (a, b) => a.day === b.day && toM(a.time) < toM(b.time) + b.dur && toM(b.time) < toM(a.time) + a.dur;
const toM = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

test('senza nulla da pianificare: settimana vuota', () => {
  const p = planWeek(base);
  assert.equal(p.items.length, 0); assert.equal(p.days.length, 7); assert.equal(p.days[0], '2026-10-21');
});
test('allenamento: dopo le 17 se c\'è posto, mai sopra un impegno', () => {
  const p = planWeek({ ...base, workouts: [{ day: '2026-10-22', name: 'Spinta', minutes: 45 }], events: { '2026-10-22': [{ time: '17:30', dur: 60, title: 'Cena' }] } });
  const w = p.items.find((x) => x.kind === 'allenamento');
  assert.ok(w);
  assert.ok(!overlap(w, { day: '2026-10-22', time: '17:30', dur: 60 }));
  assert.match(w.title, /Spinta/);
});
test('turno: l\'allenamento va dopo il turno con un\'ora di margine', () => {
  const shifts = [{ id: 's', name: 'Mattina', start: '06:00', end: '14:00', weekdays: [3], dates: [], color: '#fff' }]; // giovedì
  const p = planWeek({ ...base, shifts, workouts: [{ day: '2026-10-22', name: 'Gambe', minutes: 60 }] });
  const w = p.items.find((x) => x.kind === 'allenamento');
  assert.ok(toM(w.time) >= 15 * 60, w.time);
  assert.ok(p.notes.some((n) => /turni/.test(n)));
});
test('turno di notte: la sera è occupata e il giorno dopo la mattina presto', () => {
  const shifts = [{ id: 's', name: 'Notte', start: '22:00', end: '06:00', weekdays: [], dates: ['2026-10-22'], color: '#fff' }];
  const p = planWeek({ ...base, shifts, workouts: [{ day: '2026-10-22', name: 'Gambe', minutes: 60 }, { day: '2026-10-23', name: 'Petto', minutes: 45 }] });
  const a = p.items.find((x) => x.title.includes('Gambe')), b = p.items.find((x) => x.title.includes('Petto'));
  assert.ok(a && toM(a.time) + a.dur <= 21 * 60 + 0, 'prima del turno con margine');
  assert.ok(b && toM(b.time) >= 7 * 60 + 0, 'dopo la fine del turno più margine');
});
test('task: uno al giorno nell\'orario di lavoro, nell\'ordine d\'importanza', () => {
  const p = planWeek({ ...base, tasks: [{ id: 'a', t: 'Primo' }, { id: 'b', t: 'Secondo' }, { id: 'c', t: 'Terzo' }] });
  const t = p.items.filter((x) => x.kind === 'task');
  assert.deepEqual(t.map((x) => x.title), ['Lavoro su: Primo', 'Lavoro su: Secondo', 'Lavoro su: Terzo']);
  assert.deepEqual(new Set(t.map((x) => x.day)).size, 3);
  t.forEach((x) => assert.ok(toM(x.time) >= 9 * 60 && toM(x.time) + x.dur <= 18 * 60));
});
test('nulla nel passato e nessuna sovrapposizione', () => {
  const late = new Date(2026, 9, 21, 16, 30);
  const p = planWeek({ ...base, now: late, tasks: [{ id: 'a', t: 'X' }], workouts: [{ day: '2026-10-21', name: 'Oggi', minutes: 60 }], events: { '2026-10-21': [{ time: '17:00', dur: 60 }] } });
  p.items.filter((x) => x.day === '2026-10-21').forEach((x) => assert.ok(toM(x.time) >= 16 * 60 + 30));
  for (const a of p.items) for (const b of p.items) if (a !== b && a.kind !== 'sonno' && b.kind !== 'sonno') assert.ok(!overlap(a, b));
});
test('a letto prima di un turno presto', () => {
  const shifts = [{ id: 's', name: 'Alba', start: '06:00', end: '14:00', weekdays: [3], dates: [], color: '#fff' }];
  const p = planWeek({ ...base, shifts });
  const s = p.items.find((x) => x.kind === 'sonno');
  assert.ok(s);
  assert.equal(s.day, '2026-10-21'); assert.equal(s.time, '21:00');
  assert.match(s.title, /06:00/);
  assert.equal(planWeek({ ...base, shifts, opts: { sleep: false } }).items.some((x) => x.kind === 'sonno'), false);
});
test('opzioni: si possono togliere gli allenamenti', () => {
  const p = planWeek({ ...base, workouts: [{ day: '2026-10-22', name: 'A', minutes: 30 }], opts: { workouts: false } });
  assert.equal(p.items.length, 0);
});

test('task mai nel fine settimana e ricordi del sonno con il giorno giusto', () => {
  const many = Array.from({ length: 7 }, (_, k) => ({ id: `t${k}`, t: `T${k}` }));
  const p = planWeek({ ...base, tasks: many });
  p.items.filter((x) => x.kind === 'task').forEach((x) => { const w = new Date(x.day + 'T00:00:00').getDay(); assert.ok(w !== 0 && w !== 6, x.day); });
  const shifts = [{ id: 's', name: 'Alba', start: '06:00', end: '14:00', weekdays: [3, 4], dates: [], color: '#fff' }];
  const sl = planWeek({ ...base, shifts }).items.filter((x) => x.kind === 'sonno');
  assert.equal(sl.length, 2);
  assert.match(sl[0].title, /domani il turno/);
  assert.match(sl[1].title, /ven 23 il turno/);
});

test('pausa pranzo: una per giorno, libera dagli impegni, e i task non ci finiscono sopra', () => {
  const lunch = { from: '12:30', to: '13:30', dur: 60 };
  const p = planWeek({ ...base, lunch, tasks: [{ id: 'a', t: 'A' }, { id: 'b', t: 'B' }] });
  const pr = p.items.filter((x) => x.kind === 'pausa');
  assert.ok(pr.length >= 6, String(pr.length));
  for (const l of pr) for (const o of p.items.filter((x) => x.kind !== 'pausa')) assert.ok(!overlap(l, o), `${l.day} ${l.time} / ${o.title}`);
});
test('pausa pranzo: con un impegno a quell\'ora si sposta di poco, senza sovrapporsi', () => {
  const lunch = { from: '12:30', to: '13:30', dur: 60 };
  const p = planWeek({ ...base, lunch, events: { '2026-10-22': [{ time: '12:30', dur: 30, title: 'Call' }] } });
  const l = p.items.find((x) => x.kind === 'pausa' && x.day === '2026-10-22');
  assert.ok(l && toM(l.time) >= 13 * 60, l?.time);
});
test('pausa pranzo: spenta o disattivata nelle opzioni, non si propone', () => {
  assert.equal(planWeek(base).items.filter((x) => x.kind === 'pausa').length, 0);
  assert.equal(planWeek({ ...base, lunch: { from: '12:30', to: '13:30', dur: 60 }, opts: { lunch: false } }).items.filter((x) => x.kind === 'pausa').length, 0);
});

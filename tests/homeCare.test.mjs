import test from 'node:test';
import assert from 'node:assert/strict';
import { addEvery, everyDays, everyLabel, CATALOG, suggestFor, choreFrom, balanceDue, dailyPlan, complete, postpone, slideBacklog, yearPlan, choreState, basePoints, pointsFor, monthlyBoard, canDo, rotateTo, weeklyLoad, layoutRooms, estimateRooms, parseRoomsJson, roomTypeFrom, nextTinyStep, microSteps, timeBox, parseVerdict, areaOf, totalArea, daysBetween, addDays } from '../src/lib/homeCare.ts';
import { GUIDES, guideMinutes, stepsDone } from '../src/lib/homeGuides.ts';

const T = '2026-11-02'; // lunedì
const mk = (id, title, every, minutes = 10, effort = 1, extra = {}) => ({ id, title, room: null, every, minutes, effort, assignee: null, due: null, active: true, ...extra });

test('intervalli: mesi con fine mese, anni bisestili', () => {
  assert.equal(addEvery('2026-01-31', { n: 1, unit: 'month' }), '2026-02-28');
  assert.equal(addEvery('2026-11-02', { n: 3, unit: 'month' }), '2027-02-02');
  assert.equal(addEvery('2028-02-29', { n: 1, unit: 'year' }), '2029-02-28');
  assert.equal(addEvery('2026-11-02', { n: 2, unit: 'week' }), '2026-11-16');
  assert.equal(everyDays({ n: 3, unit: 'month' }), 90); assert.equal(everyLabel({ n: 1, unit: 'month' }), 'ogni mese'); assert.equal(everyLabel({ n: 3, unit: 'month' }), 'ogni 3 mesi');
});
test('catalogo e suggerimenti', () => {
  const cu = { id: 'r1', name: 'Cucina', type: 'cucina', w: 3, l: 3 };
  assert.ok(suggestFor(cu, []).some((x) => /forno/.test(x.title)));
  const have = [choreFrom('c1', 'r1', CATALOG.cucina[0])];
  assert.ok(!suggestFor(cu, have).some((x) => x.title === CATALOG.cucina[0].title));
  assert.ok(suggestFor(null, []).some((x) => /rifiuti/.test(x.title)));
  assert.ok(Object.values(CATALOG).every((l) => l.every((x) => x.minutes > 0 && x.title.length > 3)));
});
test('bilanciamento: il lavoro non si accumula in un giorno', () => {
  const chores = [mk('a', 'Settimanale 1', { n: 1, unit: 'week' }, 30), mk('b', 'Settimanale 2', { n: 1, unit: 'week' }, 30), mk('c', 'Settimanale 3', { n: 1, unit: 'week' }, 30), mk('d', 'Settimanale 4', { n: 1, unit: 'week' }, 30), mk('e', 'Mensile', { n: 1, unit: 'month' }, 45)];
  const out = balanceDue(chores, T, { budget: 40 });
  assert.ok(out.every((c) => c.due && c.due >= T));
  const days = new Set(out.slice(0, 4).map((c) => c.due)); assert.ok(days.size >= 4, 'le quattro settimanali in giorni diversi');
  assert.equal(out[0].id, 'a');
  const keep = balanceDue([{ ...chores[0], due: '2026-11-10' }], T, { budget: 40 })[0]; assert.equal(keep.due, '2026-11-10');
});
test('giorni di riposo evitati', () => {
  const out = balanceDue([mk('a', 'Pulizie', { n: 1, unit: 'week' }, 30)], T, { budget: 60, restDays: [1, 2, 3, 4, 5, 6] });
  assert.equal(new Date(out[0].due + 'T12:00:00Z').getUTCDay(), 0);
});
test('piano di oggi: ritardi prima, dentro il tempo', () => {
  const cs = [mk('a', 'Breve', { n: 1, unit: 'week' }, 5, 1, { due: T }), mk('b', 'Lunga in ritardo', { n: 1, unit: 'week' }, 30, 2, { due: '2026-10-26' }), mk('c', 'Domani', { n: 1, unit: 'week' }, 5, 1, { due: '2026-11-03' }), mk('d', 'Media', { n: 1, unit: 'week' }, 20, 1, { due: T })];
  const p = dailyPlan(cs, T, { budget: 40 });
  assert.equal(p.items[0].chore.id, 'b'); assert.equal(p.items[0].late, true);
  assert.deepEqual(p.items.map((x) => x.chore.id), ['b', 'a']); assert.deepEqual(p.later.map((x) => x.id), ['d']); assert.ok(p.minutes <= 40);
  assert.equal(dailyPlan(cs, T, { budget: 40, doneToday: ['b'] }).items[0].chore.id, 'a');
  assert.equal(dailyPlan([mk('x', 'Enorme', { n: 1, unit: 'week' }, 90, 3, { due: T })], T, { budget: 20 }).items.length, 1, 'almeno una cosa anche se lunga');
});
test('poca energia: due cose facili e brevi', () => {
  const cs = [mk('a', 'Facile 1', { n: 1, unit: 'day' }, 5, 1, { due: T }), mk('b', 'Facile 2', { n: 1, unit: 'day' }, 8, 1, { due: T }), mk('c', 'Facile 3', { n: 1, unit: 'day' }, 5, 1, { due: T }), mk('d', 'Difficile', { n: 1, unit: 'week' }, 40, 3, { due: T })];
  const p = dailyPlan(cs, T, { budget: 60, lowEnergy: true }); assert.equal(p.items.length, 2); assert.ok(p.items.every((x) => x.chore.effort === 1 && x.chore.minutes <= 10));
});
test('completare e rimandare', () => {
  const c = mk('a', 'X', { n: 1, unit: 'week' }, 10, 1, { due: '2026-10-30' });
  const d = complete(c, T); assert.equal(d.lastDone, T); assert.equal(d.due, '2026-11-09');
  assert.equal(postpone(c, T).due, '2026-11-03'); assert.equal(choreState(c, T), 'in ritardo'); assert.equal(choreState({ ...c, due: T }, T), 'oggi'); assert.equal(choreState({ ...c, due: '2026-11-05' }, T), 'presto'); assert.equal(choreState({ ...c, active: false }, T), 'spenta');
});
test('arretrati: scivolano avanti dove c\'è posto, senza accumulo', () => {
  const cs = [1, 2, 3, 4, 5].map((i) => mk('c' + i, 'Arretrato ' + i, { n: 1, unit: 'month' }, 30, 1, { due: '2026-10-' + (10 + i) }));
  const out = slideBacklog(cs, T, { budget: 60 });
  const by = {}; for (const c of out) by[c.due] = (by[c.due] ?? 0) + c.minutes;
  assert.ok(Object.values(by).every((m) => m <= 60)); assert.ok(out.every((c) => c.due >= T));
  const rest = slideBacklog(cs, T, { budget: 60, restDays: [2] }); assert.ok(rest.every((c) => new Date(c.due + 'T12:00:00Z').getUTCDay() !== 2 || c.due === T));
});
test('piano annuale', () => {
  const cs = [mk('a', 'Tende', { n: 3, unit: 'month' }, 20, 2, { due: '2026-11-15' }), mk('b', 'Settimanale', { n: 1, unit: 'week' }, 10, 1, { due: T })];
  const y = yearPlan(cs, T); assert.equal(y.length, 12); assert.equal(y[0].month, '2026-11');
  assert.equal(y[0].items.filter((i) => i.chore.id === 'a').length, 1); assert.equal(y.reduce((n, m) => n + m.items.filter((i) => i.chore.id === 'a').length, 0), 4);
  assert.ok(y[0].count > 4 && y[0].minutes > 40);
});
test('punti, classifica e turni', () => {
  const c = mk('a', 'X', { n: 1, unit: 'week' }, 20, 2); assert.equal(basePoints(c), 20);
  assert.equal(pointsFor(c, [{ id: 'd', chore: 'a', member: 'm1', day: T, points: 20, ts: 1 }], T), 0); assert.equal(pointsFor(c, [], T), 20);
  const ms = [{ id: 'm1', name: 'Anna', kind: 'adulto', color: '#000' }, { id: 'm2', name: 'Luca', kind: 'ragazzo', color: '#000' }, { id: 'm3', name: 'Sofia', kind: 'bambino', color: '#000' }];
  const log = [{ id: '1', chore: 'a', member: 'm1', day: '2026-11-01', points: 30, ts: 1 }, { id: '2', chore: 'b', member: 'm2', day: '2026-11-02', points: 10, ts: 2 }, { id: '3', chore: 'c', member: 'm2', day: '2026-10-30', points: 99, ts: 3 }];
  const b = monthlyBoard(log, '2026-11', ms); assert.deepEqual(b.rows.map((r) => r.member.id), ['m1', 'm2', 'm3']); assert.equal(b.total, 40); assert.equal(b.rows[0].share, 75);
  assert.equal(canDo(ms[2], mk('x', 'x', { n: 1, unit: 'day' }, 10, 1)), true); assert.equal(canDo(ms[2], mk('x', 'x', { n: 1, unit: 'day' }, 10, 2)), false); assert.equal(canDo(ms[1], mk('x', 'x', { n: 1, unit: 'day' }, 10, 3)), false);
  assert.equal(rotateTo(mk('x', 'x', { n: 1, unit: 'day' }, 10, 1), ms, log, '2026-11').id, 'm3'); assert.equal(rotateTo(mk('x', 'x', { n: 1, unit: 'day' }, 10, 3), ms, log, '2026-11').id, 'm1');
  const wl = weeklyLoad([mk('a', 'A', { n: 1, unit: 'week' }, 20, 1, { assignee: 'm1' }), mk('b', 'B', { n: 1, unit: 'week' }, 20, 1, { assignee: 'rotate' })], ms); assert.equal(wl.find((x) => x.member.id === 'm1').minutes, 30);
});
test('planimetria: disposizione e stima', () => {
  const rooms = [{ id: '1', name: 'Soggiorno', type: 'soggiorno', w: 5, l: 4 }, { id: '2', name: 'Cucina', type: 'cucina', w: 3.5, l: 3 }, { id: '3', name: 'Bagno', type: 'bagno', w: 2.5, l: 2 }, { id: '4', name: 'Camera', type: 'camera', w: 4, l: 3.5 }];
  const L = layoutRooms(rooms, 300); assert.equal(L.rects.length, 4); assert.ok(L.rects.every((r) => r.x >= 0 && r.x + r.w <= 300.5 && r.h > 0)); assert.ok(L.height > 0);
  for (const a of L.rects) for (const b of L.rects) if (a !== b) assert.ok(a.x + a.w <= b.x + 0.01 || b.x + b.w <= a.x + 0.01 || a.y + a.h <= b.y + 0.01 || b.y + b.h <= a.y + 0.01, 'senza sovrapposizioni');
  assert.deepEqual(layoutRooms([], 300), { rects: [], height: 0, scale: 1 }); assert.equal(areaOf(rooms[0]), 20); assert.equal(totalArea(rooms), 49.5);
  const est = estimateRooms(70, ['soggiorno', 'cucina', 'camera', 'camera', 'bagno']); assert.equal(est.length, 5); assert.deepEqual(est.map((r) => r.name).slice(2, 4), ['Camera da letto 1', 'Camera da letto 2']);
  assert.ok(Math.abs(totalArea(est) - 70) < 6);
});
test('AI planimetria: lettura sicura', () => {
  const r = parseRoomsJson('Ecco: [{"name":"Cucina abitabile","type":"cucina","w":4,"l":3.2},{"name":"Bagno","w":99,"l":-1},{"name":"Stanza dei giochi","type":"cameretta"}] fine');
  assert.equal(r.length, 3); assert.equal(r[0].type, 'cucina'); assert.equal(r[1].type, 'bagno'); assert.equal(r[1].w, 2.5); assert.equal(r[1].l, 2); assert.equal(r[2].type, 'cameretta');
  assert.deepEqual(parseRoomsJson('niente json'), []); assert.deepEqual(parseRoomsJson('[rotto'), []); assert.equal(roomTypeFrom('Salotto'), 'soggiorno'); assert.equal(roomTypeFrom('Ripostiglio'), 'lavanderia'); assert.equal(roomTypeFrom('boh'), 'altro');
});
test('ADHD: una cosa piccola e a pezzi', () => {
  const plan = [{ chore: mk('a', 'Grande', { n: 1, unit: 'week' }, 40, 3), late: true }, { chore: mk('b', 'Piccola', { n: 1, unit: 'week' }, 5, 1), late: false }, { chore: mk('c', 'Media', { n: 1, unit: 'week' }, 15, 1), late: true }];
  assert.equal(nextTinyStep(plan).chore.id, 'b'); assert.equal(nextTinyStep([]), null);
  const s = microSteps({ title: 'Lavare il bagno', minutes: 15 }); assert.equal(s.length, 4); assert.ok(s.every((x) => x.minutes >= 1)); assert.equal(timeBox({ minutes: 3 }), 5); assert.equal(timeBox({ minutes: 30 }), 15);
});
test('prima e dopo: lettura del giudizio dell\'AI', () => {
  assert.equal(parseVerdict('{"verdict":"meglio","praise":"Ottimo lavoro","tips":["Piega in verticale","Etichetta","extra"]}').tips.length, 2);
  assert.equal(parseVerdict('{"verdict":"boh"}').verdict, 'meglio'); assert.equal(parseVerdict('Bel lavoro, si vede!').praise, 'Bel lavoro, si vede!'); assert.equal(parseVerdict('').praise, 'Hai fatto un bel passo.');
});
test('guide di riordino', () => {
  assert.ok(GUIDES.length >= 6 && GUIDES.every((g) => g.steps.length >= 3 && guideMinutes(g) > 10)); assert.ok(GUIDES.some((g) => g.id === 'guardaroba') && GUIDES.some((g) => g.id === 'documenti'));
  const g = GUIDES[0]; assert.equal(stepsDone(g, [0, 1, 99]), Math.round((2 / g.steps.length) * 100));
  assert.equal(daysBetween('2026-11-02', addDays('2026-11-02', 10)), 10);
});

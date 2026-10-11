import test from 'node:test';
import assert from 'node:assert/strict';
import { planReminders, normalizePrefs, startOf, reminderId, MAX_SCHEDULED, WINDOW_DAYS, RESERVED_SLOTS, IOS_LIMIT, DEFAULT_PREFS } from '../src/lib/reminders.ts';

const at = (day, time) => startOf(day, time);
const NOW = at('2026-10-10', '09:00');

test('promemoria con anticipo di default (15 min)', () => {
  const p = planReminders({ '2026-10-10': [{ time: '15:00', title: 'Dentista' }] }, { now: NOW }).filter((x) => x.kind === 'lead');
  assert.equal(p.length, 1);
  assert.equal(p[0].title, 'Dentista');
  assert.equal(p[0].kind, 'lead');
  assert.equal(p[0].at, at('2026-10-10', '14:45'));
  assert.equal(p[0].id, 'lp-ev-2026-10-10-0-lead');
  assert.match(p[0].body, /15 min/);
});

test('anticipo configurabile e valori non validi -> 15', () => {
  const ev = { '2026-10-10': [{ time: '15:00', title: 'X' }] };
  const lead = (prefs) => planReminders(ev, { now: NOW, prefs }).find((x) => x.kind === 'lead');
  assert.equal(lead({ leadMin: 60 }).at, at('2026-10-10', '14:00'));
  assert.equal(lead({ leadMin: 5 }).at, at('2026-10-10', '14:55'));
  assert.equal(normalizePrefs({ leadMin: 17 }).leadMin, 15);
  assert.deepEqual(normalizePrefs(undefined), DEFAULT_PREFS);
  assert.deepEqual(normalizePrefs({ on: true, leadMin: 30, depart: false }), { ...DEFAULT_PREFS, leadMin: 30, depart: false });
});

test('"Parti alle" con luogo: Lugano -> Zurigo 150 min + 10 di margine', () => {
  const p = planReminders({ '2026-10-12': [{ time: '15:00', title: 'Riunione', place: 'Zurigo' }] }, { now: NOW, homeCity: 'Lugano' });
  const dep = p.find((x) => x.kind === 'depart');
  const head = p.find((x) => x.kind === 'headsup');
  assert.ok(dep && head);
  assert.match(dep.body, /150 min/);
  assert.match(dep.body, /12:20/);
  assert.equal(dep.title, 'Riunione');
  // avviso 15 minuti prima dell'ora di partenza + avviso alla partenza
  assert.equal(head.at, at('2026-10-12', '12:05'));
  assert.equal(dep.at, at('2026-10-12', '12:20'));
  assert.match(head.body, /15 min/);
  assert.equal(dep.id, reminderId('2026-10-12', 0, 'depart'));
  assert.equal(head.id, 'lp-ev-2026-10-12-0-headsup');
  assert.deepEqual(p.map((x) => x.kind), ['headsup', 'depart', 'lead', 'start']);
  assert.equal(p.find((x) => x.kind === 'start').at, at('2026-10-12', '15:00'));
});

test('senza luogo, senza città di casa o tragitto nullo: solo promemoria', () => {
  const ev = (place) => ({ '2026-10-12': [{ time: '15:00', title: 'Riunione', place }] });
  assert.deepEqual(planReminders(ev(undefined), { now: NOW, homeCity: 'Lugano' }).map((x) => x.kind), ['lead', 'start']);
  assert.deepEqual(planReminders(ev('Zurigo'), { now: NOW, homeCity: '' }).map((x) => x.kind), ['lead', 'start']);
  assert.deepEqual(planReminders(ev('Lugano'), { now: NOW, homeCity: 'Lugano' }).map((x) => x.kind), ['lead', 'start']);
  assert.deepEqual(planReminders(ev('Online'), { now: NOW, homeCity: 'Lugano' }).map((x) => x.kind), ['lead', 'start']);
  assert.deepEqual(planReminders(ev('Zurigo'), { now: NOW, homeCity: 'Lugano', prefs: { depart: false } }).map((x) => x.kind), ['lead', 'start']);
});

test('avviso anticipato già passato ma partenza futura: avvisa all\'ora di partenza', () => {
  const now = at('2026-10-12', '12:10');
  const p = planReminders({ '2026-10-12': [{ time: '15:00', title: 'Riunione', place: 'Zurigo' }] }, { now, homeCity: 'Lugano' });
  const dep = p.find((x) => x.kind === 'depart');
  assert.ok(dep);
  assert.equal(dep.at, at('2026-10-12', '12:20'));
  assert.equal(p.some((x) => x.kind === 'headsup'), false);
  // partenza già passata: niente avviso di partenza, resta il promemoria
  const late = planReminders({ '2026-10-12': [{ time: '15:00', title: 'Riunione', place: 'Zurigo' }] }, { now: at('2026-10-12', '13:00'), homeCity: 'Lugano' });
  assert.deepEqual(late.map((x) => x.kind), ['lead', 'start']);
});

test('eventi passati, orari invalidi e reminder=false esclusi', () => {
  const p = planReminders({
    '2026-10-09': [{ time: '10:00', title: 'Ieri' }],
    '2026-10-10': [{ time: '08:00', title: 'Gia passato' }, { time: '--:--', title: 'Senza ora' }, { time: '25:00', title: 'Assurdo' }, { time: '18:00', title: 'Spento', reminder: false }, { time: '09:10', title: 'Troppo vicino' }],
  }, { now: NOW });
  // l'anticipo di 'Troppo vicino' e' gia' passato, ma "Inizia ora" alle 09:10 e' ancora futuro
  assert.deepEqual(p.map((x) => `${x.title}:${x.kind}`), ['Troppo vicino:start']);
});

test('oltre la finestra di 14 giorni esclusi', () => {
  const p = planReminders({ '2026-10-23': [{ time: '10:00', title: 'Dentro' }], '2026-10-25': [{ time: '10:00', title: 'Fuori' }] }, { now: NOW });
  assert.equal(WINDOW_DAYS, 14);
  assert.deepEqual([...new Set(p.map((x) => x.day))], ['2026-10-23']);
});

test('tetto di notifiche: tiene le piu\' vicine', () => {
  const events = {};
  for (let d = 10; d <= 23; d++) events[`2026-10-${d}`] = Array.from({ length: 10 }, (_, i) => ({ time: `${String(10 + i).padStart(2, '0')}:00`, title: `E${i}` }));
  const p = planReminders(events, { now: NOW });
  assert.equal(p.length, MAX_SCHEDULED);
  assert.ok(p.every((x, i) => i === 0 || p[i - 1].at <= x.at));
  assert.equal(planReminders(events, { now: NOW, max: 5 }).length, 5);
});

test('interruttore spento -> nessuna notifica; identificatori deterministici', () => {
  const ev = { '2026-10-11': [{ time: '10:00', title: 'A' }, { time: '11:00', title: 'B' }] };
  assert.equal(planReminders(ev, { now: NOW, prefs: { on: false } }).length, 0);
  const a = planReminders(ev, { now: NOW }).map((x) => x.id);
  const b = planReminders(ev, { now: NOW }).map((x) => x.id);
  assert.deepEqual(a, b);
  assert.deepEqual(a, ['lp-ev-2026-10-11-0-lead', 'lp-ev-2026-10-11-0-start', 'lp-ev-2026-10-11-1-lead', 'lp-ev-2026-10-11-1-start']);
});

test('ogni tipo di promemoria e\' disattivabile singolarmente', () => {
  const ev = { '2026-10-12': [{ time: '15:00', title: 'Riunione', place: 'Zurigo' }] };
  const kinds = (prefs) => planReminders(ev, { now: NOW, homeCity: 'Lugano', prefs }).map((x) => x.kind).sort();
  assert.deepEqual(kinds({}), ['depart', 'headsup', 'lead', 'start']);
  assert.deepEqual(kinds({ lead: false }), ['depart', 'headsup', 'start']);
  assert.deepEqual(kinds({ start: false }), ['depart', 'headsup', 'lead']);
  assert.deepEqual(kinds({ headsup: false }), ['depart', 'lead', 'start']);
  assert.deepEqual(kinds({ leave: false }), ['headsup', 'lead', 'start']);
  assert.deepEqual(kinds({ depart: false }), ['lead', 'start']);
  assert.deepEqual(kinds({ lead: false, start: false, depart: false }), []);
});

test('"Inizia ora" all\'ora esatta; mai nel passato', () => {
  const ev = { '2026-10-10': [{ time: '09:30', title: 'Call' }] };
  const p = planReminders(ev, { now: NOW });
  assert.deepEqual(p.map((x) => x.kind), ['lead', 'start']);
  assert.equal(p[1].at, at('2026-10-10', '09:30'));
  assert.match(p[1].body, /Inizia ora/);
  // a 09:20 l'anticipo di 15 min (09:15) e\' passato: resta solo "Inizia ora"
  assert.deepEqual(planReminders(ev, { now: at('2026-10-10', '09:20') }).map((x) => x.kind), ['start']);
  assert.ok(planReminders(ev, { now: NOW }).every((x) => x.at > NOW));
});

test('slot riservati: 64 - 14 = 50', () => {
  assert.equal(IOS_LIMIT, 64);
  assert.equal(RESERVED_SLOTS, 14);
  assert.equal(MAX_SCHEDULED, IOS_LIMIT - RESERVED_SLOTS);
});

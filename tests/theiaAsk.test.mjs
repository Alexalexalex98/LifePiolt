import test from 'node:test';
import assert from 'node:assert/strict';
import { askLocal } from '../src/lib/theia/ask.ts';
import { verified } from '../src/lib/theia/core.ts';

const now = new Date(2026, 9, 21, 10, 0).getTime();
const base = { now, events: {}, shifts: [], tasks: [], finance: null, sleep: [], steps: [], water: null, kcal: null, currency: 'CHF' };
const fin = { partial: true, day: 21, daysInMonth: 31, income: 3500, expense: 2400, saved: 0, end: 331, projectionEnd: -200, over: [], topCats: [{ n: 'Ristoranti', v: 310 }, { n: 'Spesa', v: 640 }] };

test('domanda non riconosciuta: null (si passa alla via normale)', () => {
  assert.equal(askLocal('raccontami una barzelletta', base), null);
  assert.equal(askLocal('', base), null);
});
test('senza dati: lo dice, non inventa', () => {
  assert.match(askLocal('Quanto mi resta a fine mese?', base).text, /Non ho ancora dati/);
  assert.match(askLocal('Quanto ho dormito?', base).text, /Non ho dati sul tuo sonno/);
  assert.match(askLocal('Che turno ho?', base).text, /nessun turno salvato/);
});
test('fine mese e spese, con numeri verificati', () => {
  const s = { ...base, finance: fin };
  const a = askLocal('quanto mi resta a fine mese', s);
  assert.match(a.text, /-200 CHF/); assert.ok(verified(a)); assert.ok(a.sources.length);
  const b = askLocal('Quanto ho speso in ristoranti?', s);
  assert.match(b.text, /310 CHF/);
  const c = askLocal('quanto ho speso questo mese', s);
  assert.match(c.text, /2\.400 CHF/);
  const d = askLocal('quanto ho speso in viaggi', s);
  assert.match(d.text, /Non trovo una categoria/);
});
test('turni, impegni e task', () => {
  const shifts = [{ id: 's', name: 'Mattina', start: '06:00', end: '14:00', weekdays: [3], dates: [], color: '#fff' }];
  assert.match(askLocal('qual è il mio prossimo turno', { ...base, shifts }).text, /Mattina.*Domani 06:00.*14:00/);
  const events = { '2026-10-21': [{ time: '09:00', title: 'Passato' }, { time: '18:30', title: 'Cena' }] };
  assert.match(askLocal('cosa ho oggi', { ...base, events }).text, /un impegno: 18:30 Cena/);
  assert.match(askLocal('cosa ho domani', base).text, /Domani non hai impegni/);
  const tasks = [{ id: 'a', t: 'x', due: '2026-10-20' }, { id: 'b', t: 'y', due: '2026-10-21' }, { id: 'c', t: 'z', done: true }];
  assert.match(askLocal('quanti task ho', { ...base, tasks }).text, /2 task aperti: 1 per oggi e 1 scaduti/);
});
test('salute: sonno, passi, acqua, calorie', () => {
  const sleep = [{ day: '2026-10-19', hours: 7 }, { day: '2026-10-20', hours: 5.5 }];
  const a = askLocal('quanto ho dormito', { ...base, sleep });
  assert.match(a.text, /5,5 ore/); assert.match(a.text, /6,3 ore/); assert.match(a.text, /\(ieri\)/);
  assert.match(askLocal('quanti passi ho fatto', { ...base, steps: [{ day: '2026-10-20', v: 8000 }] }).text, /Per oggi non ho ancora il dato.*8\.000 passi/);
  assert.match(askLocal('quanta acqua ho bevuto', { ...base, water: { todayMl: 750, goalMl: 2000 } }).text, /0,8 litri.*2,0/);
  assert.match(askLocal('quante calorie ho mangiato oggi', { ...base, kcal: { today: 1200, target: 2100 } }).text, /1\.200 kcal.*2\.100/);
});
test('conflitti', () => {
  const shifts = [{ id: 's', name: 'Mattina', start: '06:00', end: '14:00', weekdays: [3], dates: [], color: '#fff' }];
  const events = { '2026-10-22': [{ time: '10:00', title: 'Dentista', dur: 60 }] };
  assert.match(askLocal('ho conflitti in agenda?', { ...base, shifts, events }).text, /Dentista/);
  assert.match(askLocal('ho conflitti in agenda?', base).text, /non vedo impegni/);
});

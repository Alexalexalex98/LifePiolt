import test from 'node:test';
import assert from 'node:assert/strict';
import { lockItems, lockTimeline, activeShift } from '../src/lib/lockScreen.ts';

const now = new Date(2026, 9, 26, 12, 0).getTime();
const key = '2026-10-26';
const shift = { id: 's1', name: 'Turno mattina', start: '14:00', end: '22:00', weekdays: [0], dates: [], color: '#ff0000' };
const src = {
  shifts: [shift],
  events: { [key]: [{ time: '16:30', title: 'Dentista', dur: 45 }] },
  tasks: [{ t: 'Chiamare la banca', urgent: true }, { t: 'Spesa', due: key }, { t: 'Fatto', done: true, urgent: true }],
  waterMl: 800, waterGoalMl: 2400, workout: { name: 'Gambe', done: false },
};
const all = { cats: { turni: true, impegni: true, task: true, acqua: true, allenamento: true }, hideTitles: false };

test('lockItems: ordine per orario, poi il resto', () => {
  const r = lockItems(src, all, now);
  assert.deepEqual(r.map((x) => x.kind), ['turni', 'impegni', 'task', 'allenamento', 'acqua']);
  assert.equal(r[0].title, 'Turno mattina'); assert.equal(r[0].sub, 'Inizia alle 14:00');
  assert.equal(r[2].title, '2 task da fare'); assert.equal(r[2].sub, 'Chiamare la banca');
  assert.equal(r[4].title, 'Acqua 0,8 L');
});

test('lockItems: privacy e categorie spente', () => {
  const r = lockItems(src, { cats: { turni: true, impegni: true, task: true, acqua: false, allenamento: false }, hideTitles: true }, now);
  assert.deepEqual(r.map((x) => x.kind), ['turni', 'impegni', 'task']);
  assert.equal(r[0].title, 'Turno di lavoro'); assert.equal(r[1].title, 'Impegno'); assert.equal(r[2].sub, undefined);
  assert.ok(!JSON.stringify(r).includes('Dentista') && !JSON.stringify(r).includes('banca'));
});

test('lockTimeline: si aggiorna quando un turno o un impegno inizia o finisce', () => {
  const tl = lockTimeline(src, all, now);
  const ats = tl.map((x) => new Date(x.at).getHours() * 60 + new Date(x.at).getMinutes());
  assert.ok(ats.includes(14 * 60) && ats.includes(22 * 60) && ats.includes(16 * 60 + 30));
  const during = tl.find((x) => new Date(x.at).getHours() === 14);
  assert.equal(during.data.items[0].sub, 'In corso, finisce alle 22:00');
});

test('activeShift: solo se in corso o entro un\'ora', () => {
  assert.equal(activeShift([shift], now), null);
  assert.ok(activeShift([shift], new Date(2026, 9, 26, 13, 30).getTime()));
  assert.ok(activeShift([shift], new Date(2026, 9, 26, 15, 0).getTime()));
});

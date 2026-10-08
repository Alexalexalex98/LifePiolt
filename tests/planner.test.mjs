import test from 'node:test';
import assert from 'node:assert/strict';
import { planMonth, pickSlot } from '../src/lib/planner.ts';
import { freeSlots } from '../src/lib/availability.ts';

const NOW = new Date(2026, 9, 7, 10, 0); // mer 7 ott 2026
const base = { now: NOW, workStart: '09:00', workEnd: '18:00' };

test('piano del mese: dentro l\'orario di lavoro, sempre slot liberi, niente sovrapposizioni', () => {
  const events = { '2026-10-08': [{ time: '12:00', title: 'Pranzo' }, { time: '15:00', title: 'Riunione', dur: 120 }] };
  const ranked = [{ task: { id: '1', t: 'Business plan' }, score: 100, reasons: [] }, { task: { id: '2', t: 'Fatture' }, score: 0, reasons: [] }];
  const plan = planMonth({ ...base, events, ranked });
  assert.ok(plan.length > 10);
  const byDay = {};
  plan.forEach((p) => { (byDay[p.day] ??= []).push(p); assert.ok(p.time >= '09:00' && p.time < '18:00'); assert.ok(new Date(p.day + 'T00:00:00').getDay() % 6 !== 0); });
  for (const [day, items] of Object.entries(byDay)) {
    const all = [...(events[day] ?? []), ...items.map((x) => ({ time: x.time, dur: x.dur }))];
    const free = freeSlots(all, '09:00', '18:00', 30, 60).reduce((s, x) => s + x.to - x.from, 0);
    assert.ok(free >= 150, `${day} libero ${free}`);
    // niente sovrapposizioni tra gli elementi nuovi
    const sorted = items.slice().sort((a, b) => a.time.localeCompare(b.time));
    sorted.forEach((x, i) => { if (i) { const p = sorted[i - 1]; assert.ok(p.time.slice(0, 2) * 60 + +p.time.slice(3) + p.dur <= x.time.slice(0, 2) * 60 + +x.time.slice(3)); } });
  }
  assert.ok(plan.some((p) => p.title.includes('Business plan')));
  assert.ok(plan.every((p) => p.day >= '2026-10-07' && p.day <= '2026-10-31'));
});

test('scegli tu: urgente = il prima possibile', () => {
  const s = pickSlot({ ...base, events: { '2026-10-07': [{ time: '10:00' }, { time: '11:00' }, { time: '12:00' }, { time: '13:00' }, { time: '14:00' }, { time: '15:00' }, { time: '16:00' }, { time: '17:00' }] }, dur: 60, urgent: true });
  assert.equal(s.day, '2026-10-08');
});
test('scegli tu: non urgente = giorno più leggero', () => {
  const s = pickSlot({ ...base, events: { '2026-10-07': [{ time: '14:00' }], '2026-10-08': [{ time: '10:00' }, { time: '15:00' }] }, dur: 60 });
  assert.ok(s && s.day !== '2026-10-08');
});

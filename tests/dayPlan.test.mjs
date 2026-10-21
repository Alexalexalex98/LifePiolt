import test from 'node:test';
import assert from 'node:assert/strict';
import { dayInfo, addDays } from '../src/lib/fitness/dayPlan.ts';
import { weekView } from '../src/lib/fitness/plan.ts';
import { ALL_PROGRAMS } from '../src/lib/fitness/programsExtra.ts';

const p = ALL_PROGRAMS.find((x) => x.sessions.length > 1) ?? ALL_PROGRAMS[0];
const now = new Date(2026, 9, 21); // mercoledì
const ctx = (extra = {}) => ({ program: p, profile: { days: 3 }, history: [], plans: {}, now, ...extra });

test('la settimana corrente coincide con la vista settimanale', () => {
  for (const d of weekView(p, { days: 3 }, [], now)) {
    const i = dayInfo(d.date, ctx());
    assert.equal(i.planned, d.planned, d.date);
    if (d.planned) assert.equal(i.session, d.session, d.date);
  }
});
test('settimane future e passate: stessa rotazione, sempre un indice valido', () => {
  for (let n = -30; n <= 30; n++) { const i = dayInfo(addDays('2026-10-21', n), ctx()); if (i.session !== null) assert.ok(i.session >= 0 && i.session < p.sessions.length); }
});
test('lo storico vince, poi la scelta, poi il programma', () => {
  assert.equal(dayInfo('2026-10-19', ctx({ history: [{ id: 'a', date: '2026-10-19', programId: 'x', session: 2, minutes: 10, sets: 3 }] })).source, 'storico');
  const o = dayInfo('2026-10-20', ctx({ plans: { '2026-10-20': { programId: p.id, session: 1 } } }));
  assert.equal(o.source, 'scelta'); assert.equal(o.session, 1);
  assert.equal(dayInfo('2026-10-19', ctx({ plans: { '2026-10-19': { rest: true } } })).planned, false);
});
test('senza profilo non c\'è nulla di previsto', () => {
  assert.equal(dayInfo('2026-10-21', ctx({ profile: null })).planned, false);
});

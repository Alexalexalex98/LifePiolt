import test from 'node:test';
import assert from 'node:assert/strict';
import { goalProgress, isGoalLink, linkTitle, ddmmToIso } from '../src/lib/goalData.ts';

const today = '2026-10-08';
const mk = (vals) => vals.map((v, i) => ({ d: `2026-10-${String(8 - i).padStart(2, '0')}`, v }));
const base = { today, series: {}, workoutDays: [], monthNet: null };

test('allenamenti a settimana: conta solo gli ultimi 7 giorni', () => {
  const inp = { ...base, workoutDays: ['2026-10-08', '2026-10-06', '2026-10-02', '2026-10-01', '2026-09-20'] };
  const r = goalProgress({ metric: 'workouts', target: 3, period: 'week' }, inp);
  assert.equal(r.value, 3); assert.equal(r.pct, 100); assert.equal(r.done, true);
  const m = goalProgress({ metric: 'workouts', target: 8, period: 'month' }, inp);
  assert.equal(m.value, 5); assert.equal(m.pct, 63); assert.equal(m.done, false);
});
test('passi medi: media dei giorni con dati nella finestra', () => {
  const r = goalProgress({ metric: 'steps', target: 10000, period: 'week' }, { ...base, series: { steps: mk([6000, 8000, 10000]) } });
  assert.equal(r.value, 8000); assert.equal(r.pct, 80); assert.equal(r.samples, 3);
  assert.match(r.text, /8'000 su 10'000 passi al giorno/);
});
test('sonno: ore decimali con virgola', () => {
  const r = goalProgress({ metric: 'sleep', target: 8, period: 'week' }, { ...base, series: { sleep: mk([7, 7.5, 6.5, 8]) } });
  assert.equal(r.value, 7.25); assert.match(r.text, /7,3|7,2/);
});
test('mindfulness: somma dei minuti', () => {
  const r = goalProgress({ metric: 'mindful', target: 60, period: 'week' }, { ...base, series: { mindful: mk([20, 15, 10]) } });
  assert.equal(r.value, 45); assert.equal(r.pct, 75);
});
test('risparmio mensile: usa il netto del mese, negativo = 0%', () => {
  assert.equal(goalProgress({ metric: 'savings', target: 500, period: 'month' }, { ...base, monthNet: 250 }).pct, 50);
  const neg = goalProgress({ metric: 'savings', target: 500, period: 'month' }, { ...base, monthNet: -120 });
  assert.equal(neg.pct, 0); assert.equal(neg.hasData, true); assert.equal(neg.done, false);
});
test('nessun dato: non inventa avanzamento', () => {
  const r = goalProgress({ metric: 'steps', target: 8000, period: 'week' }, base);
  assert.equal(r.hasData, false); assert.equal(r.pct, 0); assert.match(r.text, /nessun dato/i);
});
test('dati fuori finestra ignorati; percentuale limitata a 100', () => {
  const old = [{ d: '2026-09-01', v: 20000 }];
  assert.equal(goalProgress({ metric: 'steps', target: 8000, period: 'week' }, { ...base, series: { steps: old } }).hasData, false);
  assert.equal(goalProgress({ metric: 'exercise', target: 20, period: 'week' }, { ...base, series: { exercise: mk([90]) } }).pct, 100);
});
test('isGoalLink / linkTitle / ddmmToIso', () => {
  assert.equal(isGoalLink({ metric: 'steps', target: 5, period: 'week' }), true);
  assert.equal(isGoalLink({ metric: 'foo', target: 5, period: 'week' }), false);
  assert.equal(isGoalLink({ metric: 'steps', target: 0, period: 'week' }), false);
  assert.equal(linkTitle({ metric: 'workouts', target: 3, period: 'week' }), 'Allenamenti · 3 a settimana');
  assert.equal(ddmmToIso('05/10', today), '2026-10-05');
  assert.equal(ddmmToIso('20/12', today), '2025-12-20');
  assert.equal(ddmmToIso('xx', today), null);
});

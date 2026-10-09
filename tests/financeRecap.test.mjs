import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, buildRecap, groupCategories, rateZone, monthStat } from '../src/lib/financeRecap.ts';

const catOf = (l) => { const h = l.split(' · ')[0]; return ['Affitto', 'Fondo emergenza', 'Alimentari/Casa', 'Abbonamenti', 'Viaggio estero', 'Altro'].includes(h) ? h : l === 'Stipendio' ? 'Altro' : 'Altro'; };
const mk = (label, start, locked, list) => ({ label, start, locked, movements: list.map(([l, a]) => ({ label: l, amount: a })) });
const m0 = mk('Ottobre 2026', 5000, false, [['Stipendio', 6500], ['Affitto', -1400], ['Alimentari/Casa · Coop', -300], ['Fondo emergenza', -650]]);
const m1 = mk('Settembre 2026', 4000, true, [['Stipendio', 6500], ['Affitto', -1400], ['Alimentari/Casa · Coop', -500], ['Viaggio estero · Volo', -400], ['Fondo emergenza', -650]]);
const m2 = mk('Agosto 2026', 3500, true, [['Stipendio', 6500], ['Affitto', -1400], ['Alimentari/Casa · Coop', -450], ['Fondo emergenza', -650]]);
const base = { months: [m0, m1, m2], catOf, catColors: { Affitto: '#111' }, billsMonthly: 700, efTotal: 3900, alerts: [], day: 9, daysInMonth: 31 };

test('monthStat: il fondo emergenza è risparmio, non spesa', () => {
  const s = monthStat(m0, catOf);
  assert.equal(s.income, 6500); assert.equal(s.expense, 1700); assert.equal(s.ef, 650); assert.equal(s.saved, 4800);
  assert.equal(s.end, 5000 + 6500 - 1700 - 650);
});
test('analyze: serie cronologica, tasso, proiezione e saldo a 3 mesi', () => {
  const a = analyze(base);
  assert.deepEqual(a.series.map((x) => x.short), ['Ago', 'Set', 'Ott']);
  assert.equal(a.partial, true); assert.equal(a.rate, 73.8);
  assert.equal(a.forecast.length, 3);
  assert.ok(a.projection.end > 0 && a.projection.outflow >= 2350);
  assert.equal(a.basisIsCurrent, false); // giorno 9: si usa l'ultimo mese chiuso
  assert.equal(a.top[0].n, 'Affitto');
});
test('classifica: frecce e mese in corso non "scende" mai', () => {
  const a = analyze({ ...base, day: 20 });
  assert.equal(a.basisIsCurrent, true);
  const food = a.top.find((x) => x.n === 'Alimentari/Casa');
  assert.equal(food.trend, 'flat'); // 300 vs 500 ma mese non finito
  const done = analyze({ ...base, day: 31, months: [{ ...m0, locked: true }, m1, m2] });
  assert.equal(done.top.find((x) => x.n === 'Alimentari/Casa').trend, 'down');
});
test('groupCategories: le piccole confluiscono in Altro, percentuali sommano ~100', () => {
  const g = groupCategories({ Affitto: 1400, 'Alimentari/Casa': 500, Abbonamenti: 30, 'Viaggio estero': 40, Altro: 20 });
  assert.deepEqual(g.map((x) => x.n), ['Affitto', 'Alimentari/Casa', 'Altro']);
  assert.ok(Math.abs(g.reduce((s, x) => s + x.p, 0) - 100) < 0.5);
  assert.deepEqual(groupCategories({}), []);
});
test('rateZone', () => {
  assert.equal(rateZone(-5), 'neg'); assert.equal(rateZone(5), 'low'); assert.equal(rateZone(15), 'ok'); assert.equal(rateZone(30), 'good'); assert.equal(rateZone(null), null);
});
test('recap: 4-6 frasi, tono prudente, azioni cliccabili', () => {
  const a = analyze({ ...base, alerts: [{ category: 'Alimentari/Casa', level: 'over', pct: 120 }] });
  const r = buildRecap(a, { ...base, alerts: [{ category: 'Alimentari/Casa', level: 'over', pct: 120 }] });
  assert.ok(r.sentences.length >= 4 && r.sentences.length <= 6, String(r.sentences.length));
  const all = r.sentences.join(' ');
  assert.match(all, /stima, non una previsione certa/);
  assert.match(all, /1 avviso di budget/);
  assert.doesNotMatch(all, /garantit|sicuramente|certamente/i);
  assert.ok(r.actions.length >= 1 && r.actions.length <= 2);
  assert.equal(r.actions[0].kind, 'alerts');
  assert.match(all, /fondo di emergenza \(.*\) copre circa 2 mesi/);
});
test('recap: spese oltre le entrate e plurale degli avvisi', () => {
  const bad = mk('Ottobre 2026', 1000, false, [['Stipendio', 1000], ['Affitto', -1400]]);
  const inp = { ...base, months: [bad, m1], alerts: [{ category: 'a', level: 'near', pct: 90 }, { category: 'b', level: 'near', pct: 88 }], efTotal: 0 };
  const r = buildRecap(analyze(inp), inp);
  const all = r.sentences.join(' ');
  assert.match(all, /superano le entrate di/); assert.match(all, /tasso di risparmio è negativo/);
  assert.match(all, /2 avvisi di budget/); assert.match(all, /Non risulta ancora un accantonamento/);
});
test('stato vuoto e poco storico', () => {
  const empty = { ...base, months: [mk('Ottobre 2026', 0, false, [])] };
  const r = buildRecap(analyze(empty), empty);
  assert.equal(r.empty, true);
  const one = { ...base, months: [m0] };
  const a = analyze(one);
  assert.equal(a.hasEnough.compare, false); assert.deepEqual(a.forecast, []);
});

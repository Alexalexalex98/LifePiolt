import test from 'node:test';
import assert from 'node:assert/strict';
import { limitState, dayStats, quality, analysisText, dayOf, findings, groupByDay, mealOpinion, parseWater, periodStats, slotOf, sumTotals, waterGoal, waterTimes } from '../src/lib/fitness/mealInsights.ts';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const meal = (id, ts, o = {}) => ({ id, ts, name: id, grams: 300, macros: { kcal: 600, p: 25, c: 70, f: 20, sat: 6, sug: 10, fib: 5, salt: 1.5, ...o } });

test('raggruppa per giorno, dal più recente, pasti in ordine di ora', () => {
  const g = groupByDay([meal('a', at(2026, 10, 18, 20)), meal('b', at(2026, 10, 19, 8)), meal('c', at(2026, 10, 18, 8))]);
  assert.deepEqual(g.map((x) => x.key), ['2026-10-19', '2026-10-18']);
  assert.deepEqual(g[1].meals.map((m) => m.id), ['c', 'a']);
  assert.equal(g[1].total.kcal, 1200);
});

test('medie sugli ultimi giorni: il giorno corrente conta solo dopo le 20', () => {
  const meals = [meal('a', at(2026, 10, 19, 13)), meal('b', at(2026, 10, 20, 9), { kcal: 3000 })];
  const sera = periodStats(meals, {}, at(2026, 10, 20, 21), 7);
  const giorno = periodStats(meals, {}, at(2026, 10, 20, 14), 7);
  assert.equal(sera.days, 2);
  assert.equal(giorno.days, 1);
  assert.equal(giorno.avg.kcal, 600);
});

test('trova carenze e punti da tenere d\'occhio, i più urgenti per primi', () => {
  const meals = [meal('a', at(2026, 10, 19, 13), { p: 8, fib: 2, sug: 60, sat: 20, salt: 4, kcal: 900 }), meal('b', at(2026, 10, 18, 13), { p: 8, fib: 2, sug: 60, sat: 20, salt: 4, kcal: 900 })];
  const s = periodStats(meals, { '2026-10-19': 600, '2026-10-18': 800 }, at(2026, 10, 20, 10), 7);
  const f = findings(s, { targetKcal: 2200, weightKg: 70 });
  const ids = f.map((x) => x.id);
  assert.ok(ids.includes('proteine') && ids.includes('fibre') && ids.includes('acqua') && ids.includes('zuccheri') && ids.includes('saturi') && ids.includes('kcal-sotto'));
  assert.equal(f[0].level, 'carenza');
  const text = analysisText(s, f, 'Alex');
  assert.match(text, /Dove sei carente/);
  assert.match(text, /non dati medici/);
});

test('senza pasti non inventa giudizi', () => {
  const s = periodStats([], {}, at(2026, 10, 20, 21));
  assert.deepEqual(findings(s), []);
  assert.match(analysisText(s, []), /Non ho ancora abbastanza pasti/);
});

test('parere sul singolo pasto', () => {
  const buono = mealOpinion(meal('x', at(2026, 10, 20, 13), { kcal: 700, p: 40, fib: 8, sug: 6, sat: 5, salt: 1.2 }), { targetKcal: 2000 });
  assert.equal(buono.verdict, 'ok');
  const pesante = mealOpinion(meal('y', at(2026, 10, 20, 20), { kcal: 1700, p: 20, fib: 1, sug: 60, sat: 30, salt: 4 }), { targetKcal: 2000 });
  assert.equal(pesante.verdict, 'attenzione');
  assert.match(pesante.text, /energetico/);
});

test('acqua letta dalle frasi', () => {
  assert.equal(parseWater('ho bevuto 1,5 litri'), 1500);
  assert.equal(parseWater('500 ml'), 500);
  assert.equal(parseWater('due bicchieri'), 400);
  assert.equal(parseWater('una bottiglia'), 500);
  assert.equal(parseWater('1.5'), 1500);
  assert.equal(parseWater('ciao'), null);
  assert.equal(waterGoal(70), 2100);
  assert.equal(waterGoal(undefined), 2000);
});

test('orari dei promemoria acqua', () => {
  assert.deepEqual(waterTimes(180, '09:00', '21:00'), ['09:00', '12:00', '15:00', '18:00', '21:00']);
  assert.ok(waterTimes(60).length <= 8);
  assert.equal(slotOf(at(2026, 10, 20, 8)), 'colazione');
  assert.equal(dayOf(at(2026, 10, 20, 8)), '2026-10-20');
  assert.equal(sumTotals([]).kcal, 0);
});

test('stato rispetto al limite: ok, arancione fino al 15%, poi rosso', () => {
  assert.equal(limitState(1800, 2000), 'ok');
  assert.equal(limitState(2000, 2000), 'ok');
  assert.equal(limitState(2200, 2000), 'warn');
  assert.equal(limitState(2400, 2000), 'over');
  assert.equal(limitState(5, undefined), 'ok');
});

test('qualità complessiva: alta con valori in linea, bassa con eccessi', () => {
  const tg = { kcal: 2000, protein: 80, carbs: 250, fat: 67, fibre: 28, sugarMax: 50, satMax: 22, saltMax: 5 };
  const buona = quality({ days: 5, asked: 7, avg: { kcal: 1950, p: 85, c: 240, f: 65, sat: 15, sug: 40, fib: 28, salt: 4 }, mealsPerDay: 3, waterMl: 2000, waterDays: 5 }, tg);
  const cattiva = quality({ days: 5, asked: 7, avg: { kcal: 2900, p: 40, c: 380, f: 120, sat: 45, sug: 120, fib: 8, salt: 9 }, mealsPerDay: 3, waterMl: 700, waterDays: 5 }, tg);
  assert.ok(buona.score >= 90, String(buona.score));
  assert.equal(buona.label, 'Ottima');
  assert.ok(cattiva.score < 40, String(cattiva.score));
  assert.equal(cattiva.level, 'carenza');
  assert.equal(quality(dayStats(undefined, 0), tg), null);
  assert.equal(quality(dayStats({ key: 'k', ts: 0, meals: [], total: { kcal: 1900, p: 80, c: 230, f: 60 } }, 2000), tg).parts.length, 8);
});

import { MICRO_KEYS, microCategory, microFor, microRows, sumMicro, scaleMicro, zeroMicro, NUTRITION_LEGAL } from '../src/lib/fitness/micro.ts';

test('vitamine e minerali stimati per categoria', () => {
  assert.equal(microCategory('Spinaci al vapore'), 'leafy');
  assert.equal(microCategory('Salmone alla piastra'), 'fattyfish');
  assert.equal(microCategory('Lenticchie cotte'), 'legumes');
  assert.equal(microCategory('Patatine fritte'), 'junk');
  assert.equal(microCategory('Qualcosa di sconosciuto'), 'default');
  const salmone = microFor({ name: 'Salmone' }, 150);
  assert.ok(salmone.vitD > 10 && salmone.omega3 > 2000);
  const arancia = microFor({ name: 'Arancia' }, 200);
  assert.ok(arancia.vitC > 100);
  assert.equal(MICRO_KEYS.length, 17);
  const tot = sumMicro([salmone, arancia, undefined]);
  assert.ok(tot.vitC >= arancia.vitC && tot.vitD >= salmone.vitD);
  assert.equal(scaleMicro(tot, 0.5).vitC, Math.round(tot.vitC * 50) / 100);
  const rows = microRows(zeroMicro());
  assert.ok(rows.every((r) => r.level === 'molto-basso' && r.pct === 0));
  assert.equal(microRows(microFor({ name: 'Arancia' }, 300)).find((r) => r.key === 'vitC').level, 'ok');
  assert.match(NUTRITION_LEGAL, /non dati medici/);
});

import { trainingSeries, dietSeries } from '../src/lib/fitness/scoreInputs.ts';
import { junkKcalOfMeal } from '../src/lib/fitness/mealMicro.ts';

test('il cibo spazzatura mette un tetto alla qualità', () => {
  const tg = { kcal: 2000, protein: 80, carbs: 250, fat: 67, fibre: 28, sugarMax: 50, satMax: 22, saltMax: 5 };
  const base = { days: 5, asked: 7, avg: { kcal: 1950, p: 85, c: 240, f: 65, sat: 15, sug: 40, fib: 28, salt: 4 }, mealsPerDay: 3, waterMl: 2000, waterDays: 5 };
  const pulito = quality({ ...base, junkShare: 0.05 }, tg);
  const sporco = quality({ ...base, junkShare: 0.8 }, tg);
  assert.ok(pulito.score >= 85, String(pulito.score));
  assert.ok(sporco.score <= 35, String(sporco.score));
  assert.equal(quality({ ...base, junkShare: 0.55 }, tg).score <= 50, true);
  assert.ok(pulito.parts.some((p) => p.id === 'junk'));
});

test('cibo spazzatura riconosciuto dagli ingredienti', () => {
  const junk = junkKcalOfMeal({ name: 'Pasto', macros: { kcal: 900, p: 20, c: 90, f: 50 }, items: [{ foodId: 'patatine', name: 'Patatine fritte', grams: 130 }] });
  assert.ok(junk > 300);
  assert.equal(junkKcalOfMeal({ name: 'Insalata di pollo', macros: { kcal: 400, p: 40, c: 10, f: 10 } }), 0);
  assert.equal(junkKcalOfMeal({ name: 'Gelato', macros: { kcal: 250, p: 4, c: 30, f: 12 } }), 250);
});

test('serie per il Life Score: allenamenti e qualità del cibo', () => {
  assert.equal(trainingSeries([], undefined, '2026-10-21'), null);
  const t = trainingSeries([{ date: '2026-10-20' }, { date: '2026-10-18' }], 4, '2026-10-21');
  assert.equal(t.pts.length, 28);
  assert.equal(t.pts[t.pts.length - 2].v, 1);
  assert.equal(t.pts[t.pts.length - 1].v, 0);
  assert.equal(Math.round(t.target * 7), 4);
  const junkMeal = { id: 'a', ts: at(2026, 10, 19, 20), name: 'Pizza e patatine e cola', grams: 500, macros: { kcal: 1400, p: 40, c: 160, f: 60, sat: 20, sug: 30, fib: 4, salt: 5 } };
  const sera = dietSeries([junkMeal], {}, null, '2026-10-21', 10);
  assert.equal(sera.length, 1);
  assert.ok(sera[0].v < 45, String(sera[0].v));
  assert.equal(dietSeries([{ ...junkMeal, ts: at(2026, 10, 21, 9) }], {}, null, '2026-10-21', 10).length, 0);
});

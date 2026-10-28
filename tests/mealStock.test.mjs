import test from 'node:test';
import assert from 'node:assert/strict';
import { missingForMeal, upcomingMealAlerts, haveGrams, DEFAULT_MEAL_ALERT } from '../src/lib/fitness/mealStock.ts';
import { parsePlanReply, looksLikeDietPlan, PLAN_PDF_PROMPT } from '../src/lib/fitness/planPdf.ts';
import { parseAiPlan, mergePlan } from '../src/lib/fitness/aiPlan.ts';

const items = [{ id: '1', name: 'Yogurt greco', qty: 500, unit: 'g', min: 50, addedAt: 0 }];
const plan = mergePlan(null, parseAiPlan({ giorni: [{ g: 0, pasti: [{ s: 'colazione', n: 'Yogurt e avena', i: [{ n: 'yogurt greco', g: 170, k: 100, p: 9, c: 4, f: 5 }, { n: 'fiocchi di avena', g: 40, k: 370, p: 13, c: 60, f: 7 }] }] }] }).days);

test('manca solo ciò che non c\'è in frigo (anche per nome simile)', () => {
  const m = plan[0][0];
  const miss = missingForMeal(m, items);
  assert.equal(miss.length, 1); assert.match(miss[0].toLowerCase(), /avena/);
  assert.ok(haveGrams(m.items[0].foodId, items) >= 170);
});
test('avvisi: solo pasti futuri con ingredienti mancanti e frigo non vuoto', () => {
  const now = new Date(2026, 9, 26, 6, 0); // lunedì 26/10/2026 06:00
  const a = upcomingMealAlerts(plan, items, now, DEFAULT_MEAL_ALERT, 1);
  assert.equal(a.length, 1); assert.equal(a[0].at.getHours(), 7); assert.equal(a[0].slot, 'colazione');
  assert.equal(upcomingMealAlerts(plan, [], now, DEFAULT_MEAL_ALERT, 1).length, 0);
  assert.equal(upcomingMealAlerts(plan, items, now, { ...DEFAULT_MEAL_ALERT, on: false }, 1).length, 0);
  assert.equal(upcomingMealAlerts(plan, items, new Date(2026, 9, 26, 7, 30), DEFAULT_MEAL_ALERT, 1).length, 0);
});
test('PDF del nutrizionista: riconoscimento e lettura della risposta', () => {
  assert.equal(looksLikeDietPlan('Piano alimentare. Colazione: 200 g yogurt. Pranzo: 80 g pasta. Cena: pesce 150 g. Spuntino: frutta'), true);
  assert.equal(looksLikeDietPlan('Fattura n. 123 importo 50 CHF'), false);
  assert.ok(parsePlanReply('```json\n{"giorni":[]}\n```')); assert.equal(parsePlanReply('niente'), null);
  assert.match(PLAN_PDF_PROMPT('xyz'), /TESTO DEL PIANO:\nxyz/);
});

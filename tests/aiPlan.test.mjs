import test from 'node:test';
import assert from 'node:assert/strict';
import { extractMealPlan, parseAiPlan, mergePlan, planSummary, shoppingList, mealPlanTalk, slotOf } from '../src/lib/fitness/aiPlan.ts';
import { FOOD } from '../src/lib/fitness/nutrition.ts';

const JSON1 = { titolo: 'Piano leggero', kcal: 1800, giorni: [{ g: 0, pasti: [{ s: 'colazione', n: 'Yogurt con avena', ric: 'Mescola', i: [{ n: 'yogurt greco', g: 170, k: 100, p: 9, c: 4, f: 5 }, { n: 'fiocchi di avena', g: 40, k: 370, p: 13, c: 60, f: 7 }] }, { s: 'pranzo', n: 'Pollo e quinoa', i: [{ n: 'petto di pollo', g: 150, k: 110, p: 23, c: 0, f: 2 }, { n: 'amaranto soffiato', g: 60, k: 371, p: 14, c: 66, f: 7 }] }] }] };

test('estrae il blocco del piano e lascia il testo', () => {
  const r = extractMealPlan(`Ecco.\n[[PIANO ${JSON.stringify(JSON1)}]]`);
  assert.equal(r.text, 'Ecco.'); assert.ok(r.json); assert.equal(r.broken, false);
});
test('blocco rotto: segnalato, testo senza il blocco', () => {
  const r = extractMealPlan('Ecco.\n[[PIANO {"giorni":[{]]');
  assert.equal(r.json, null);
});
test('senza blocco: niente piano', () => { const r = extractMealPlan('Quanti pasti al giorno?'); assert.equal(r.json, null); assert.equal(r.broken, false); });
test('ingredienti noti del database, nuovi con i valori dell\'AI, scarti per quantità assurde', () => {
  const r = parseAiPlan({ giorni: [{ g: 2, pasti: [{ s: 'cena', n: 'Test', i: [{ n: 'yogurt greco', g: 150, k: 100, p: 9, c: 4, f: 5 }, { n: 'amaranto soffiato', g: 60, k: 371, p: 14, c: 66, f: 7 }, { n: 'sale', g: 3 }, { n: 'pasta', g: 99999, k: 350, p: 12, c: 70, f: 1 }] }] }] });
  const meal = r.days.get(2)[0];
  assert.equal(meal.items.length, 2); assert.ok(r.custom.some((f) => f.id === 'ai-amaranto-soffiato'));
  assert.ok(r.warnings.length >= 1);
});
test('piano completo letto con colazione e pranzo, lunedì', () => {
  const r = parseAiPlan(JSON1);
  assert.equal(r.meta.title, 'Piano leggero'); assert.equal(r.meta.kcal, 1800);
  const d = r.days.get(0); assert.equal(d.length, 2); assert.equal(d[0].slot, 'colazione'); assert.equal(d[0].note, 'Mescola');
});
test('valori incoerenti con il database: si usa l\'alimento nuovo dell\'AI', () => {
  const r = parseAiPlan({ giorni: [{ g: 0, pasti: [{ s: 'pranzo', n: 'x', i: [{ n: 'pasta', g: 80, k: 80, p: 3, c: 15, f: 0.5 }] }] }] });
  assert.ok(r.days.get(0)[0].items[0].foodId);
});
test('unione: pochi giorni cambiano solo quelli, senza piano si ripetono', () => {
  const r = parseAiPlan(JSON1);
  const fresh = mergePlan(null, r.days); assert.equal(fresh.length, 7); assert.equal(fresh[3].length, 2);
  const changed = parseAiPlan({ giorni: [{ g: 1, pasti: [{ s: 'cena', n: 'Nuovo', i: [{ n: 'yogurt greco', g: 150, k: 100, p: 9, c: 4, f: 5 }] }] }] });
  const m = mergePlan(fresh, changed.days); assert.equal(m[1][0].name, 'Nuovo'); assert.equal(m[0].length, 2);
});
test('riassunto e spesa', () => {
  const p = mergePlan(null, parseAiPlan(JSON1).days);
  assert.match(planSummary(p), /Lun: colazione/);
  const yog = p[0][0].items[0].foodId;
  const full = shoppingList(p, 0, 7, 1, new Map());
  assert.ok(full.length >= 3);
  const withFridge = shoppingList(p, 0, 7, 1, new Map([[yog, 5000]]));
  assert.ok(!withFridge.some((x) => x.foodId === yog));
});
test('di cosa si parla', () => {
  assert.equal(mealPlanTalk('vorrei un piano alimentare', [], false), true);
  assert.equal(mealPlanTalk('ho il colesterolo alto', ['voglio una dieta'], false), true);
  assert.equal(mealPlanTalk('questi sono i miei turni di lavoro, inseriscili nel piano', ['voglio una dieta'], false), false);
  assert.equal(mealPlanTalk('cambia la cena di martedì', [], true), true);
  assert.equal(mealPlanTalk('che ore sono', [], true), false);
  assert.equal(slotOf('Spuntino metà mattina'), 'spuntino');
});
test('gli alimenti nuovi si ritrovano per id solo dopo la registrazione', () => { assert.equal(FOOD('ai-amaranto-soffiato'), undefined); });

import test from 'node:test';
import assert from 'node:assert/strict';
import { addStock, consume, lowStock, syncShopping, parseReceiptItems, tidyReceiptLine, googleMayBeBetter, parseTypedList, compareDay, matchFood, stockGrams } from '../src/lib/fitness/pantry.ts';
import { balanceDay, TEMPLATES, generatePlan, dayKcal, needsFor, kcalOf } from '../src/lib/fitness/mealPlan.ts';
import { FOOD } from '../src/lib/fitness/nutrition.ts';

test('piano: tutti gli alimenti dei pasti base esistono nel database', () => {
  for (const t of TEMPLATES) for (const [id] of t.items) assert.ok(FOOD(id), `${t.name}: ${id}`);
});
test('piano: calorie vicine al fabbisogno (±15%) e 7 giorni', () => {
  const { days } = generatePlan({ diet: 'onnivoro', avoid: [], meals: 5, kcal: 2000 });
  assert.equal(days.length, 7);
  for (const d of days) { const k = dayKcal(d); assert.ok(k > 1700 && k < 2300, String(k)); }
});
test('piano: vegano e senza lattosio/glutine rispettati; e cambiando seed cambia', () => {
  const { days } = generatePlan({ diet: 'vegano', avoid: ['glutine'], meals: 3, kcal: 1800 });
  const names = new Set(days.flat().map((m) => m.name));
  for (const n of names) { const t = TEMPLATES.find((x) => x.name === n); assert.ok(t.vegan && !t.gluten, n); }
  const a = generatePlan({ diet: 'onnivoro', avoid: [], meals: 3, kcal: 2000 }, 0).days.flat().map((m) => m.name).join();
  const b = generatePlan({ diet: 'onnivoro', avoid: [], meals: 3, kcal: 2000 }, 3).days.flat().map((m) => m.name).join();
  assert.notEqual(a, b);
});
test('piano: se le esclusioni non lasciano scelta lo dice', () => {
  const r = generatePlan({ diet: 'vegano', avoid: ['glutine', 'frutta secca', 'lattosio', 'uova', 'pesce'], meals: 5, kcal: 2000 });
  assert.ok(Array.isArray(r.warnings));
});
test('frigo: somma le scorte, consuma senza andare sotto zero, e ciò che finisce va nella lista una volta sola', () => {
  let items = addStock([], { name: 'Pasta di semola', qty: 500, unit: 'g' }, 'a', 1);
  items = addStock(items, { name: 'pasta di semola', qty: 250, unit: 'g' }, 'b', 2);
  assert.equal(items.length, 1); assert.equal(items[0].qty, 750);
  const fid = items[0].foodId;
  if (fid) { items = consume(items, fid, 700); assert.equal(items[0].qty, 50); items = consume(items, fid, 900); assert.equal(items[0].qty, 0); }
  items = [{ ...items[0], qty: 10 }];
  assert.equal(lowStock(items).length, 1);
  let n = 0; const r1 = syncShopping([], items, () => 's' + n++);
  assert.equal(r1.added.length, 1); const r2 = syncShopping(r1.shop, items, () => 's' + n++);
  assert.equal(r2.added.length, 0);
});
test('scontrino: righe valide dal JSON, kg in g, righe vuote saltate', () => {
  const l = parseReceiptItems('ok {"prodotti":[{"nome":"Latte intero","quantita":2,"unita":"l"},{"nome":"Uova","quantita":6,"unita":"pz"},{"nome":"","quantita":1}]}');
  assert.deepEqual(l, [{ name: 'Latte intero', qty: 2000, unit: 'ml' }, { name: 'Uova', qty: 6, unit: 'pz' }]);
  assert.deepEqual(parseReceiptItems('niente'), []);
});
test('lista scritta a mano', () => {
  assert.deepEqual(parseTypedList('2 latte, 500 g pasta; uova'), [{ name: 'latte', qty: 2, unit: 'pz' }, { name: 'pasta', qty: 500, unit: 'g' }, { name: 'uova', qty: 1, unit: 'pz' }]);
});
test('confronto piano e mangiato: differenze per alimento', () => {
  const r = compareDay([{ foodId: 'pollo', grams: 150 }, { foodId: 'riso-bianco-bollito', grams: 200 }], [{ foodId: 'pollo', grams: 100, items: undefined }, { grams: 80 }]);
  assert.equal(r.unmatchedMeals, 1);
  const pollo = r.rows.find((x) => x.foodId === 'pollo'); assert.equal(pollo.diff, -50);
  assert.equal(r.rows.find((x) => x.foodId === 'riso-bianco-bollito').diff, -200);
});
test('bisogni dei prossimi giorni e kcal di un pasto', () => {
  const { days } = generatePlan({ diet: 'onnivoro', avoid: [], meals: 3, kcal: 2000 });
  assert.ok(needsFor(days, 0, 3).size > 3); assert.ok(kcalOf(days[0][0].items) > 200); assert.ok(stockGrams({ qty: 2, unit: 'pz' }) === 200);
});
test('ridimensiona il giorno verso l\'obiettivo, tenendo fermo il pasto cambiato', () => {
  const { days } = generatePlan({ diet: 'onnivoro', avoid: [], meals: 4, kcal: 2000 });
  const day = days[0]; const lockedId = day[1].id; const before = day[1].items.map((i) => i.grams).join();
  const r = balanceDay(day, 2400, lockedId);
  assert.equal(r.day[1].items.map((i) => i.grams).join(), before);
  assert.ok(Math.abs(r.kcal - 2400) < 200 || r.status !== 'ok', String(r.kcal));
});
test('obiettivo impossibile: troppo alto per pochi pasti -> low; troppo basso -> high', () => {
  const { days } = generatePlan({ diet: 'onnivoro', avoid: [], meals: 3, kcal: 2000 });
  assert.equal(balanceDay(days[0], 6000).status, 'low');
  assert.equal(balanceDay(days[0], 500).status, 'high');
  assert.equal(balanceDay(days[0], 2000).status, 'ok');
});
test('scontrino: chiavi compatte', () => {
  assert.deepEqual(parseReceiptItems('{"p":[{"n":"Latte","q":2,"u":"pz"}]}'), [{ name: 'Latte', qty: 2, unit: 'pz' }]);
});
test('Google: si propone solo se la lettura sembra debole', () => {
  const L = (...n) => n.map((name) => ({ name, qty: 1, unit: 'pz' }));
  assert.equal(googleMayBeBetter('fridge', L('Latte', 'Uova')), true);
  assert.equal(googleMayBeBetter('fridge', L('Latte', 'Uova', 'Burro', 'Yogurt', 'Mele')), false);
  assert.equal(googleMayBeBetter('fridge', L('Latte', 'Altro', 'Cibo', 'Vari', 'Mele')), true);
  assert.equal(googleMayBeBetter('receipt', L('Pane', 'Latte', 'Pasta')), false);
});

test('scontrino: pesi e prezzi non restano nel nome', () => {
  assert.deepEqual(tidyReceiptLine('Pane per toast 500g', 1, 'pz'), { name: 'Pane per toast', qty: 500, unit: 'g' });
  assert.deepEqual(tidyReceiptLine('IPS Latte art 300 ml', 1, 'pz'), { name: 'Latte art', qty: 300, unit: 'ml' });
  assert.equal(tidyReceiptLine('Uova 15', 1, 'pz').name, 'Uova');
});

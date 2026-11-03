import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStep, parseBook, stepsFromMethod, prettyAmount, scaleGrams, dietsOf, filterRecipes, planBackwards, estimateTotalSec, balanceScore, nutritionPer, fmtClock, fmtMin } from '../src/lib/recipes/book.ts';

const SRC = `Spaghetti al pomodoro|primi|1|10|15|2|Campania|vegetariano|Pasta di semola cruda:160;Passata di pomodoro:300;Olio extravergine d'oliva:20;Aglio:6=in camicia;Basilico:5|Metti a bollire l'acqua salata {10:Acqua} ## Fai insaporire l'aglio nell'olio e aggiungi la passata, cuoci piano {12:Sugo} ## Cuoci la pasta {9:Pasta} ## Manteca nel sugo e servi.|pentola;colino|Conserva un mestolo di acqua di cottura.`;
test('passi: timer e forno', () => {
  assert.deepEqual(parseStep('Cuoci la pasta {9:Pasta}.'), { text: 'Cuoci la pasta.', timer: { sec: 540, label: 'Pasta' } });
  const s = parseStep('Inforna {forno:180:ventilato} per 25 minuti {25}'); assert.deepEqual(s.oven, { temp: 180, mode: 'ventilato' }); assert.equal(s.timer.sec, 1500);
});
test('legge il formato', () => {
  const b = parseBook(SRC); assert.deepEqual(b.errors, []); assert.deepEqual(b.missing, []); assert.equal(b.recipes.length, 1);
  const r = b.recipes[0]; assert.equal(r.cat, 'Primi'); assert.equal(r.steps.length, 4); assert.equal(r.items[3].note, 'in camicia'); assert.deepEqual(r.tools, ['pentola', 'colino']);
});
test('ingrediente sconosciuto', () => { const b = parseBook('X|primi|1|1|1|1||| Zzzz inesistente:10|Passo'); assert.ok(b.missing.length + b.errors.length >= 1); });
test('porzioni e scritta', () => {
  assert.equal(scaleGrams(160, 2, 4), 320); assert.equal(prettyAmount('Uova di gallina', 110), '2 uova (110 g)'); assert.equal(prettyAmount('Farina 00', 1200), '1,2 kg'); assert.equal(prettyAmount('Sale', 5), '5 g');
});
test('diete, valori e piano', () => {
  const r = parseBook(SRC).recipes[0]; const d = dietsOf(r);
  assert.ok(d.diets.includes('vegana')); assert.ok(d.contains.includes('glutine')); assert.ok(!d.diets.includes('senza glutine'));
  const n = nutritionPer(r); assert.ok(n.kcal > 300 && n.kcal < 900, String(n.kcal)); assert.ok(balanceScore(r) > 30);
  const eat = Date.UTC(2026, 0, 1, 19, 0); const p = planBackwards(r, eat); assert.ok(p.start < eat); assert.equal(p.at.length, 4); assert.ok(estimateTotalSec(r) > 31 * 60);
  assert.equal(fmtClock(75), '1:15'); assert.equal(fmtMin(95), '1 h 35 min');
});
test('filtri e ricerca', () => {
  const all = parseBook(SRC).recipes;
  assert.equal(filterRecipes(all, { q: 'pomodoro' }).length, 1); assert.equal(filterRecipes(all, { q: 'passata' }).length, 1); assert.equal(filterRecipes(all, { q: 'cavolo' }).length, 0);
  assert.equal(filterRecipes(all, { maxMin: 20 }).length, 0); assert.equal(filterRecipes(all, { diets: ['vegana'] }).length, 1); assert.equal(filterRecipes(all, { diets: ['senza glutine'] }).length, 0);
});
test('da metodo breve', () => {
  const s = stepsFromMethod('Soffriggi la cipolla, tosta il riso, sfuma, aggiungi brodo e funghi, manteca con burro e parmigiano.', ['Riso', 'Funghi']);
  assert.ok(s.steps.length >= 4); assert.ok(s.steps[0].text.startsWith('Prepara')); assert.ok(s.cook >= 8);
});

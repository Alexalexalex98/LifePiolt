import test from 'node:test';
import assert from 'node:assert/strict';
import { isBarcode, offUrl, parseOff } from '../src/lib/fitness/barcode.ts';
import { mealsToCsv } from '../src/lib/fitness/diaryExport.ts';
import { fastStatus, hmToMin, minToHm, fmtLeft } from '../src/lib/fitness/fasting.ts';

test('codice a barre: formato e lettura di Open Food Facts', () => {
  assert.equal(isBarcode('8076809513722'), true); assert.equal(isBarcode('12ab'), false);
  assert.match(offUrl('8076809513722'), /api\/v2\/product\/8076809513722\.json/);
  const f = parseOff('8076809513722', { status: 1, product: { product_name: 'Spaghetti n.5', brands: 'Barilla,Altro', serving_quantity: '80', nutriments: { 'energy-kcal_100g': 359, proteins_100g: '13', carbohydrates_100g: 71.2, fat_100g: 2, 'saturated-fat_100g': 0.5, salt_100g: 0.01 } } });
  assert.deepEqual([f.name, f.kcal, f.p, f.c, f.f, f.portion, f.id], ['Spaghetti n.5 · Barilla', 359, 13, 71.2, 2, 80, 'off-8076809513722']);
  assert.equal(parseOff('1', { status: 0 }), null); assert.equal(parseOff('1', { status: 1, product: { nutriments: {} } }), null);
  const kj = parseOff('2', { status: 1, product: { nutriments: { energy_100g: 418.4, proteins_100g: 1 } } }); assert.equal(kj.kcal, 100);
});
test('esporta il diario in CSV con virgolette e ordine per data', () => {
  const csv = mealsToCsv([{ ts: Date.UTC(2026, 10, 2, 12), name: 'Pasta, sugo', grams: 250, macros: { kcal: 400, p: 12, c: 70, f: 8 } }, { ts: Date.UTC(2026, 10, 1, 8), name: 'Caffè', grams: 30, macros: { kcal: 2, p: 0, c: 0, f: 0 } }]);
  const lines = csv.split('\n'); assert.equal(lines.length, 3); assert.match(lines[1], /Caffè/); assert.match(lines[2], /"Pasta, sugo"/);
});
test('digiuno 16:8: finestra del cibo dalle 12 alle 20', () => {
  const s = hmToMin('12:00');
  assert.deepEqual(fastStatus(13 * 60, s, 8), { eating: true, minutesLeft: 7 * 60, progress: 1 / 8, phaseMinutes: 480 });
  const n = fastStatus(22 * 60, s, 8); assert.equal(n.eating, false); assert.equal(n.minutesLeft, 14 * 60);
  const m = fastStatus(2 * 60, s, 8); assert.equal(m.eating, false); assert.equal(m.minutesLeft, 10 * 60);
  assert.equal(minToHm(20 * 60), '20:00'); assert.equal(fmtLeft(135), '2 h 15 min'); assert.equal(fmtLeft(40), '40 min');
});

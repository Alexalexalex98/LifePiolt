import test from 'node:test';
import assert from 'node:assert/strict';
import { watermarkLabel, watermarkTiles } from '../src/lib/watermark.ts';

test('filigrana: nome e cognome, altrimenti il nome dell\'account, mai troppo lunga', () => {
  assert.equal(watermarkLabel(' Alex ', 'Stefanovic', 'alex'), 'Alex Stefanovic'); assert.equal(watermarkLabel('', '', ' Alex '), 'Alex'); assert.equal(watermarkLabel('', '', ''), '');
  assert.equal(watermarkLabel('A'.repeat(30), 'B'.repeat(30), ''), ('A'.repeat(30) + ' ' + 'B'.repeat(30)).slice(0, 40));
});
test('filigrana: la griglia copre tutta l\'area, è sfalsata e cambia con la sessione', () => {
  assert.deepEqual(watermarkTiles(0, 100), []); assert.deepEqual(watermarkTiles(100, 0), []);
  const t = watermarkTiles(390, 220, 5);
  const inside = (a) => t.filter((p) => p.x >= -150 && p.x <= a.w && p.y >= -84 && p.y <= a.h);
  assert.ok(inside({ w: 390, h: 220 }).length >= 6, 'abbastanza scritte');
  // qualsiasi ritaglio di 150x84 contiene almeno l'inizio di una scritta
  for (let x = 0; x <= 240; x += 40) for (let y = 0; y <= 136; y += 34) assert.ok(t.some((p) => p.x > x - 150 && p.x < x + 150 && p.y > y - 84 && p.y < y + 84), `ritaglio ${x},${y}`);
  assert.equal(new Set(t.map((p) => p.key)).size, t.length, 'chiavi uniche');
  assert.notDeepEqual(watermarkTiles(390, 220, 5).map((p) => [p.x, p.y]), watermarkTiles(390, 220, 6).map((p) => [p.x, p.y]));
  const rows = [...new Set(t.map((p) => p.y))]; const a = t.filter((p) => p.y === rows[0]), b = t.filter((p) => p.y === rows[1]);
  assert.notEqual(a[0].x % 150, b[0].x % 150, 'righe sfalsate');
});

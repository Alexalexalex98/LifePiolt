import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, BY_SYM, KINDS } from '../src/lib/markets/catalog.ts';
import { parseQuotesCsv, parseHistoryCsv, chunk, usdToLp, changePct, simulatedPrice, simulatedHistory, feedCode, symFromFeed } from '../src/lib/markets/quotes.ts';

test('elenco titoli: almeno 200, senza doppioni, ogni genere presente', () => {
  assert.ok(CATALOG.length >= 200, String(CATALOG.length));
  assert.equal(new Set(CATALOG.map((i) => i.sym)).size, CATALOG.length);
  for (const k of KINDS) assert.ok(CATALOG.some((i) => i.kind === k), k);
  assert.ok(CATALOG.every((i) => i.last > 0 && i.name && i.sector));
  assert.equal(BY_SYM.AAPL.kind, 'azione');
});
test('lettura dei prezzi: righe valide, N/D saltate, codici', () => {
  const csv = 'Symbol,Date,Time,Open,High,Low,Close,Volume\nAAPL.US,2025-01-10,22:00:19,230,235,228,233.5,1000\nZZZ.US,N/D,N/D,N/D,N/D,N/D,N/D,N/D\nBRK-B.US,2025-01-10,22:00:19,450,455,449,452,10';
  const q = parseQuotesCsv(csv);
  assert.deepEqual(Object.keys(q).sort(), ['AAPL', 'BRK-B']);
  assert.equal(q.AAPL.price, 233.5);
  assert.equal(parseQuotesCsv('niente').AAPL, undefined);
  assert.equal(feedCode('BRK-B'), 'brk-b.us');
  assert.equal(symFromFeed('AAPL.US'), 'AAPL');
});
test('storico, blocchi, cambio e variazione', () => {
  assert.deepEqual(parseHistoryCsv('Date,Open,High,Low,Close,Volume\n2025-01-02,1,1,1,10,5\n2025-01-03,1,1,1,11,5'), [10, 11]);
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.equal(usdToLp(100, 0.9), 90);
  assert.equal(Math.round(changePct({ price: 110, open: 100 })), 10);
  assert.equal(Math.round(changePct({ price: 110, open: 100, prev: 110 })), 0);
});
test('prezzi dimostrativi: stabili, vicini all\'ultimo noto, storico finisce al prezzo', () => {
  const now = 1_700_000_000_000;
  const a = simulatedPrice('AAPL', 230, now), b = simulatedPrice('AAPL', 230, now);
  assert.equal(a, b);
  assert.ok(Math.abs(a / 230 - 1) < 0.3);
  const h = simulatedHistory('AAPL', a, 100);
  assert.equal(h.length, 100);
  assert.equal(h[99], a);
});

import { buy, sell, pnl, portfolio } from '../src/lib/markets/invest.ts';
test('compravendita in LP: quote frazionate, costi proporzionali, errori chiari', () => {
  assert.equal(buy(undefined, 'AAPL', 0.5, 200, 100).ok, false);
  assert.equal(buy(undefined, 'AAPL', 500, 200, 100).ok, false);
  const b = buy(undefined, 'AAPL', 100, 200, 1000);
  assert.ok(b.ok && b.units === 0.5 && b.position.costLp === 100);
  const b2 = buy(b.position, 'AAPL', 100, 100, 1000); // più basso: 1 quota in più
  assert.ok(b2.ok && b2.position.units === 1.5 && b2.position.costLp === 200);
  const s = sell(b2.position, 75, 200);
  assert.ok(s.ok && s.units === 0.375 && s.position.units === 1.125 && s.position.costLp === 150);
  const all = sell(b2.position, 'all', 200);
  assert.ok(all.ok && all.amountLp === 300 && all.position === null);
  assert.equal(sell(b2.position, 9999, 200).ok, false);
  assert.equal(sell(undefined, 'all', 200).ok, false);
  const p = pnl({ sym: 'A', units: 2, costLp: 300 }, 200);
  assert.deepEqual([p.value, p.gain, Math.round(p.pct)], [400, 100, 33]);
  assert.equal(portfolio([{ sym: 'A', units: 1, costLp: 100 }, { sym: 'B', units: 2, costLp: 50 }], (s) => (s === 'A' ? 150 : 10)).gain, 20);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseMood, welch } from '../src/lib/moodAnalysis.ts';

const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const mk = (n, f, seed = 3) => { const r = rng(seed); return Array.from({ length: n }, (_, i) => ({ day: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`, weekday: i % 7, ...f(i, r) })); };

test('welch: gruppi identici -> 0, gruppi diversi -> grande', () => {
  assert.equal(welch([3, 3, 3, 3], [3, 3, 3, 3]), 0);
  assert.ok(welch([4, 4.2, 3.9, 4.1, 4], [2, 2.2, 1.9, 2.1, 2]) > 10);
});

test('dati insufficienti: nessun legame inventato', () => {
  const r = analyseMood(mk(10, () => ({ mood: 3, rain: 0 })));
  assert.equal(r.confidence, 'insufficiente'); assert.equal(r.factors.length, 0);
});

test('trova un legame vero pioggia -> umore piu basso', () => {
  const days = mk(60, (i, r) => { const rain = i % 3 === 0 ? 6 : 0; return { mood: 4 - (rain ? 1 : 0) + (r() - 0.5) * 0.4, rain, sun: rain ? 1 : 8 }; });
  const rep = analyseMood(days);
  const rain = rep.factors.find((f) => f.id === 'rain');
  assert.ok(rain && rain.sig && rain.diff < -0.7, JSON.stringify(rain));
  assert.match(rain.sentence, /pioggia/);
  assert.match(rain.tip, /piove|pioggia/i);
});

test('rumore puro: nessun fattore significativo', () => {
  const days = mk(60, (i, r) => ({ mood: 3 + (r() - 0.5), rain: r() < 0.3 ? 5 : 0, sleep: 6 + r() * 3, events: Math.floor(r() * 6), steps: 3000 + r() * 9000 }), 11);
  const rep = analyseMood(days);
  assert.equal(rep.factors.filter((f) => f.sig).length, 0, JSON.stringify(rep.factors.filter((f) => f.sig).map((f) => [f.id, f.t])));
});

test('giorno migliore e peggiore della settimana', () => {
  const days = mk(56, (i) => ({ mood: i % 7 === 5 ? 4.5 : i % 7 === 1 ? 2 : 3.2 }));
  const rep = analyseMood(days);
  assert.equal(rep.best.label, 'venerdì'); assert.equal(rep.worst.label, 'lunedì');
});

import { confirmFactor, confirmationOf } from '../src/lib/moodAnalysis.ts';
test('confirmationOf: etichette', () => {
  assert.equal(confirmationOf(-0.8, -0.7, 20, 20).status, 'confermata');
  assert.equal(confirmationOf(-0.8, 0.5, 20, 20).status, 'non si ripete');
  assert.equal(confirmationOf(-0.9, 0.0, 20, 20).status, 'non si ripete');
  assert.equal(confirmationOf(-0.8, -0.15, 20, 20).status, 'incerta');
  assert.equal(confirmationOf(null, -0.8, 20, 20).status, 'incerta');
});
test('confirmFactor: pioggia stabile in tutto il periodo = confermata', () => {
  const days = mk(60, (i, r) => { const rain = i % 3 === 0 ? 6 : 0; return { mood: 4 - (rain ? 1 : 0) + (r() - 0.5) * 0.4, rain, sun: rain ? 1 : 8 }; });
  // i giorni di mk si ripetono su 28 date: assegno date crescenti uniche
  days.forEach((d, i) => { const x = new Date(2026, 6, 1 + i); d.day = x.toISOString().slice(0, 10); });
  const rep = analyseMood(days);
  const rain = rep.factors.find((f) => f.id === 'rain');
  assert.equal(rain.confirmation.status, 'confermata');
  assert.equal(confirmFactor(days, 'rain').status, 'confermata');
});
test('confirmFactor: effetto solo nella prima meta = non si ripete', () => {
  const days = mk(60, (i, r) => { const rain = i % 3 === 0 ? 6 : 0; return { mood: 4 - (rain && i < 30 ? 1.2 : 0) + (r() - 0.5) * 0.3, rain, sun: rain ? 1 : 8 }; }, 5);
  days.forEach((d, i) => { const x = new Date(2026, 6, 1 + i); d.day = x.toISOString().slice(0, 10); });
  assert.equal(confirmFactor(days, 'rain').status, 'non si ripete');
});

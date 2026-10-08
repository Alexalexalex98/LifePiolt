import test from 'node:test';
import assert from 'node:assert/strict';
import { featureOfDay, guideMode, dayIndex, allFeatures, FULL_GUIDE_DAYS } from '../src/data/features.ts';

const at = (y, m, d, h = 10) => new Date(y, m - 1, d, h).getTime();

test('guida: completa nei primi 3 giorni, poi dipende da showOnOpen', () => {
  const first = at(2026, 10, 1, 23);
  assert.equal(guideMode({ firstSeenAt: null, now: first, showOnOpen: false }), 'full');
  assert.equal(guideMode({ firstSeenAt: first, now: at(2026, 10, 3), showOnOpen: false }), 'full');
  assert.equal(guideMode({ firstSeenAt: first, now: at(2026, 10, 4), showOnOpen: false }), 'none');
  assert.equal(guideMode({ firstSeenAt: first, now: at(2026, 10, 4), showOnOpen: true }), 'bite');
  assert.equal(guideMode({ firstSeenAt: first, now: at(2026, 10, 4), showOnOpen: true, lastBiteDay: dayIndex(at(2026, 10, 4)) }), 'none');
  assert.equal(FULL_GUIDE_DAYS, 3);
});

test('funzione del giorno: stabile nel giorno, diversa il giorno dopo, copre tutte', () => {
  assert.equal(featureOfDay(at(2026, 10, 8, 1)).title, featureOfDay(at(2026, 10, 8, 23)).title);
  assert.notEqual(featureOfDay(at(2026, 10, 8)).title, featureOfDay(at(2026, 10, 9)).title);
  const seen = new Set();
  for (let i = 0; i < allFeatures.length; i++) seen.add(featureOfDay(at(2026, 1, 1 + i)).title);
  assert.equal(seen.size, allFeatures.length);
});

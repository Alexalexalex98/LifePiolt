import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreText, analyzeMessages } from '../src/lib/chatSentiment.ts';
import { rhythmSeries, hydrationSeries } from '../src/lib/fitness/scoreInputs.ts';

test('parole di benessere, malessere e stress, con la negazione', () => {
  assert.deepEqual({ ...scoreText('Oggi sto bene, sono felice') }, { pos: 2, neg: 0, stress: 0, words: 5 });
  const n = scoreText('non sto bene, sono molto stressato e ho ansia');
  assert.ok(n.neg >= 1 && n.stress >= 2 && n.pos === 0);
  assert.equal(scoreText('non sono triste').pos, 1);
});
test('per giorno: tono e stress, solo con abbastanza segnali', () => {
  const day = (ts) => new Date(ts).toISOString().slice(0, 10);
  const t0 = Date.UTC(2026, 9, 20, 10);
  const r = analyzeMessages([
    { ts: t0, text: 'Sono stanco e stressato' }, { ts: t0 + 3600000, text: 'ho ansia per la scadenza' },
    { ts: t0 + 86400000, text: 'giornata bellissima, sto bene e sono felice, grazie' },
    { ts: t0 + 2 * 86400000, text: 'ok' },
  ], day);
  assert.equal(r.mood.length, 2);
  assert.ok(r.mood[0].v < 3 && r.mood[1].v > 3);
  assert.ok(r.stress[0].v > 60 && r.stress[1].v < 30);
});
test('ritmo dei pasti', () => {
  const at = (d, h, m = 0) => new Date(2026, 9, d, h, m).getTime();
  const r = rhythmSeries([{ ts: at(20, 8) }, { ts: at(20, 13) }, { ts: at(20, 20) }, { ts: at(21, 12) }, { ts: at(21, 23) }], '2026-10-27', 12);
  assert.deepEqual(r, [{ d: '2026-10-20', v: 100 }, { d: '2026-10-21', v: 45 }]);
});
test('idratazione in percentuale', () => {
  assert.deepEqual(hydrationSeries({ '2026-10-20': 1000, '2026-10-21': 3000, '2026-10-27': 500 }, 2000, '2026-10-27', 10), [{ d: '2026-10-20', v: 50 }, { d: '2026-10-21', v: 100 }]);
});

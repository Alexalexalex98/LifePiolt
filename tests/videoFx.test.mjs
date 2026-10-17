import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanVideoFx, loopTarget, playedSeconds } from '../src/lib/videoFx.ts';

test('montaggio video: pulizia, ritorno all\'inizio del taglio, durata', () => {
  assert.equal(cleanVideoFx({ speed: 1 }), undefined);
  assert.equal(cleanVideoFx({ speed: 3 }), undefined);
  assert.deepEqual(cleanVideoFx({ speed: 2, mute: true, trimStart: 2, trimEnd: 8 }, 10), { speed: 2, mute: true, trimStart: 2, trimEnd: 8 });
  assert.equal(cleanVideoFx({ trimStart: 9.8 }, 10), undefined);
  assert.equal(cleanVideoFx({ trimStart: 3, trimEnd: 3.2 }, 10)?.trimEnd, undefined);
  assert.equal(loopTarget(5, { trimStart: 2, trimEnd: 8 }), null);
  assert.equal(loopTarget(8.1, { trimStart: 2, trimEnd: 8 }), 2);
  assert.equal(loopTarget(0.5, { trimStart: 2 }), 2);
  assert.equal(loopTarget(3, undefined), null);
  assert.equal(playedSeconds(10, { trimStart: 2, trimEnd: 8, speed: 2 }), 3);
  assert.equal(playedSeconds(10), 10);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClassify, topicFromTalk, genericCaption, assignBodySlots, missingSlots } from '../src/lib/assistant/photoRouteCore.ts';

test('classificazione: tipi, viste del corpo e valori mancanti', () => {
  const r = parseClassify('```json\n{"f":[{"t":"corpo","v":"fronte"},{"t":"Frigo"},{"t":"piatto"}]}\n```', 4);
  assert.deepEqual(r.map((x) => x.kind), ['corpo', 'frigo', 'piatto', 'altro']); assert.equal(r[0].view, 'front');
  assert.deepEqual(parseClassify('boh', 2).map((x) => x.kind), ['altro', 'altro']);
});
test('argomento della conversazione', () => {
  assert.equal(topicFromTalk(['cosa posso cucinare con quello che ho in frigo?']), 'frigo');
  assert.equal(topicFromTalk(['volevo fare il controllo del corpo']), 'corpo');
  assert.equal(topicFromTalk(['ciao', 'come stai']), null);
  assert.equal(topicFromTalk(['quante calorie ha il mio pranzo?']), 'piatto');
});
test('didascalia generica o domanda vera', () => {
  assert.equal(genericCaption(''), true); assert.equal(genericCaption('ecco'), true); assert.equal(genericCaption('guarda queste'), true);
  assert.equal(genericCaption('cosa c\'è in questa foto?'), false); assert.equal(genericCaption('mi sai dire se questa email è una truffa o no'), false);
});
test('viste del corpo: assegnate per vista, poi in ordine; senza sovrascrivere', () => {
  const a = assignBodySlots([{ uri: 'a', view: 'back' }, { uri: 'b' }, { uri: 'c' }, { uri: 'd' }]);
  assert.equal(a.back, 'a'); assert.equal(a.front, 'b'); assert.equal(a.left, 'c'); assert.equal(a.right, 'd');
  const b = assignBodySlots([{ uri: 'x' }], { front: 'old' }); assert.equal(b.back, 'x');
  assert.deepEqual(missingSlots({ front: '1', right: '2' }), ['back', 'left']);
});

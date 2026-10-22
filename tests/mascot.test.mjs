import test from 'node:test';
import assert from 'node:assert/strict';
import { EYES_OF, stickerFromText, moodOf, mix, toHex, parseHex, bodyTones, EXPRESSIONS } from '../src/lib/mascot.ts';

test('colori: esadecimale, mescolanza ai due estremi e a metà', () => {
  assert.deepEqual(parseHex('#ff8000'), [255, 128, 0]); assert.equal(toHex([255, 128, 0]), '#ff8000');
  assert.equal(mix('#000000', '#ffffff', 0), '#000000'); assert.equal(mix('#000000', '#ffffff', 1), '#ffffff'); assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
});
test('le tinte del corpo: la luce è più chiara della base, l\'ombra più scura; occhi scuri', () => {
  const t = bodyTones('#6c8cff');
  const lum = (h) => { const [r, g, b] = parseHex(h); return r + g + b; };
  assert.ok(lum(t.light) > lum(t.base) && lum(t.base) > lum(t.shade) && lum(t.eye) < lum(t.shade));
});
test('espressioni tutte diverse, ognuna con occhi di base valida', () => { assert.ok(EXPRESSIONS.length >= 57); assert.equal(new Set(EXPRESSIONS.map((e) => e.id)).size, EXPRESSIONS.length); const ids = new Set(EXPRESSIONS.map((e) => e.id)); for (const [k, v] of Object.entries(EYES_OF)) { assert.ok(ids.has(k) && ids.has(v), k); assert.ok(!(v in EYES_OF), k + ' usa occhi non di base'); } });
test('l\'espressione segue la risposta: dubbio, capito, triste, felice', () => {
  assert.equal(moodOf('Non ho trovato dati sui movimenti.'), 'doubtful'); assert.equal(moodOf('Ho aggiunto il task al piano.'), 'understood');
  assert.equal(moodOf('Attenzione: il mese finisce in rosso.'), 'sad'); assert.equal(moodOf('Ecco cosa ho trovato.'), 'happy');
});
test('adesivo da una frase: espressione e colore, e se non capisce lo dice', () => {
  assert.deepEqual(stickerFromText('un adesivo che festeggia, rosso'), { expr: 'celebrating', color: '#ff5a5f', matched: true });
  assert.equal(stickerFromText('ti voglio bene').expr, 'love'); assert.equal(stickerFromText('I am so tired').expr, 'sleepy');
  assert.deepEqual(stickerFromText('qwerty'), { expr: 'happy', matched: false });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { stickerFromText, moodOf, mix, toHex, parseHex, bodyTones, EXPRESSIONS } from '../src/lib/mascot.ts';

test('colori: esadecimale, mescolanza ai due estremi e a metà', () => {
  assert.deepEqual(parseHex('#ff8000'), [255, 128, 0]); assert.equal(toHex([255, 128, 0]), '#ff8000');
  assert.equal(mix('#000000', '#ffffff', 0), '#000000'); assert.equal(mix('#000000', '#ffffff', 1), '#ffffff'); assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
});
test('le tinte del corpo: la luce è più chiara della base, l\'ombra più scura; occhi scuri', () => {
  const t = bodyTones('#6c8cff');
  const lum = (h) => { const [r, g, b] = parseHex(h); return r + g + b; };
  assert.ok(lum(t.light) > lum(t.base) && lum(t.base) > lum(t.shade) && lum(t.eye) < lum(t.shade));
});
test('26 espressioni, tutte diverse', () => { assert.equal(EXPRESSIONS.length, 26); assert.equal(new Set(EXPRESSIONS.map((e) => e.id)).size, 26); });
test('l\'espressione segue la risposta: dubbio, capito, triste, felice', () => {
  assert.equal(moodOf('Non ho trovato dati sui movimenti.'), 'doubtful'); assert.equal(moodOf('Ho aggiunto il task al piano.'), 'understood');
  assert.equal(moodOf('Attenzione: il mese finisce in rosso.'), 'sad'); assert.equal(moodOf('Ecco cosa ho trovato.'), 'happy');
});
test('adesivo da una frase: espressione e colore, e se non capisce lo dice', () => {
  assert.deepEqual(stickerFromText('un adesivo che festeggia, rosso'), { expr: 'celebrating', color: '#ff5a5f', matched: true });
  assert.equal(stickerFromText('ti voglio bene').expr, 'love'); assert.equal(stickerFromText('I am so tired').expr, 'sleepy');
  assert.deepEqual(stickerFromText('qwerty'), { expr: 'happy', matched: false });
});

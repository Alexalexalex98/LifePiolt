import test from 'node:test';
import assert from 'node:assert/strict';
import { speakable, pcmToWav, base64ToBytes, pcmRate, wantsToStop } from '../src/lib/voice/voiceText.ts';

test('speakable: toglie markdown, link, fonti ed elenchi', () => {
  const s = speakable(['**Ciao!** Ecco un [link](https://x.it) e https://y.it', '- primo\n- secondo', 'Fonti: ansa.it, corriere.it']);
  assert.ok(!/[*#\[\]]|https?:|Fonti/.test(s), s);
  assert.match(s, /Ciao/);
  assert.match(s, /primo/);
});
test('speakable: taglia a una frase intera e aggiunge il rimando', () => {
  const long = Array.from({ length: 60 }, (_, i) => `Questa è la frase numero ${i}.`).join(' ');
  const s = speakable([long], { max: 200, more: 'Il resto è in chat.' });
  assert.ok(s.length < 260); assert.match(s, /Il resto è in chat\.$/); assert.ok(/\.\s/.test(s));
});
test('pcm -> wav: intestazione corretta', () => {
  const pcm = new Uint8Array(480);
  const wav = pcmToWav(pcm, 24000);
  assert.equal(String.fromCharCode(...wav.subarray(0, 4)), 'RIFF');
  assert.equal(String.fromCharCode(...wav.subarray(8, 12)), 'WAVE');
  assert.equal(new DataView(wav.buffer).getUint32(24, true), 24000);
  assert.equal(wav.length, 44 + 480);
});
test('base64 e frequenza', () => {
  assert.deepEqual([...base64ToBytes('SGVsbG8=')], [72, 101, 108, 108, 111]);
  assert.equal(pcmRate('audio/L16;codec=pcm;rate=24000'), 24000);
  assert.equal(pcmRate(undefined), 24000);
});
test('comandi per chiudere', () => {
  assert.equal(wantsToStop('basta'), true); assert.equal(wantsToStop('Basta.'), true); assert.equal(wantsToStop('basta con le spese di ottobre'), false);
});
import { takeChunks, sentenceSpans, isEcho, cleanForSpeech } from '../src/lib/voice/voiceText.ts';
test('takeChunks: il primo pezzo è corto, non taglia frasi, il resto arriva alla fine', () => {
  const t = 'Certo, ci penso io. Ti dico subito i numeri di oggi: hai fatto 8000 passi e dormito sette ore. Poi ti consiglio una passeggiata serale per chiudere la giornata bene. E domani';
  const a = takeChunks(t, 0, false, true);
  assert.equal(a.chunks[0], 'Certo, ci penso io. Ti dico subito i numeri di oggi: hai fatto 8000 passi e dormito sette ore.');
  const b = takeChunks(t, a.to, false, false);
  assert.ok(b.chunks.every((c) => /[.!?]$/.test(c)));
  const c = takeChunks(t, b.to, true, false);
  assert.match(c.chunks.at(-1), /E domani$/);
  assert.equal(c.to, t.length);
});
test('sentenceSpans e isEcho', () => {
  const sp = sentenceSpans('Prima frase. Seconda frase! Terza');
  assert.deepEqual(sp.map((x) => x.start), [0, 13, 28]);
  assert.equal(isEcho('hai fatto ottomila passi', 'Oggi hai fatto ottomila passi e dormito bene'), true);
  assert.equal(isEcho('basta Theia fermati', 'Oggi hai fatto ottomila passi'), false);
  assert.equal(cleanForSpeech(['**Ciao** a tutti']), 'Ciao a tutti');
});

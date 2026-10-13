import test from 'node:test';
import assert from 'node:assert/strict';
import { PHRASE_SETS, PHRASE_COUNT, matchPhrase, contentTokens } from '../src/lib/assistant/phrases.ts';

test('almeno 600 frasi, tutte con almeno due parole significative', () => {
  assert.ok(PHRASE_COUNT >= 600, `solo ${PHRASE_COUNT}`);
  for (const s of PHRASE_SETS) for (const p of s.phrases) assert.ok(contentTokens(p).length >= 2, `frase troppo corta: «${p}» (${s.id})`);
});

test('ogni frase del corpus porta alla sua intenzione (stesso tipo e stesso obiettivo)', () => {
  const bad = [];
  for (const s of PHRASE_SETS) for (const p of s.phrases) {
    const h = matchPhrase(p);
    const ok = h && h.set.kind === s.kind && h.set.target === s.target && !!h.set.order === !!s.order;
    if (!ok) bad.push(`«${p}» (${s.id}) -> ${h ? h.set.id + ' «' + h.phrase + '»' : 'nessuna'}`);
  }
  assert.equal(bad.length, 0, '\n' + bad.slice(0, 40).join('\n'));
});

test('varianti non scritte nel corpus', () => {
  const t = (txt, people) => matchPhrase(txt, people)?.set.id ?? null;
  assert.equal(t('Voglio ordinare una pizza stasera'), 'pizza-ordina');
  assert.equal(t('vorrei ordinare una pizza margherita'), 'pizza-ordina');
  assert.equal(t('mi serve un dentista'), 'dentista');
  assert.equal(t('Ho tanta fame stasera'), 'ristorante');
  assert.equal(t('ordiniamo del sushi'), 'sushi-ordina');
  assert.equal(t('manda 10 lp a Roberta', ['Roberta Neri']), 'lp-invia');
  assert.equal(t('invia 35 lifepoints a Davide'), 'lp-invia');
  assert.equal(t('cosa devo fare adesso'), 'adesso');
  assert.equal(t('quanto ho speso questo mese'), 'fin-analisi');
  assert.equal(t('apri le impostazioni'), 'impostazioni');
});

test('niente frasi sbagliate su discorsi che non c\'entrano', () => {
  const t = (txt) => matchPhrase(txt)?.set.id ?? null;
  assert.equal(t('il cielo è blu'), null);
  assert.equal(t('che bella giornata'), null);
  assert.equal(t('grazie mille'), null);
  assert.equal(t('ciao'), null);
});

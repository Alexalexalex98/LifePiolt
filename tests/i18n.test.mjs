import test from 'node:test';
import assert from 'node:assert/strict';
import { registerCatalog, setActive, t, translateText } from '../src/i18n/core.ts';
import { detectLang, normalizeLang, LANGUAGES } from '../src/i18n/languages.ts';

registerCatalog('en', { 'Ciao': 'Hello', 'Hai {0} impegni': 'You have {0} appointments', 'Tra {0} min: {1}': 'In {0} min: {1}', 'impegni': 'appointments' });

test('italiano non cambia', () => { setActive('it'); assert.equal(translateText('Ciao'), 'Ciao'); assert.equal(t('Hai {0} impegni', 3), 'Hai 3 impegni'); });
test('esatto, modello e segnaposto', () => {
  setActive('en');
  assert.equal(translateText('Ciao'), 'Hello');
  assert.equal(translateText('Hai 3 impegni'), 'You have 3 appointments');
  assert.equal(translateText('Tra 15 min: Dentista'), 'In 15 min: Dentista');
  assert.equal(t('Hai {0} impegni', 5), 'You have 5 appointments');
  assert.equal(translateText('Testo sconosciuto'), 'Testo sconosciuto');
  assert.equal(translateText(' Ciao '), ' Hello ');
});
test('lingue', () => {
  assert.equal(LANGUAGES.length, 12);
  assert.equal(detectLang('zh-Hans-CN'), 'zh'); assert.equal(detectLang('pt_BR'), 'pt'); assert.equal(detectLang('sw-KE'), 'en');
  assert.equal(normalizeLang('Deutsch'), 'de'); assert.equal(normalizeLang('xx'), 'it');
});

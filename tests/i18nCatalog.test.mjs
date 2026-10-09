import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['en', 'es', 'fr', 'de', 'pt', 'zh', 'hi', 'ar', 'ru', 'ja', 'id'];
const source = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/source.json'), 'utf8'));
const srcSet = new Set(source);
const ph = (s) => [...new Set(s.match(/\{\d+\}/g) ?? [])].sort().join(',');

test('source.json: array ordinato di stringhe uniche non vuote', () => {
  assert.ok(Array.isArray(source));
  assert.equal(new Set(source).size, source.length);
  assert.ok(source.every((s) => typeof s === 'string' && s.trim() === s && s.length > 0));
});

for (const lang of LANGS) {
  const file = path.join(ROOT, `src/i18n/locales/${lang}.json`);
  test(`catalogo ${lang}`, { skip: !fs.existsSync(file) }, () => {
    const cat = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [k, v] of Object.entries(cat)) {
      assert.equal(typeof v, 'string', `valore non stringa: ${k}`);
      assert.ok(v.trim() !== '', `valore vuoto: ${k}`);
      assert.equal(ph(v), ph(k), `segnaposto diversi: ${k} => ${v}`);
      assert.ok(srcSet.has(k), `chiave non presente nel sorgente: ${k}`);
    }
  });
}

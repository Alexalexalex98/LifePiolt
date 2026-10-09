// Controlla i cataloghi src/i18n/locales/<lang>.json rispetto a src/i18n/source.json.
// Uso: node scripts/check-i18n.mjs [--min=NN] [--lang=en,es]
// Exit 1 se: segnaposto diversi, valori vuoti (o copertura < --min).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['en', 'es', 'fr', 'de', 'pt', 'zh', 'hi', 'ar', 'ru', 'ja', 'id'];
const NON_LATIN = new Set(['zh', 'hi', 'ar', 'ru', 'ja']);
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const min = arg('min') !== undefined ? Number(arg('min')) : null;
const only = arg('lang')?.split(',');

const ph = (s) => [...new Set((s.match(/\{\d+\}/g) ?? []))].sort().join(',');
const source = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/source.json'), 'utf8'));
const srcSet = new Set(source);
let fail = false;

for (const lang of LANGS) {
  if (only && !only.includes(lang)) continue;
  const file = path.join(ROOT, `src/i18n/locales/${lang}.json`);
  if (!fs.existsSync(file)) { console.log(`[${lang}] file mancante`); continue; }
  let cat;
  try { cat = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.log(`[${lang}] JSON non valido: ${e.message}`); fail = true; continue; }
  const keys = Object.keys(cat);
  const present = source.filter((k) => k in cat);
  const missing = source.filter((k) => !(k in cat));
  const extra = keys.filter((k) => !srcSet.has(k));
  const empty = keys.filter((k) => typeof cat[k] !== 'string' || cat[k].trim() === '');
  const badPh = keys.filter((k) => typeof cat[k] === 'string' && (ph(k) !== ph(cat[k]) || (k.match(/\{\d+\}/g) ?? []).length > (cat[k].match(/\{\d+\}/g) ?? []).length && false));
  const same = NON_LATIN.has(lang) ? keys.filter((k) => cat[k] === k && /\p{L}{3}/u.test(k)) : [];
  const pct = source.length ? (present.length / source.length) * 100 : 100;
  console.log(`[${lang}] copertura ${pct.toFixed(1)}% (${present.length}/${source.length}) | mancanti ${missing.length} | in più ${extra.length} | vuoti ${empty.length} | segnaposto errati ${badPh.length}${NON_LATIN.has(lang) ? ` | identici al sorgente ${same.length}` : ''}`);
  if (missing.length) console.log('   mancanti (prime 20):\n' + missing.slice(0, 20).map((k) => '     - ' + k).join('\n'));
  if (extra.length) console.log('   non nel sorgente (prime 20):\n' + extra.slice(0, 20).map((k) => '     - ' + k).join('\n'));
  if (empty.length) console.log('   vuoti (prime 20):\n' + empty.slice(0, 20).map((k) => '     - ' + k).join('\n'));
  if (badPh.length) console.log('   segnaposto diversi (prime 20):\n' + badPh.slice(0, 20).map((k) => `     - ${k}  =>  ${cat[k]}`).join('\n'));
  if (same.length) console.log('   sospetti identici (prime 20):\n' + same.slice(0, 20).map((k) => '     - ' + k).join('\n'));
  if (empty.length || badPh.length) fail = true;
  if (min !== null && pct < min) { console.log(`   copertura sotto il minimo ${min}%`); fail = true; }
  else if (pct < 100 && min === null) console.log('   avviso: copertura incompleta');
}
process.exit(fail ? 1 : 0);

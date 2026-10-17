#!/usr/bin/env node
// Controllo rapido di un file out-NNN.json scritto a mano: node scripts/i18n/manual-check.mjs <lang> <NNN|tutti>
import fs from 'node:fs';
import path from 'node:path';
const [lang, which = 'tutti'] = process.argv.slice(2);
const dir = path.resolve('.i18n-cache/manual', lang);
const tok = (s) => (s.match(/⟦\d+⟧/g) ?? []).sort().join('');
const files = fs.readdirSync(dir).filter((f) => /^in-\d+\.json$/.test(f)).filter((f) => which === 'tutti' || f === `in-${which.padStart(3, '0')}.json`);
let bad = 0, done = 0;
for (const f of files) {
  const o = path.join(dir, f.replace('in-', 'out-'));
  if (!fs.existsSync(o)) { if (which !== 'tutti') { console.log(`${f}: manca ${path.basename(o)}`); bad++; } continue; }
  let a, b;
  try { a = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); b = JSON.parse(fs.readFileSync(o, 'utf8')); } catch (e) { console.log(`${path.basename(o)}: JSON non valido (${e.message})`); bad++; continue; }
  if (!Array.isArray(b) || b.length !== a.length) { console.log(`${path.basename(o)}: ${Array.isArray(b) ? b.length : '?'} voci invece di ${a.length}: devono essere nello STESSO numero e ordine`); bad++; continue; }
  const errs = [];
  a.forEach((s, i) => { if (typeof b[i] !== 'string' || !b[i].trim()) errs.push(`#${i} vuota`); else if (tok(s) !== tok(b[i])) errs.push(`#${i} token diversi: «${s}» -> «${b[i]}»`); else if (/[\p{Extended_Pictographic}]/u.test(b[i]) && !/[\p{Extended_Pictographic}]/u.test(s)) errs.push(`#${i} emoji`); });
  if (errs.length) { console.log(`${path.basename(o)}: ${errs.length} problemi`); errs.slice(0, 12).forEach((e) => console.log('  ' + e)); bad++; } else done++;
}
console.log(bad ? `${done} file ok, ${bad} da correggere` : `${done} file ok`);
process.exit(bad ? 1 : 0);

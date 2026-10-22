#!/usr/bin/env node
/**
 * Cerca su wger.de (archivio libero di esercizi) le foto degli esercizi che ancora non ne hanno e salva i collegamenti in src/lib/fitness/exPhotosWger.ts.
 * Uso:  node scripts/fetch-wger-photos.mjs      (serve internet; ci vogliono un paio di minuti)
 * Le immagini di wger hanno licenza Creative Commons (di solito CC BY-SA): l'app mostra autore e licenza sotto la foto.
 * Si usano SOLO le immagini con una licenza dichiarata; le altre vengono saltate.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const terms = JSON.parse(readFileSync(join(ROOT, 'scripts', 'wger-terms.json'), 'utf8'));
const OUT = join(ROOT, 'src', 'lib', 'fitness', 'exPhotosWger.ts');
const base = 'https://wger.de';
let out = {};
try { out = JSON.parse(readFileSync(OUT, 'utf8').split('= ')[1].split(';\nexport')[0].replace(/^[^{]*/, '')); } catch { /* prima volta */ }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (u) => { const r = await fetch(u, { headers: { accept: 'application/json' } }); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json(); };

let found = 0, skipped = 0;
for (const [id, term] of Object.entries(terms)) {
  if (out[id]) continue;
  try {
    const s = await get(`${base}/api/v2/exercise/search/?term=${encodeURIComponent(term)}&language=english&format=json`);
    const hit = (s.suggestions ?? []).find((x) => x.data?.image);
    if (!hit) { skipped++; continue; }
    // dettagli dell'immagine: licenza e autore
    const imgs = await get(`${base}/api/v2/exerciseimage/?exercise_base=${hit.data.base_id}&format=json`);
    const img = (imgs.results ?? []).find((i) => i.license_title || i.license);
    const url = img?.image ?? hit.data.image;
    const lic = img?.license_title || (img?.license ? `licenza ${img.license}` : '');
    if (!url || !lic) { skipped++; continue; }
    out[id] = { url: url.startsWith('http') ? url : base + url, license: lic, author: img?.license_author || 'wger.de', name: hit.value };
    found++; console.log(`✓ ${id}: ${hit.value} (${lic})`);
  } catch (e) { console.log(`- ${id}: ${e.message}`); }
  await sleep(350);
}
writeFileSync(OUT, `/** Foto da wger.de: generato da scripts/fetch-wger-photos.mjs. */\nconst WGER: Record<string, { url: string; license: string; author: string; name: string }> = ${JSON.stringify(out, null, 1)};\nexport default WGER;\n`);
console.log(`\nTrovate ${found} foto nuove, ${skipped} senza risultato. Totale collegate: ${Object.keys(out).length}.`);

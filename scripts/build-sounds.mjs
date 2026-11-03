// Legge assets/sounds e scrive src/lib/soundsManifest.ts (i require() dei file, con gruppo e titolo ricavati dal nome).
//   node scripts/build-sounds.mjs
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('assets/sounds');
const out = path.resolve('src/lib/soundsManifest.ts');
const GROUPS = new Set(['natura', 'rumori', 'musica', 'meditazione', 'focus']);
const files = fs.readdirSync(dir).filter((f) => /\.(mp3|m4a|wav|ogg|aac)$/i.test(f)).sort();
const rows = [];
for (const f of files) {
  const base = f.replace(/\.[^.]+$/, '');
  const [g, ...rest] = base.split('__');
  if (!rest.length || !GROUPS.has(g)) { console.warn(`Salto «${f}»: il nome deve essere gruppo__nome (gruppi: ${[...GROUPS].join(', ')})`); continue; }
  const name = rest.join('__');
  const label = name.replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
  rows.push(`  { id: '${base.replace(/'/g, '')}', label: ${JSON.stringify(label)}, group: '${g}', src: require('../../assets/sounds/${f}') },`);
}
const text = `/* File generato da scripts/build-sounds.mjs: non modificare a mano. */
/* eslint-disable @typescript-eslint/no-require-imports */
import type { Sound } from './sleepSounds';

export const MANIFEST: Sound[] = [
${rows.join('\n')}
];
`;
fs.writeFileSync(out, text);
console.log(`${rows.length} suoni nel manifesto (${out})`);

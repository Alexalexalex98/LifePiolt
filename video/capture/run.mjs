/** Registra gli scenari dell'app: `npm run capture` (tutti) oppure `npm run capture -- 01-dashboard`. Serve l'app web già in piedi (vedi README). */
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'scenarios');
const only = process.argv.slice(2);
for (const f of readdirSync(dir).filter((x) => x.endsWith('.mjs')).sort()) {
  const id = f.replace(/\.mjs$/, '');
  if (only.length && !only.includes(id)) continue;
  console.log('> registro', id);
  const run = (await import(join(dir, f))).default;
  const meta = await run();
  console.log(`  ${meta.duration.toFixed(1)}s, ${meta.cues.length} fasi, ${meta.taps.length} tocchi`);
}

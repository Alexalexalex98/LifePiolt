// Elenca i flussi Maestro filtrati per tag. Uso: node scripts/ci/maestro-select.mjs [--include=smoke,native] [--exclude=fragile] [--only=fragile]
// Stampa un percorso per riga (in ordine alfabetico). Serve ad android-e2e-run.sh per eseguire un flusso alla volta (report e video separati).
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.maestro');
const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1]?.split(',').filter(Boolean) ?? [];
const include = arg('include'), exclude = arg('exclude'), only = arg('only');
for (const f of readdirSync(dir).filter((x) => x.endsWith('.yaml') && x !== 'config.yaml').sort()) {
  const head = readFileSync(join(dir, f), 'utf8').split(/^---\s*$/m)[0];
  const tags = [...head.matchAll(/^\s+-\s+(\w+)\s*$/gm)].map((m) => m[1]);
  if (tags.includes('disabled')) continue;
  if (include.length && !include.some((t) => tags.includes(t))) continue;
  if (exclude.length && exclude.some((t) => tags.includes(t))) continue;
  if (only.length && !only.some((t) => tags.includes(t))) continue;
  console.log(`.maestro/${f}`);
}

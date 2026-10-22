/** Genera gli MP4 con audio: `npm run render` (tutti) · `npm run render -- 01-dashboard` · cartella di uscita: out/ */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const extra = process.argv.slice(2).filter((x) => x.startsWith('--'));
mkdirSync(join(ROOT, 'out'), { recursive: true });
const ids = readdirSync(join(ROOT, 'videos')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(ROOT, 'videos', f), 'utf8')).id).sort();
for (const id of ids) {
  if (only.length && !only.includes(id)) continue;
  console.log('> render', id);
  const r = spawnSync('npx', ['remotion', 'render', 'src/index.ts', id, `out/${id}.mp4`, '--codec=h264', '--audio-codec=aac', '--crf=18', ...extra], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

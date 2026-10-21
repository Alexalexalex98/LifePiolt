// Avvio rapido per lo sviluppo: npm run start:fast  (aggiungi --tunnel se serve, e -c solo la prima volta)
import { spawn } from 'node:child_process';

const args = ['expo', 'start', ...process.argv.slice(2)];
const p = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, LP_FAST: '1' } });
p.on('exit', (c) => process.exit(c ?? 0));

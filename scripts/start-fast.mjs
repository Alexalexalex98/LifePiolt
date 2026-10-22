// Avvio rapido per lo sviluppo: npm run start:fast  (aggiungi --tunnel se serve, e -c solo la prima volta)
import { spawn } from 'node:child_process';

// npm run start:fast -- --lang=en   (tiene solo l'inglese; più lingue: --lang=en,de). Senza: nessuna traduzione, l'app resta in italiano.
const langArg = process.argv.find((a) => a.startsWith('--lang='));
const rest = process.argv.slice(2).filter((a) => !a.startsWith('--lang='));
const args = ['expo', 'start', ...rest];
const p = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, LP_FAST: '1', ...(langArg ? { LP_LANGS: langArg.slice(7) } : {}) } });
p.on('exit', (c) => process.exit(c ?? 0));

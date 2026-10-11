// Carica chiavi da .env.local / .env (ignorati da git) senza sovrascrivere le variabili gia' presenti.
import fs from 'node:fs';
import path from 'node:path';

export function loadEnvFiles(root, env = process.env) {
  for (const name of ['.env.local', '.env']) {
    const f = path.join(root, name);
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (!m || line.trim().startsWith('#')) continue;
      const v = m[2].replace(/^(['"])(.*)\1$/, '$2');
      if (env[m[1]] === undefined && v !== '') env[m[1]] = v;
    }
  }
}

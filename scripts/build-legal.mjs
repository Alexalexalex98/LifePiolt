/** Trasforma i testi legali di docs/legal/*.md in src/lib/legalDocs.generated.ts (letti dall'app). Eseguire dopo aver modificato i .md. */
import { readFileSync, writeFileSync } from 'node:fs';
const docs = { privacy: 'privacy-policy', terms: 'terms' };
const out = {};
for (const [id, f] of Object.entries(docs)) for (const l of ['it', 'en']) (out[id] ??= {})[l] = readFileSync(`docs/legal/${f}.${l}.md`, 'utf8');
writeFileSync('src/lib/legalDocs.generated.ts', `/* Generato da scripts/build-legal.mjs: non modificare a mano. */\nexport const LEGAL_DOCS: Record<string, Record<string, string>> = ${JSON.stringify(out, null, 1)};\n`);

// Legge assets/voice e scrive src/lib/voice/voiceManifest.ts: node scripts/voice/build-manifest.mjs
import fs from 'node:fs';
const dir = 'assets/voice';
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^[0-9a-f]{8}\.mp3$/.test(f)).sort() : [];
const rows = files.map((f) => `  '${f.slice(0, 8)}': require('../../../assets/voice/${f}'),`);
fs.writeFileSync('src/lib/voice/voiceManifest.ts', `/* File generato da scripts/voice/build-manifest.mjs: non modificare a mano. */\n/* eslint-disable @typescript-eslint/no-require-imports */\nexport const VOICE_CLIPS: Record<string, number> = {\n${rows.join('\n')}\n};\n`);
console.log(files.length, 'registrazioni');

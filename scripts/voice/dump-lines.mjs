// Elenca tutte le frasi che Theia legge (programmi ed esercizi) con lo stile di voce: node --experimental-strip-types scripts/voice/dump-lines.mjs out.json
import fs from 'node:fs';
import { SESSIONS } from '../../src/lib/mindSessions.ts';
import { ALL_EXERCISES, VOICE_STYLES, narrationPlan, voiceStyleFor } from '../../src/lib/mindLibrary.ts';
const out = new Map();
for (const s of SESSIONS) for (const b of s.beats) if (b.say && !out.has(b.say)) out.set(b.say, s.style);
for (const ex of ALL_EXERCISES) for (const p of narrationPlan(ex, 'Mettiti comodo. Ti accompagno io.')) if (p.kind === 'say' && !out.has(p.text)) out.set(p.text, Object.keys(VOICE_STYLES).find((k) => VOICE_STYLES[k] === voiceStyleFor(ex.id)) ?? 'calma');
fs.writeFileSync(process.argv[2], JSON.stringify([...out.entries()].map(([text, style]) => ({ text, style }))));
console.log(out.size, 'frasi');

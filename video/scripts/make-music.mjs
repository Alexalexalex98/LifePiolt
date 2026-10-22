/**
 * Crea una base musicale morbida e senza diritti (sintetizzata qui con ffmpeg): public/music/bed.mp3, un giro di 4 accordi di 16 s che Remotion ripete.
 * Vuoi un brano tuo? Mettilo in public/music/ e scrivi il nome in `music.file` del video. Usa solo musica di cui hai la licenza (es. YouTube Audio Library, Pixabay Music).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(ROOT, 'public', 'music'), { recursive: true });
const CH = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]]; // Am F C G
const D = 4;
// un accordo = mix di tutte le sue sorgenti, poi dissolvenza e unione
let idx = 0;
const f2 = [];
CH.forEach((notes, c) => {
  const ids = [];
  notes.forEach(() => { ids.push(idx, idx + 1); idx += 2; });
  ids.push(idx); idx += 1;
  f2.push(`${ids.map((i) => `[${i}:a]`).join('')}amix=inputs=${ids.length}:normalize=1,lowpass=f=1400,tremolo=f=0.25:d=0.25,afade=t=in:st=0:d=0.6,afade=t=out:st=${D}:d=0.6,adelay=${c * D * 1000}|${c * D * 1000}[c${c}]`);
});
f2.push(`${CH.map((_, c) => `[c${c}]`).join('')}amix=inputs=${CH.length}:normalize=0,volume=2.4,aecho=0.8:0.6:380:0.28,loudnorm=I=-16:TP=-2:LRA=7[out]`);
const rebuilt = [];
CH.forEach((notes) => {
  notes.forEach((f) => { rebuilt.push('-f', 'lavfi', '-i', `sine=frequency=${f}:duration=${D + 0.6}:sample_rate=44100`, '-f', 'lavfi', '-i', `sine=frequency=${(f * 2.003).toFixed(2)}:duration=${D + 0.6}:sample_rate=44100`); });
  rebuilt.push('-f', 'lavfi', '-i', `sine=frequency=${(notes[0] / 2).toFixed(2)}:duration=${D + 0.6}:sample_rate=44100`);
});
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...rebuilt, '-filter_complex', f2.join(';'), '-map', '[out]', '-t', String(D * CH.length), '-c:a', 'libmp3lame', '-q:a', '4', join(ROOT, 'public', 'music', 'bed.mp3')]);
console.log('Musica creata: public/music/bed.mp3');

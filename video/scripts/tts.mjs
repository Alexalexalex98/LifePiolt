/**
 * Genera il voice over di tutti i video (o di quelli indicati): `npm run tts` · `npm run tts -- 01-dashboard`
 * Una frase = un file audio, con cache: se il testo non cambia non si paga di nuovo.
 * Servizio scelto con TTS_PROVIDER: openai (consigliato) | elevenlabs | silent (nessuna voce, solo per l'anteprima senza chiavi).
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const provider = (process.env.TTS_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : hasEdge() ? 'edge' : 'silent')).toLowerCase();
function hasEdge() { try { execFileSync('edge-tts', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } }
const only = process.argv.slice(2);
const OUT = join(ROOT, 'public', 'audio');
mkdirSync(OUT, { recursive: true });
mkdirSync(join(ROOT, 'public', 'data'), { recursive: true });

const duration = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

async function synth(text, voice, instructions, file) {
  if (provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts', voice: voice || 'nova', input: text, instructions, response_format: 'mp3' }),
    });
    if (!r.ok) throw new Error(`OpenAI TTS ${r.status}: ${(await r.text()).slice(0, 300)}`);
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  } else if (provider === 'elevenlabs') {
    const id = voice || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2', voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35 } }),
    });
    if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 300)}`);
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  } else if (provider === 'edge') {
    // Microsoft Edge TTS: gratuito e senza chiave (servizio non ufficiale, richiede internet). Installa con: pip install edge-tts
    const v = voice && /Neural$/.test(voice) ? voice : process.env.EDGE_VOICE || 'en-US-AvaNeural';
    execFileSync('edge-tts', ['--voice', v, '--rate=+4%', '--text', text, '--write-media', file], { stdio: 'inherit' });
  } else {
    // nessuna voce: silenzio lungo quanto serve a leggere la frase (2,5 parole al secondo)
    const secs = Math.max(0.8, text.split(/\s+/).length / 2.5);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', secs.toFixed(2), '-q:a', '9', file]);
  }
}

if (provider === 'silent') console.log('! Nessuna chiave TTS trovata: genero audio muto (solo anteprima). Vedi README per OpenAI / ElevenLabs.');
console.log('Servizio vocale:', provider);
const dir = join(ROOT, 'videos');
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const spec = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  if (only.length && !only.includes(spec.id)) continue;
  const sentences = [];
  let spent = 0, cached = 0;
  for (const [si, sc] of spec.scenes.entries()) {
    for (const [i, text] of (Array.isArray(sc.say) ? sc.say : [sc.say]).entries()) {
      const key = createHash('sha1').update([provider, spec.voice?.voice ?? '', spec.voice?.instructions ?? '', process.env.OPENAI_TTS_MODEL ?? '', text].join('|')).digest('hex').slice(0, 12);
      const rel = `audio/${spec.id}/${key}.mp3`;
      const file = join(ROOT, 'public', rel);
      mkdirSync(dirname(file), { recursive: true });
      if (existsSync(file)) cached++; else { await synth(text, spec.voice?.voice, spec.voice?.instructions, file); spent += text.length; }
      sentences.push({ scene: si, i, text, file: rel, duration: Number(duration(file).toFixed(3)) });
    }
  }
  writeFileSync(join(ROOT, 'public', 'data', `${spec.id}.audio.json`), JSON.stringify({ provider, sentences }, null, 2));
  console.log(`${spec.id}: ${sentences.length} frasi (${cached} dalla cache, ${spent} caratteri nuovi)`);
}

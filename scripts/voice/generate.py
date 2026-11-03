"""Genera le voci registrate (Piper, voce italiana «paola», licenza CC0) per tutte le frasi di Theia.
   pip install piper-tts ; scarica il modello it_IT-paola-medium (.onnx e .onnx.json) e passa il percorso.
   python3 scripts/voice/generate.py lines.json modello.onnx assets/voice"""
import hashlib, json, os, subprocess, sys, tempfile, wave
from piper import PiperVoice, SynthesisConfig

lines, model, out = sys.argv[1:4]
STYLE = {'sonno': 1.38, 'calma': 1.22, 'calda': 1.16, 'vivace': 1.06}  # length_scale: più alto = più lento
def key(t):  # stessa funzione di src/lib/voice/bundled.ts
    h = 5381
    for ch in t.strip():
        h = ((h * 33) ^ ord(ch)) & 0xFFFFFFFF
    return format(h, '08x')

os.makedirs(out, exist_ok=True)
v = PiperVoice.load(model)
items = json.load(open(lines)); done = 0
for it in items:
    k = key(it['text']); dst = os.path.join(out, k + '.mp3')
    if os.path.exists(dst): continue
    cfg = SynthesisConfig(length_scale=STYLE.get(it['style'], 1.22), noise_scale=0.5, noise_w_scale=0.55)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f: tmp = f.name
    with wave.open(tmp, 'wb') as w: v.synthesize_wav(it['text'], w, syn_config=cfg)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', tmp, '-ac', '1', '-ar', '22050', '-b:a', '32k', '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm=I=-18:TP=-2', dst], check=True)
    os.unlink(tmp); done += 1
    if done % 20 == 0: print(done, '/', len(items), flush=True)
print('fatto', done)

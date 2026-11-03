#!/usr/bin/env python3
"""
Genera i suoni per dormire e rilassarsi (pioggia, onde, vento, rumori colorati, fuoco, ruscello, grilli, musica calma).
Sono sintetizzati qui, al 100% nostri: nessun diritto d'autore, nessuna licenza da citare. Ogni suono è un loop senza stacco (periodico per costruzione).
Uso: python3 scripts/make-sounds.py  (serve numpy e ffmpeg) -> assets/sounds/*.mp3
"""
import subprocess, sys, os, wave
import numpy as np

SR = 22050
DUR = 40  # secondi: tutti gli andamenti lenti hanno periodi che dividono 40
N = SR * DUR
rng = np.random.default_rng(7)
t = np.arange(N) / SR
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')

def shaped_noise(slope=0.0, lo=None, hi=None, seed=None):
    """Rumore periodico con spettro ~ 1/f^slope (0=bianco, 1=rosa, 2=bruno) e banda lo..hi Hz."""
    r = np.random.default_rng(seed) if seed is not None else rng
    spec = r.normal(size=N // 2 + 1) + 1j * r.normal(size=N // 2 + 1)
    f = np.fft.rfftfreq(N, 1 / SR); f[0] = 1
    spec *= 1 / f ** (slope / 2)
    if lo: spec *= 1 / (1 + (lo / f) ** 4)
    if hi: spec *= 1 / (1 + (f / hi) ** 4)
    spec[0] = 0
    x = np.fft.irfft(spec, N)
    return x / (np.abs(x).max() + 1e-9)

def norm(x, peak=0.8):
    return (x / (np.abs(x).max() + 1e-9) * peak).astype(np.float32)

def lfo(period, phase=0.0):
    return 0.5 + 0.5 * np.sin(2 * np.pi * t / period + phase)

def impulses(rate, seed, decay=0.004, lo=None, hi=None):
    r = np.random.default_rng(seed)
    x = np.zeros(N)
    pos = np.where(r.random(N) < rate / SR)[0]
    amp = r.random(len(pos)) ** 2
    x[pos] = amp
    k = np.exp(-np.arange(int(SR * decay * 6)) / (SR * decay))
    y = np.fft.irfft(np.fft.rfft(x) * np.fft.rfft(k, N), N)  # convoluzione circolare: resta periodico
    return y

def rain():
    base = shaped_noise(0.7, lo=500, hi=9000, seed=1)
    drops = impulses(260, 2, 0.0015)
    drops = drops / (np.abs(drops).max() + 1e-9)
    return norm(0.8 * base * (0.85 + 0.15 * lfo(20)) + 0.5 * drops)

def ocean():
    base = shaped_noise(1.4, lo=60, hi=2200, seed=3)
    wave = (lfo(8) ** 2.2) * 0.85 + 0.15
    foam = shaped_noise(0.3, lo=1500, hi=6000, seed=4) * (lfo(8, 0.9) ** 3) * 0.35
    return norm(base * wave + foam)

def wind():
    a = shaped_noise(1.2, lo=150, hi=1400, seed=5) * (0.35 + 0.65 * lfo(10))
    b = shaped_noise(1.0, lo=400, hi=2500, seed=6) * (0.2 + 0.8 * lfo(8, 2.0)) * 0.5
    return norm(a + b)

def brown(): return norm(shaped_noise(2.0, lo=30, hi=1800, seed=8))
def pink(): return norm(shaped_noise(1.0, lo=30, hi=9000, seed=9))
def white(): return norm(shaped_noise(0.0, lo=80, hi=8000, seed=10), 0.6)

def fire():
    base = shaped_noise(2.0, lo=40, hi=900, seed=11) * 0.6
    pops = impulses(14, 12, 0.003) * 1.0
    crack = impulses(45, 13, 0.0008)
    pops = pops / (np.abs(pops).max() + 1e-9); crack = crack / (np.abs(crack).max() + 1e-9)
    return norm(base + 0.8 * pops + 0.35 * crack)

def stream():
    base = shaped_noise(0.8, lo=300, hi=5000, seed=14)
    bub = shaped_noise(0.2, lo=800, hi=3500, seed=15) * (0.3 + 0.7 * lfo(0.8)) * (0.5 + 0.5 * lfo(0.37, 1.0))
    return norm(0.7 * base * (0.6 + 0.4 * lfo(5)) + 0.5 * bub)

def crickets():
    out = np.zeros(N)
    for i, f in enumerate([4300, 4600, 5000]):
        pulse = np.maximum(0, np.sin(2 * np.pi * (14 + i * 1.7) * t)) ** 6
        gate = (np.sin(2 * np.pi * t / (4 + i) + i) > 0.1).astype(float)
        gate = np.convolve(gate, np.ones(400) / 400, mode='same')
        out += np.sin(2 * np.pi * f * t) * pulse * gate * 0.3
    out += shaped_noise(1.5, lo=100, hi=1200, seed=16) * 0.06
    return norm(out, 0.5)

def pad(chords, period, seed):
    """Musica calma: accordi lenti con armoniche morbide, dissolvenze incrociate. `period` secondi per accordo (divide 40)."""
    out = np.zeros(N)
    n = len(chords)
    for k, notes in enumerate(chords):
        env = np.clip(0.5 + 0.5 * np.sin(2 * np.pi * (t / (period * n) - k / n) - np.pi / 2) , 0, 1) ** 2
        for j, hz in enumerate(notes):
            hz = round(hz * 40) / 40  # frequenza multipla di 1/40 Hz: periodica nel loop
            vib = 1 + 0.0015 * np.sin(2 * np.pi * (0.2 + 0.05 * j) * t)
            for h, a in ((1, 1.0), (2, 0.35), (3, 0.15), (4, 0.06)):
                out += env * a * np.sin(2 * np.pi * hz * h * t * vib + j) * 0.25
    out += shaped_noise(2.0, lo=40, hi=700, seed=seed) * 0.05
    return norm(out, 0.7)

SLEEP = [[110, 164.81, 220], [98, 146.83, 196], [87.31, 130.81, 174.61], [98, 146.83, 196]]
CALM = [[130.81, 196, 261.63, 329.63], [110, 164.81, 220, 261.63], [87.31, 130.81, 174.61, 220], [98, 146.83, 196, 246.94]]

SOUNDS = {
    'pioggia': rain, 'onde': ocean, 'vento': wind, 'rumore-bruno': brown, 'rumore-rosa': pink, 'rumore-bianco': white,
    'fuoco': fire, 'ruscello': stream, 'grilli': crickets,
    'musica-sonno': lambda: pad(SLEEP, 10, 20), 'musica-calma': lambda: pad(CALM, 10, 21),
}

def write(name, x):
    os.makedirs(OUT, exist_ok=True)
    wav = os.path.join(OUT, name + '.wav')
    with wave.open(wav, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype('<i2').tobytes())
    mp3 = os.path.join(OUT, name + '.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '56k', '-ac', '1', mp3], check=True)
    os.remove(wav)

if __name__ == '__main__':
    only = sys.argv[1:] or list(SOUNDS)
    for k in only:
        write(k, SOUNDS[k]()); print('ok', k)

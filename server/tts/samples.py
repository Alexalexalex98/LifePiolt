"""Genera i campioni di tutte le voci (una donna e un uomo per lingua) in ./samples, per ascoltarli prima di usarli nell'app.
   python samples.py            (serve la stessa GPU e le stesse librerie del server)"""
from pathlib import Path

import soundfile as sf

import app
from core import REF_TEXT, SUPPORTED

out = Path("samples"); out.mkdir(exist_ok=True)
for lang in SUPPORTED:
    for g in ("f", "m"):
        audio, sr = app.synthesize(REF_TEXT[lang], g, lang)
        sf.write(str(out / f"{g}-{lang}.wav"), audio, sr)
        print("ok", g, lang, flush=True)

"""
Server vocale open source per LifePilot (compatibile con l'API di OpenAI: POST /v1/audio/speech).
Qualità da modelli di ultima generazione, tutti con licenza libera:
  • Qwen3-TTS (Apache 2.0): italiano, inglese, spagnolo, francese, tedesco, portoghese, russo, cinese, giapponese
  • Chatterbox Multilingual (MIT): arabo, hindi
Ogni lingua ha una voce femminile e una maschile (id «f-it», «m-it»…), create con «Voice Design» da una descrizione, senza clonare nessuna persona reale.
Le voci si fissano su disco: il primo avvio le crea, poi restano identiche per sempre (puoi anche sostituire i file in data/voices).
Serve una GPU NVIDIA con almeno 12 GB di memoria (vedi README).
"""
from __future__ import annotations

import hashlib
import io
import os
import threading
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Response
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

from core import CHATTERBOX_LANG, INSTRUCT, LANG_NAME, QWEN_LANG, REF_TEXT, SUPPORTED, chunk_text, parse_voice, voice_ids

DATA = Path(os.environ.get("TTS_DATA", "./data"))
VOICES = DATA / "voices"
CACHE = DATA / "cache"
VOICES.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)
API_KEY = os.environ.get("TTS_API_KEY", "")
DESIGN_ID = os.environ.get("QWEN_DESIGN", "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign")
BASE_ID = os.environ.get("QWEN_BASE", "Qwen/Qwen3-TTS-12Hz-1.7B-Base")
MAX_CHARS = int(os.environ.get("TTS_MAX_CHARS", "4000"))

_lock = threading.Lock()
_models: dict[str, object] = {}
_prompts: dict[str, object] = {}


def _torch():
    import torch  # pesante: solo quando serve
    return torch


def _device() -> str:
    t = _torch()
    return "cuda:0" if t.cuda.is_available() else "cpu"


def _qwen(kind: str):
    """Carica (una volta) il modello Qwen3-TTS: 'design' crea le voci, 'base' parla con quelle voci."""
    if kind not in _models:
        from qwen_tts import Qwen3TTSModel
        t = _torch()
        dev = _device()
        kw = dict(device_map=dev, dtype=t.bfloat16 if dev.startswith("cuda") else t.float32)
        try:
            kw["attn_implementation"] = "flash_attention_2"
            _models[kind] = Qwen3TTSModel.from_pretrained(DESIGN_ID if kind == "design" else BASE_ID, **kw)
        except Exception:
            kw.pop("attn_implementation", None)
            _models[kind] = Qwen3TTSModel.from_pretrained(DESIGN_ID if kind == "design" else BASE_ID, **kw)
    return _models[kind]


def _chatterbox():
    if "cb" not in _models:
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        _models["cb"] = ChatterboxMultilingualTTS.from_pretrained(device=_device())
    return _models["cb"]


def _ref_paths(g: str, lang: str) -> tuple[Path, Path]:
    return VOICES / f"{g}-{lang}.wav", VOICES / f"{g}-{lang}.txt"


def ensure_reference(g: str, lang: str) -> tuple[Path, str]:
    """La voce di riferimento per genere e lingua: si crea la prima volta con Voice Design e poi non cambia più."""
    import soundfile as sf
    if lang not in QWEN_LANG:  # arabo/hindi: Chatterbox usa come modello la voce inglese dello stesso genere
        return ensure_reference(g, "en")
    wav, txt = _ref_paths(g, lang)
    if wav.exists() and txt.exists():
        return wav, txt.read_text(encoding="utf-8")
    text = REF_TEXT[lang]
    wavs, sr = _qwen("design").generate_voice_design(text=text, language=QWEN_LANG[lang], instruct=INSTRUCT[g].format(lang=LANG_NAME[lang]))
    sf.write(str(wav), wavs[0], sr)
    txt.write_text(text, encoding="utf-8")
    return wav, text


def _clone_prompt(g: str, lang: str):
    key = f"{g}-{lang}"
    if key not in _prompts:
        wav, text = ensure_reference(g, lang)
        _prompts[key] = _qwen("base").create_voice_clone_prompt(ref_audio=str(wav), ref_text=text)
    return _prompts[key]


def synthesize(text: str, g: str, lang: str):
    """Testo -> (campioni float32, frequenza). Divide il testo in frasi e unisce l'audio con piccole pause."""
    import numpy as np
    parts = chunk_text(text)
    if not parts:
        raise HTTPException(400, "testo vuoto")
    chunks, sr = [], 24000
    with _lock:
        for p in parts:
            if SUPPORTED[lang] == "qwen":
                wavs, sr = _qwen("base").generate_voice_clone(text=p, language=QWEN_LANG[lang], voice_clone_prompt=_clone_prompt(g, lang))
                a = np.asarray(wavs[0], dtype="float32")
            else:
                ref, _ = ensure_reference(g, "en")
                cb = _chatterbox()
                w = cb.generate(p, language_id=CHATTERBOX_LANG[lang], audio_prompt_path=str(ref))
                a = w.squeeze().detach().cpu().numpy().astype("float32"); sr = int(cb.sr)
            chunks.append(a); chunks.append(np.zeros(int(sr * 0.18), dtype="float32"))
    return np.concatenate(chunks[:-1]), sr


app = FastAPI(title="Server vocale LifePilot")


class Speech(BaseModel):
    input: str
    voice: str = "f-it"
    model: str | None = None
    language: str | None = None
    response_format: str = "wav"
    speed: float | None = None


def _auth(authorization: str | None):
    if API_KEY and (authorization or "") != f"Bearer {API_KEY}":
        raise HTTPException(401, "chiave non valida")


@app.get("/health")
def health():
    return {"ok": True, "voices": len(voice_ids())}


@app.get("/v1/voices")
def voices(authorization: str | None = Header(default=None)):
    _auth(authorization)
    return {"voices": [{"id": v, "gender": "female" if v[0] == "f" else "male", "language": v[2:], "model": SUPPORTED[v[2:]]} for v in voice_ids()], "unsupported": ["id"]}


@app.post("/v1/audio/speech")
def speech(req: Speech, authorization: str | None = Header(default=None)):
    _auth(authorization)
    if len(req.input) > MAX_CHARS:
        raise HTTPException(413, f"testo troppo lungo (massimo {MAX_CHARS} caratteri)")
    g, lang = parse_voice(req.voice, req.language or "it")
    if lang not in SUPPORTED:
        raise HTTPException(501, f"lingua «{lang}» non supportata da questo server")
    fmt = "mp3" if req.response_format == "mp3" else "wav"
    key = hashlib.sha256(f"{g}|{lang}|{fmt}|{req.input}".encode()).hexdigest()
    f = CACHE / f"{key}.{fmt}"
    if not f.exists():
        import soundfile as sf
        audio, sr = synthesize(req.input, g, lang)
        buf = io.BytesIO()
        sf.write(buf, audio, sr, format="MP3" if fmt == "mp3" else "WAV", **({} if fmt == "mp3" else {"subtype": "PCM_16"}))
        f.write_bytes(buf.getvalue())
    return Response(f.read_bytes(), media_type="audio/mpeg" if fmt == "mp3" else "audio/wav")


DEMO = """<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Voci LifePilot</title>
<style>body{font-family:system-ui;max-width:640px;margin:24px auto;padding:0 16px}input,textarea{width:100%;box-sizing:border-box;padding:8px;margin:4px 0}button{padding:8px 12px;margin:3px}.r{display:flex;gap:6px;align-items:center;flex-wrap:wrap;border-top:1px solid #ddd;padding:6px 0}</style>
<h1>Voci di Theia</h1><p>Scegli una voce e premi Ascolta: la prima volta una voce impiega qualche secondo a nascere, poi resta sempre la stessa.</p>
<input id=k placeholder="Chiave (se l'hai impostata)" type=password><textarea id=t rows=3></textarea><div id=l></div><audio id=a controls style="width:100%"></audio>
<script>const T={it:"Ciao, sono Theia. Respira piano e seguimi.",en:"Hi, I am Theia. Breathe slowly and follow me.",es:"Hola, soy Theia. Respira despacio y sígueme.",fr:"Bonjour, je suis Theia. Respire doucement et suis-moi.",de:"Hallo, ich bin Theia. Atme langsam und folge mir.",pt:"Olá, sou a Theia. Respire devagar e siga-me.",ru:"Привет, я Тея. Дышите медленно и следуйте за мной.",zh:"你好，我是Theia。慢慢呼吸，跟着我。",ja:"こんにちは、テイアです。ゆっくり呼吸してください。",ar:"مرحبًا، أنا ثيا. تنفس ببطء وتابعني.",hi:"नमस्ते, मैं थेया हूँ। धीरे-धीरे साँस लें।"};
const N={it:"Italiano",en:"English",es:"Español",fr:"Français",de:"Deutsch",pt:"Português",ru:"Русский",zh:"中文",ja:"日本語",ar:"العربية",hi:"हिन्दी"};
const L=document.getElementById('l');for(const c in T){const d=document.createElement('div');d.className='r';d.innerHTML='<b style="width:90px">'+N[c]+'</b>';for(const g of['f','m']){const b=document.createElement('button');b.textContent=(g=='f'?'Donna':'Uomo')+' · Ascolta';b.onclick=async()=>{b.disabled=true;b.textContent='…';try{const r=await fetch('/v1/audio/speech',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+document.getElementById('k').value},body:JSON.stringify({input:document.getElementById('t').value||T[c],voice:g+'-'+c})});if(!r.ok)throw new Error(r.status);const u=URL.createObjectURL(await r.blob());const a=document.getElementById('a');a.src=u;a.play()}catch(e){alert('Errore '+e.message)}b.disabled=false;b.textContent=(g=='f'?'Donna':'Uomo')+' · Ascolta'};d.appendChild(b)}L.appendChild(d)}</script>"""


@app.get("/demo", response_class=HTMLResponse)
def demo():
    return DEMO


@app.on_event("startup")
def prewarm():
    """Con TTS_PREWARM=1 crea subito tutte le voci (circa 22) così sono pronte e bloccate."""
    if os.environ.get("TTS_PREWARM") != "1":
        return

    def run():
        with _lock:
            for lang in list(QWEN_LANG) + ["en"]:
                for g in ("f", "m"):
                    try:
                        ensure_reference(g, lang)
                    except Exception as e:  # noqa: BLE001
                        print("voce non creata", g, lang, e, flush=True)
    threading.Thread(target=run, daemon=True).start()

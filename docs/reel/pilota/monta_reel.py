#!/usr/bin/env python3
"""Reel v2: telefono a tutta altezza con la vera app in movimento, indicatori, tocco, sottotitoli in alto.
Uso: render2.py timing.json uscita.mp4 [audio]"""
import json, math, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
W, H, FPS = 1080, 1920, 30
FR = '/tmp/claude-0/-home-user/f6a3628a-2f04-5e95-a063-9ccddc16acd1/scratchpad/reel/v2/frames/'
FB = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'; FM = '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'; FR_ = '/usr/share/fonts/opentype/inter/Inter-Medium.otf'
timing = json.load(open(sys.argv[1])); out = sys.argv[2]; audio = sys.argv[3] if len(sys.argv) > 3 else None
segs = timing['segments']; total = timing['total']
def chunks(sg, maxw=6):
    out_ = []
    for s in sg:
        ws = s['text'].split(); n = max(1, math.ceil(len(ws) / maxw)); per = math.ceil(len(ws) / n); parts = [ws[i:i + per] for i in range(0, len(ws), per)]
        tot = sum(len(' '.join(p)) + 1 for p in parts); t = s['start']; span = s['end'] - s['start']
        for p in parts:
            d_ = span * (len(' '.join(p)) + 1) / tot; out_.append({**s, 'text': ' '.join(p), 'start': t, 'end': t + d_}); t += d_
    return out_
SEGS = segs; CAP = chunks(segs)
SW = 760; SC = SW / 1080; SH = int(1920 * SC); BZ = 18; PX = (W - SW) // 2; PY = 500
GREEN = (124, 255, 178); INK = (12, 14, 28)
ease = lambda x: x * x * (3 - 2 * x); clamp = lambda x, a=0.0, b=1.0: max(a, min(b, x))
cache = {}
def fr(name, i):
    k = (name, i)
    if k not in cache:
        cache[k] = Image.open(f'{FR}{name}_{i:03d}.png').convert('RGB').resize((SW, SH), Image.LANCZOS)
        if len(cache) > 90: cache.pop(next(iter(cache)))
    return cache[k]
def seg(sc):
    xs = [s for s in SEGS if s['scene'] == sc]
    return (min(s['start'] for s in xs), max(s['end'] for s in xs)) if xs else None
S = {k: seg(k) for k in ['s1', 's2', 's3', 's4', 's5', 's6']}
S['end'] = seg('end'); END0 = S['end'][0]
# i confini: ogni scena arriva fino all'inizio della successiva
keys = ['s1', 's2', 's3', 's4', 's5', 's6', 'end']
for i, k in enumerate(keys[:-1]): S[k] = (S[k][0] if i else 0.0, S[keys[i + 1]][0])

def screen(t):
    """Che cosa si vede sullo schermo del telefono a questo istante (immagine SWxSH)."""
    a0, a1 = S['s1']; b0, b1 = S['s2']; c0, c1 = S['s3']; d0, d1 = S['s4']; e0, e1 = S['s5']
    if t < b0: return fr('a', 0)
    if t < c0: return fr('a', round(30 * ease(clamp((t - b0) / max(b1 - b0, .01) * 1.15))))
    if t < d0: return fr('a', 30)
    # tocco su Finance e passaggio alla schermata soldi
    tap = d0 + 0.35
    if t < tap: return fr('a', 30)
    if t < tap + 0.3: return Image.blend(fr('a', 30), fr('b', 0), ease((t - tap) / 0.3))
    if t < e0: return fr('b', 0)
    f0, f1 = S['s6']
    if t < f0: return fr('b', round(38 * ease(clamp((t - e0) / max(e1 - e0, .01)))))
    return fr('b', round(38 + 22 * ease(clamp((t - f0) / max(f1 - f0, .01) * 1.1))))

# sfondo
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
base = np.zeros((H, W, 3), np.float32)
for i, (c0, c1) in enumerate([(8, 22), (12, 26), (28, 70)]): base[..., i] = c0 + (c1 - c0) * (yy / H)
def bg(t):
    o = base.copy()
    for (fx, fy, rad, amp, ph, col) in [(0.30, 0.20, 560, 1.0, 0.0, (30, 60, 120)), (0.75, 0.62, 640, .9, 2.1, (20, 110, 90))]:
        cx = W * (fx + 0.12 * math.sin(t * 0.5 + ph)); cy = H * (fy + 0.06 * math.cos(t * 0.4 + ph))
        g = np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * rad ** 2))) * amp
        for c in range(3): o[..., c] += col[c] * g
    return Image.fromarray(np.clip(o, 0, 255).astype(np.uint8)).convert('RGBA')

# cornice del telefono
FW, FH = SW + 2 * BZ, SH + 2 * BZ
def make_frame():
    f = Image.new('RGBA', (FW + 120, FH + 120), (0, 0, 0, 0)); d = ImageDraw.Draw(f)
    sh = Image.new('RGBA', f.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle((60, 90, 60 + FW, 90 + FH), 100, fill=(0, 0, 0, 200)); sh = sh.filter(ImageFilter.GaussianBlur(40)); f.alpha_composite(sh)
    d.rounded_rectangle((60, 60, 60 + FW, 60 + FH), 100, fill=(34, 36, 48), outline=(120, 126, 150), width=3)
    d.rounded_rectangle((60 + 6, 60 + 6, 60 + FW - 6, 60 + FH - 6), 94, fill=(10, 11, 18))
    return f
FRAME = make_frame()
smask = Image.new('L', (SW, SH), 0); ImageDraw.Draw(smask).rounded_rectangle((0, 0, SW - 1, SH - 1), 84, fill=255)
island = Image.new('RGBA', (SW, SH), (0, 0, 0, 0)); ImageDraw.Draw(island).rounded_rectangle((SW // 2 - 70, 16, SW // 2 + 70, 52), 18, fill=(0, 0, 0, 255))
phone_cache = {}

fb = ImageFont.truetype(FB, 70); fm = ImageFont.truetype(FM, 34); fs = ImageFont.truetype(FR_, 27); fxl = ImageFont.truetype(FB, 132); fm2 = ImageFont.truetype(FB, 66)
SP = fb.getlength(' ')
def layout(words, maxw=940):
    lines, cur, cw = [], [], 0
    for wd in words:
        l = fb.getlength(wd)
        if cur and cw + SP + l > maxw: lines.append(cur); cur, cw = [], 0
        cur.append((wd, l)); cw += (SP if len(cur) > 1 else 0) + l
    if cur: lines.append(cur)
    return lines
def caption(img, s, t):
    words = s['text'].split(); chars = [len(w) + 1 for w in words]; tot = sum(chars); span = s['end'] - s['start']
    st, acc = [], 0
    for c in chars: st.append(s['start'] + span * acc / tot); acc += c
    lines = layout(words); lh = 90; y0 = 215 + (2 - min(len(lines), 3)) * lh // 2
    k = ease(clamp((t - s['start'] + 0.05) / 0.25)); d = ImageDraw.Draw(img); i = 0
    for ln in lines:
        tw = sum(l for _, l in ln) + SP * (len(ln) - 1); x = (W - tw) / 2
        for wd, l in ln:
            on = t >= st[i]; cur = on and (i == len(words) - 1 or t < st[i + 1])
            col = GREEN if cur else ((255, 255, 255) if on else (150, 158, 192))
            dy = -9 * max(0, 1 - (t - st[i]) / 0.15) if on else 0
            d.text((x, y0 + dy + 22 * (1 - k)), wd, font=fb, fill=col, stroke_width=8, stroke_fill=INK); x += l + SP; i += 1
        y0 += lh

def pt(x, y): return PX + x * SC, PY + y * SC
def pulse(img, cx, cy, t, col=GREEN, r0=40):
    d = ImageDraw.Draw(img, 'RGBA')
    for j in range(2):
        k = ((t * 0.9 + j * 0.5) % 1.0); r = r0 + 70 * k
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=col + (int(230 * (1 - k)),), width=5)
def pill(img, text, x, y, t0, t, side='left', col=(255, 255, 255)):
    """etichetta che compare con un piccolo rimbalzo; (x, y) = punto indicato"""
    k = ease(clamp((t - t0) / 0.3)); 
    if k <= 0: return
    tw = fm.getlength(text); w_, h_ = tw + 56, 74
    bx = x - w_ - 36 if side == 'left' else x + 36; by = y - 150 - 14 * (1 - k)
    bx = max(24, min(W - w_ - 24, bx))
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    d.rounded_rectangle((bx, by, bx + w_, by + h_), 37, fill=col + (int(255 * k),))
    d.line((bx + (w_ - 20 if side == 'left' else 20), by + h_, x, y), fill=col + (int(255 * k),), width=5)
    d.text((bx + 28, by + 15), text, font=fm, fill=INK + (int(255 * k),))
    img.alpha_composite(lay)
def ripple(img, cx, cy, t0, t):
    k = (t - t0) / 0.55
    if 0 <= k <= 1:
        d = ImageDraw.Draw(img, 'RGBA'); r = 30 + 60 * k
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 255, 255, int(45 * (1 - k))), outline=(255, 255, 255, int(200 * (1 - k))), width=4)
        d.ellipse((cx - 13, cy - 13, cx + 13, cy + 13), fill=(255, 255, 255, int(150 * (1 - k))))

def seg_at(t):
    for s in CAP:
        if s['start'] - 0.05 <= t < s['end'] + 0.3: return s
def end_card(img, t, te):
    k = ease(clamp(te / 0.6)); d = ImageDraw.Draw(img)
    tw = fxl.getlength('LifePilot'); d.text(((W - tw) / 2, 560 + 40 * (1 - k)), 'LifePilot', font=fxl, fill=(255, 255, 255, int(255 * k)))
    for j, s in enumerate(["Un'app sola", 'per tutta la tua giornata']):
        tw = fm2.getlength(s); d.text(((W - tw) / 2, 760 + j * 86), s, font=fm2, fill=(205, 214, 255, int(255 * k)))
    d.rounded_rectangle((150, 1000, 930, 1130), 65, fill=GREEN + (int(255 * k),))
    s = 'Beta aperta · link in bio'; tw = fm2.getlength(s); d.text(((W - tw) / 2, 1024), s, font=fm2, fill=INK)

cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-']
if audio: cmd += ['-i', audio]
cmd += ['-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', str(FPS)]
if audio: cmd += ['-c:a', 'aac', '-b:a', '192k', '-shortest']
p = subprocess.Popen(cmd + [out], stdin=subprocess.PIPE)
for f in range(int(total * FPS)):
    t = f / FPS; img = bg(t)
    enter = ease(clamp(t / 0.8)); lift = 0
    if t > END0 - 0.1: lift = ease(clamp((t - END0 + 0.1) / 0.7)) * 1500  # il telefono esce verso il basso
    oy = 260 * (1 - enter) + lift
    scr = screen(t).copy().convert('RGBA'); scr.alpha_composite(island)
    ph = FRAME.copy(); ph.paste(scr, (60 + BZ, 60 + BZ), smask)
    img.alpha_composite(ph, (PX - BZ - 60, int(PY - BZ - 60 + oy)))
    # etichette sulla schermata (con il telefono fermo al suo posto)
    c0, c1 = S['s3']; d0, d1 = S['s4']; e0, e1 = S['s5']; f0, f1 = S['s6']
    if t < END0 and lift == 0 and enter > 0.99:
        if S['s1'][0] + 0.25 <= t < S['s2'][0] + 0.3:
            x, y = pt(962, 628); pulse(img, x, y, t, r0=34)
        if c0 <= t < d0 + 0.3:
            x, y = pt(905, 400); pulse(img, x, y, t); pill(img, 'Il punto più debole', x, y, c0 + 0.2, t)
        if d0 + 0.2 <= t < d0 + 0.8: x, y = pt(756, 1850); ripple(img, x, y, d0 + 0.2, t)
        if e0 + 0.6 <= t < f0:
            fi = 38 * ease(clamp((t - e0) / max(e1 - e0, .01))); y_ = 360 + 21 + 1120 * (1 - ease(clamp(fi / 60)))
            x, y = pt(640, y_); pulse(img, x, y, t, col=(255, 210, 120), r0=30); pill(img, 'Scaduta da 3 giorni', x, y, e0 + 0.6, t, col=(255, 210, 120))
        if t >= f0 + 0.5:
            x, y = pt(520, 880); pill(img, 'Il mese in parole semplici', x, y, f0 + 0.5, t, side='left')
    s = seg_at(t)
    if s and s['scene'] != 'end': caption(img, s, t)
    if t < END0:
        d = ImageDraw.Draw(img); txt = 'Dati di esempio · indicazioni generali, non un parere medico' if t < S['s4'][0] else 'Dati di esempio'
        tw = fs.getlength(txt); d.text(((W - tw) / 2, 425), txt, font=fs, fill=(150, 160, 200))
    else:
        end_card(img, t, t - END0)
    p.stdin.write(np.asarray(img.convert('RGB')).tobytes())
p.stdin.close(); p.wait(); print('ok', out, round(total, 1))

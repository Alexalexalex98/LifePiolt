#!/usr/bin/env python3
"""Genera docs/STATO-APP.pdf da docs/STATO-APP.md: elenco numerato (1, 1.1, 1.1.1) che l'app sa importare in Progetti. Uso: python3 scripts/make-stato-pdf.py"""
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab import rl_config

rl_config.pageCompression = 0  # testo leggibile anche da lettori semplici
SRC, OUT = 'docs/STATO-APP.md', 'docs/STATO-APP.pdf'
lines = open(SRC, encoding='utf8').read().split('\n')
items, note, head = [], [], -1
for ln in lines:
    if not ln.strip(): continue
    if ln.startswith('>'): note.append(ln.lstrip('> ').strip()); continue
    h = re.match(r'^(#{1,6})\s+(.*)$', ln)
    if h: head = len(h.group(1)) - 1; items.append((head, re.sub(r'^\d+(\.\d+)*\.?\s+', '', h.group(2).strip()), None)); continue
    m = re.match(r'^(\s*)[-*+]\s*(?:\[([ xX])\]\s*)?(.*)$', ln)
    if m: items.append((head + 1 + len(m.group(1)) // 2, m.group(3).strip(), (m.group(2) or ' ').lower() == 'x' if m.group(2) is not None else None))
esc = lambda s: s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('→', '->').replace('’', "'")
st = ParagraphStyle('b', fontName='Helvetica', fontSize=9.5, leading=12.5)
doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm, title='LifePilot - stato dell\'app')
flow, cnt = [], []
root = items[0]
flow.append(Paragraph('<b>%s</b>' % esc(root[1]), ParagraphStyle('t', parent=st, fontName='Helvetica-Bold', fontSize=18, leading=22)))
flow.append(Paragraph(esc(' '.join(note)), ParagraphStyle('n', parent=st, textColor='#555555')))
flow.append(Spacer(1, 6))
for depth, title, done in items[1:]:
    d = depth  # radice = 0, quindi 1.. sono i figli
    cnt = (cnt + [0] * d)[:d]
    if len(cnt) < d: cnt += [0] * (d - len(cnt))
    cnt[d - 1] += 1
    cnt = cnt[:d]
    num = '.'.join(str(x) for x in cnt)
    box = '' if done is None else ('[x] ' if done else '[ ] ')
    bold = done is None
    txt = '%s%s  %s' % (box, num, esc(title))
    flow.append(Paragraph('<b>%s</b>' % txt if bold else txt, ParagraphStyle('p', parent=st, leftIndent=(d - 1) * 9, fontName='Helvetica-Bold' if bold else 'Helvetica', spaceBefore=5 if d == 1 else 1.5)))
doc.build(flow)
print('scritto', OUT, len(items) - 1, 'voci')

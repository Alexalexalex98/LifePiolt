#!/usr/bin/env python3
"""Genera un estratto conto demo (PDF, tabella Data / Testo / Addebito / Accredito / Saldo, 400 movimenti, gennaio-ottobre 2026) per provare l'importazione.
Uso: python3 scripts/make-demo-statement.py [uscita.pdf]  (dati inventati: non è un documento di una banca)"""
import random, sys
from datetime import date, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

OUT = sys.argv[1] if len(sys.argv) > 1 else 'docs/demo/estratto_demo_400_movimenti.pdf'
random.seed(2026)
MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre']
SPEND = [('Coop Lugano', 18, 120), ('Migros Locarno', 15, 110), ('Denner', 8, 45), ('Aldi Suisse', 12, 70), ('SBB CFF FFS biglietto', 6, 60), ('Swisscom fattura', 49, 49), ('Salt Mobile', 30, 30),
         ('CSS cassa malati', 389, 389), ('Helsana assicurazione', 95, 95), ('Affitto appartamento', 1450, 1450), ('Ristorante Grotto Ticino', 25, 95), ('Bar Centrale caffè', 3, 14), ('Farmacia Sole', 9, 60),
         ('Shell carburante', 55, 110), ('Amag leasing', 420, 420), ('Netflix', 17, 17), ('Spotify', 13, 13), ('Fitness Active', 79, 79), ('Zalando ordine', 40, 190), ('Amazon.de', 15, 120),
         ('Prelievo Bancomat', 100, 300), ('Azienda elettrica AET', 60, 130), ('Imposte comunali acconto', 250, 600), ('Parcheggio Lugano', 2, 12), ('Decathlon', 20, 140)]
INCOME = [('Accredito salario Acme SA', 4850, 4850), ('Rimborso spese Acme SA', 30, 220), ('TWINT ricevuto', 10, 120), ('Bonifico da Mario Rossi', 40, 300), ('Vendita online Ricardo', 25, 180), ('Interessi attivi', 1, 6)]

rows = []
d = date(2026, 1, 1)
end = date(2026, 10, 21)
bal = 6200.00
start_bal = bal
fixed = {1: [('Affitto appartamento', 1450, 'out')], 25: [('Accredito salario Acme SA', 4850, 'in')], 5: [('CSS cassa malati', 389, 'out')], 12: [('Swisscom fattura', 49, 'out'), ('Netflix', 17, 'out')]}
days = []
x = d
while x <= end:
    days.append(x); x += timedelta(days=1)
for day in days:
    for (lab, amt, kind) in fixed.get(day.day, []):
        rows.append((day, lab, amt, kind))
extra = 400 - len(rows)
while extra > 0:
    day = random.choice(days)
    if random.random() < 0.14:
        lab, lo, hi = random.choice([i for i in INCOME if i[0] != 'Accredito salario Acme SA'])
        rows.append((day, lab, round(random.uniform(lo, hi), 2), 'in'))
    else:
        lab, lo, hi = random.choice([s for s in SPEND if s[0] not in ('Affitto appartamento', 'CSS cassa malati', 'Swisscom fattura', 'Netflix')])
        rows.append((day, lab, round(random.uniform(lo, hi), 2), 'out'))
    extra -= 1
rows.sort(key=lambda r: (r[0], r[1]))
rows = rows[:400]

fmt = lambda v: f"{v:,.2f}".replace(',', "'")
W, H = A4
c = canvas.Canvas(OUT, pagesize=A4)
X = {'data': 18 * mm, 'testo': 42 * mm, 'out': 142 * mm, 'in': 163 * mm, 'saldo': 192 * mm}  # importi allineati a destra
page = 1
y = H - 20 * mm

def footer():
    c.setFont('Helvetica', 7); c.setFillColor(colors.grey)
    c.drawString(18 * mm, 10 * mm, 'DOCUMENTO FITTIZIO — SOLO PER PROVARE IL SOFTWARE. Non è emesso da una banca.')
    c.drawRightString(192 * mm, 10 * mm, f'Pagina {page}')
    c.setFillColor(colors.black)

def header(month=None):
    global y
    c.setFont('Helvetica-Bold', 8)
    c.setFillColor(colors.HexColor('#e9edf3')); c.rect(15 * mm, y - 2 * mm, 180 * mm, 7 * mm, stroke=0, fill=1); c.setFillColor(colors.black)
    c.drawString(X['data'], y, 'Data'); c.drawString(X['testo'], y, 'Testo / Descrizione')
    c.drawRightString(X['out'] + 15 * mm, y, 'Addebito CHF'); c.drawRightString(X['in'] + 15 * mm, y, 'Accredito CHF'); c.drawRightString(X['saldo'], y, 'Saldo CHF')
    y -= 8 * mm

def new_page(month=None):
    global y, page
    footer(); c.showPage(); page += 1; y = H - 20 * mm
    c.setFont('Helvetica-Bold', 9); c.drawString(18 * mm, y, 'BANCA DEMO · Estratto conto (continua)'); y -= 9 * mm
    header()

c.setFont('Helvetica-Bold', 16); c.drawString(18 * mm, y, 'BANCA DEMO SA'); y -= 8 * mm
c.setFont('Helvetica', 10); c.drawString(18 * mm, y, 'Estratto conto privato · Valuta CHF'); y -= 7 * mm
for k, v in [('Intestatario', 'Cliente Demo'), ('Conto', 'DEMO-400-2026'), ('IBAN', 'CH00 0000 0000 0000 0000 0 (fittizio)'), ('Periodo', '01.01.2026 – 21.10.2026'), ('Saldo iniziale', f'CHF {fmt(start_bal)}')]:
    c.setFont('Helvetica', 8.5); c.drawString(18 * mm, y, k); c.drawString(50 * mm, y, v); y -= 5 * mm
y -= 4 * mm
cur_month = None
tot_in = tot_out = 0.0
header()
for (day, lab, amt, kind) in rows:
    if day.month != cur_month:
        cur_month = day.month
        if y < 40 * mm: new_page()
        c.setFont('Helvetica-Bold', 9); c.drawString(18 * mm, y, f'{MONTHS[cur_month - 1]} 2026'); y -= 6 * mm
    if y < 22 * mm:
        new_page()
    if kind == 'out': bal -= amt; tot_out += amt
    else: bal += amt; tot_in += amt
    bal = round(bal, 2)
    c.setFont('Helvetica', 8)
    c.drawString(X['data'], y, day.strftime('%d.%m.%Y')); c.drawString(X['testo'], y, lab)
    if kind == 'out': c.drawRightString(X['out'] + 15 * mm, y, fmt(amt))
    else: c.drawRightString(X['in'] + 15 * mm, y, fmt(amt))
    c.drawRightString(X['saldo'], y, fmt(bal))
    y -= 5.2 * mm
y -= 4 * mm
if y < 40 * mm: new_page()
c.setFont('Helvetica-Bold', 9)
c.drawString(18 * mm, y, f'Riepilogo: movimenti {len(rows)} · entrate CHF {fmt(tot_in)} · uscite CHF {fmt(tot_out)} · saldo finale CHF {fmt(bal)}')
footer(); c.save()
print(f'scritto {OUT}: {len(rows)} movimenti, saldo finale {fmt(bal)}')

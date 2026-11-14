import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Item, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { matchBank, monthPay, netRatio, validMonth, type Payslip } from '@/lib/payroll';
import { readPayslip } from '@/lib/payrollAi';
import type { Captured } from '@/lib/warrantyScan';
import { useFin } from '@/store/finance';
import { usePayroll } from '@/store/payroll';
import { toast } from '@/store/toast';

import { Big, CaptureSheet, Field, eur, fromNum, monthTitle, toNum } from './shared';

const uid = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Le buste paga: ogni busta insegna quanto viene davvero trattenuto e rende più precisa la stima dei mesi dopo; si confronta con quello entrato sul conto. */
export function SlipsTab({ today }: { today: string }) {
  const th = useTheme();
  const c = usePayroll((s) => s.contract); const slips = usePayroll((s) => s.slips); const days = usePayroll((s) => s.days);
  const months = useFin((s) => s.months);
  const [pick, setPick] = useState(false); const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ p: Payslip; isNew: boolean; notice?: string } | null>(null);
  const money = (n: number) => eur(n, c.currency);
  const moves = useMemo(() => months.flatMap((m) => m.movements.map((x) => ({ date: x.date, label: x.label, amount: x.amount }))), [months]);
  const nr = useMemo(() => netRatio(c, slips), [c, slips]);
  const all = useMemo(() => Object.values(days), [days]);
  const sorted = useMemo(() => [...slips].sort((a, b) => b.month.localeCompare(a.month)), [slips]);
  const blank = (cap?: Captured): Payslip => ({ id: uid(), month: today.slice(0, 7), gross: 0, net: 0, pages: cap?.pages ?? [], ...(cap?.pdf ? { pdf: cap.pdf } : {}), source: cap ? (cap.source === 'scan' ? 'scan' : cap.source === 'file' ? 'file' : 'foto') : 'manuale', createdAt: today });

  const read = async (cap: Captured) => {
    setBusy(true); const r = await readPayslip(cap); setBusy(false);
    const p = blank(cap);
    if (!r.ok) { toast(r.message); setDraft({ p, isNew: true }); return; }
    setDraft({ p: { ...p, month: r.data.month ?? p.month, gross: r.data.gross ?? 0, net: r.data.net ?? 0, ...(r.data.hours ? { hours: r.data.hours } : {}) }, isNew: true, notice: tl('Ho letto la busta paga: controlla i numeri prima di salvare.') });
  };
  const save = (p: Payslip) => {
    const bank = matchBank(moves, p); const next = { ...p, ...(bank ? { bankDate: bank.move.date } : { bankDate: undefined }) };
    if (draft?.isNew) usePayroll.getState().addSlip(next); else usePayroll.getState().updateSlip(next);
    setDraft(null); toast('Busta paga salvata: da ora la stima del netto è più precisa');
  };

  return (
    <>
      <Card accent={th.accent}>
        <H>Quanto ti trattengono davvero</H>
        <Row style={{ alignItems: 'flex-start' }}>
          <Big label="Resta in busta" value={`${Math.round(nr.ratio * 1000) / 10}%`} color={th.positive} sub={nr.n ? tl('da {0} buste paga', nr.n) : tl('stima del contratto')} />
          <Big label="Trattenuto" value={`${Math.round((1 - nr.ratio) * 1000) / 10}%`} />
        </Row>
        <Body small muted style={{ marginTop: 8 }}>{nr.n ? tl('Più buste paga carichi, più la stima del netto di ogni mese diventa precisa.') : tl('Carica la busta paga di un mese: calcolo la percentuale vera che ti trattengono e la uso per stimare i prossimi mesi.')}</Body>
        <Row gap={8} style={{ justifyContent: 'flex-start', marginTop: 10 }}>
          <Btn icon="camera" disabled={busy} title={busy ? 'Theia legge…' : 'Carica una busta paga'} onPress={() => setPick(true)} />
        </Row>
      </Card>

      <Card>
        <H>Le tue buste paga</H>
        {sorted.length === 0 ? <Empty text={tl('Ancora nessuna busta paga. Caricala quando arriva: la confronto con le tue ore e con quello che entra sul conto.')} /> : sorted.map((s, i) => {
          const bank = matchBank(moves, s); const mine = monthPay(s.month, all, c, []);
          return (
            <Item key={s.id} last={i === sorted.length - 1} onPress={() => setDraft({ p: s, isNew: false })}>
              <Row gap={10}>
                <View style={{ flex: 1 }}>
                  <Body bold>{monthTitle(s.month)}</Body>
                  <Body small muted>{tl('lordo {0} · netto {1} · trattenuto {2}%', money(s.gross), money(s.net), s.gross ? Math.round((1 - s.net / s.gross) * 1000) / 10 : 0)}</Body>
                  <Body small color={bank ? th.positive : th.muted}>{bank ? tl('Entrato sul conto il {0}: {1}', bank.move.date, money(bank.move.amount)) : tl('Non l\'ho trovato sul conto')}</Body>
                  {mine.confirmedGross ? <Body small muted>{tl('Le tue ore confermate valevano {0} lorde ({1})', money(mine.confirmedGross), mine.confirmedGross > s.gross ? tl('{0} in più della busta', money(mine.confirmedGross - s.gross)) : mine.confirmedGross < s.gross ? tl('{0} in meno della busta', money(s.gross - mine.confirmedGross)) : tl('uguale alla busta'))}</Body> : null}
                </View>
                <Text style={{ color: th.positive, fontWeight: '800' }}>{money(s.net)}</Text>
              </Row>
            </Item>
          );
        })}
      </Card>

      <CaptureSheet visible={pick} title="Busta paga" onClose={() => setPick(false)} onCaptured={(cap) => { void read(cap); }} onManual={() => setDraft({ p: blank(), isNew: true })} />
      {draft ? <SlipEditor key={draft.p.id} slip={draft.p} isNew={draft.isNew} notice={draft.notice} currency={c.currency} moves={moves} onSave={save} onClose={() => setDraft(null)}
        onDelete={draft.isNew ? undefined : () => { usePayroll.getState().removeSlip(draft.p.id); setDraft(null); toast('Busta paga eliminata'); }} /> : null}
    </>
  );
}

function SlipEditor({ slip, isNew, notice, currency, moves, onSave, onDelete, onClose }: { slip: Payslip; isNew: boolean; notice?: string; currency: 'EUR' | 'CHF'; moves: { date: string; label: string; amount: number }[]; onSave: (p: Payslip) => void; onDelete?: () => void; onClose: () => void }) {
  const [month, setMonth] = useState(slip.month); const [gross, setGross] = useState(fromNum(slip.gross)); const [net, setNet] = useState(fromNum(slip.net)); const [hours, setHours] = useState(fromNum(slip.hours));
  const bank = matchBank(moves, { month, net: toNum(net) });
  const submit = () => {
    if (!validMonth(month)) { toast('Scrivi il mese così: 2026-10'); return; }
    if (!toNum(gross) || !toNum(net)) { toast('Servono lordo e netto'); return; }
    if (toNum(net) > toNum(gross)) { toast('Il netto non può superare il lordo'); return; }
    onSave({ ...slip, month, gross: toNum(gross), net: toNum(net), ...(toNum(hours) ? { hours: toNum(hours) } : { hours: undefined }) });
  };
  return (
    <Sheet visible title={isNew ? 'Nuova busta paga' : 'Busta paga'} onClose={onClose}>
      <View style={{ gap: 10 }}>
        {notice ? <Body small>{notice}</Body> : null}
        <Field label="Mese di competenza (anno-mese)" value={month} onChange={setMonth} placeholder="2026-10" />
        <Row gap={10}>
          <View style={{ flex: 1 }}><Field label="Lordo" value={gross} onChange={setGross} numeric /></View>
          <View style={{ flex: 1 }}><Field label="Netto in busta" value={net} onChange={setNet} numeric /></View>
        </Row>
        <Field label="Ore pagate (facoltativo)" value={hours} onChange={setHours} numeric />
        {toNum(gross) && toNum(net) ? <Body small muted>{tl('Trattenuto: {0}%', Math.round((1 - toNum(net) / toNum(gross)) * 1000) / 10)}</Body> : null}
        <Body small muted>{bank ? tl('Sul conto: {0} il {1} ({2} dal netto)', eur(bank.move.amount, currency), bank.move.date, bank.diff >= 0 ? `+${eur(bank.diff, currency)}` : eur(bank.diff, currency)) : tl('Non trovo sul conto un accredito che somiglia a questo netto (carica l\'estratto conto nella Finanza personale).')}</Body>
        <Btn title="Salva" onPress={submit} />
        {onDelete ? <Btn ghost danger icon="trash" title="Elimina la busta paga" onPress={onDelete} /> : null}
      </View>
    </Sheet>
  );
}

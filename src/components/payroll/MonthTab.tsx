import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Item, Press, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { addMonth, balance, bankLedger, defaultContract, monthPay, planFromShifts, weekdayOf, type Day } from '@/lib/payroll';
import { readHours } from '@/lib/payrollAi';
import type { Captured } from '@/lib/warrantyScan';
import { usePayroll } from '@/store/payroll';
import { useShifts } from '@/store/shifts';
import { toast } from '@/store/toast';

import { DayEditor } from './DayEditor';
import { Big, CaptureSheet, WD, eur, monthTitle } from './shared';

const KIND_TXT: Record<string, string> = { work: 'Lavoro', vacation: 'Ferie', sick: 'Malattia', holiday: 'Festivo', recovery: 'Recupero ore', off: 'Riposo' };

/** Il mese: ogni giorno con ore, lordo e netto; confermi o cambi; in alto il conto del mese e quanto ti aspetti sul conto. */
export function MonthTab({ today, onContract }: { today: string; onContract: () => void }) {
  const th = useTheme();
  const stored = usePayroll((s) => s.contract); const c = useMemo(() => ({ ...defaultContract(), ...stored }), [stored]); const ready = usePayroll((s) => s.ready); const days = usePayroll((s) => s.days); const slips = usePayroll((s) => s.slips);
  const shifts = useShifts((s) => s.shifts);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [edit, setEdit] = useState<{ day: Day; isNew: boolean } | null>(null);
  const [pick, setPick] = useState(false); const [busy, setBusy] = useState(false);
  const all = useMemo(() => Object.values(days), [days]);
  const pay = useMemo(() => monthPay(month, all, c, slips), [month, all, c, slips]);
  const bal = useMemo(() => balance(all, c, today), [all, c, today]);
  const bank = useMemo(() => bankLedger(all, c, today), [all, c, today]);
  const bankPlan = useMemo(() => bankLedger(all, c, today, true), [all, c, today]);
  const money = (n: number) => eur(n, c.currency);
  const noRate = !(c.kind === 'hourly' ? c.hourly : c.monthly);
  const fresh = (date: string): Day => ({ date, kind: 'work', hours: 0, confirmed: true, source: 'manuale', pause: c.pauseMin });

  const fromShifts = () => {
    const plan = planFromShifts(shifts, month, days, c);
    if (!plan.length) { toast(shifts.length ? 'Nessun turno nuovo da aggiungere in questo mese' : 'Prima crea i tuoi turni in «Turni di lavoro»'); return; }
    usePayroll.getState().setDays(plan); toast(tl('{0} giornate aggiunte dai tuoi turni: confermale man mano', plan.length));
  };
  const fromPhoto = async (cap: Captured) => {
    setBusy(true); const r = await readHours(cap, today); setBusy(false);
    if (!r.ok) { toast(r.message); return; }
    const mine = r.data.filter((x) => !days[x.date]?.confirmed);
    usePayroll.getState().setDays(mine.map((x) => ({ date: x.date, kind: x.kind, hours: x.hours, ...(x.start && x.end ? { start: x.start, end: x.end } : {}), ...(x.pause != null ? { pause: x.pause } : {}), confirmed: false, source: 'foto' as const })));
    if (mine[0]) setMonth(mine[0].date.slice(0, 7));
    toast(tl('Ho letto {0} giornate: controllale e confermale', mine.length));
  };
  const confirmUntilToday = () => { const d = pay.days.filter((x) => !x.confirmed && x.date <= today).map((x) => x.date); usePayroll.getState().confirm(d); toast(tl('{0} giornate confermate', d.length)); };
  const toConfirm = pay.days.filter((x) => !x.confirmed && x.date <= today).length;

  return (
    <>
      {!ready || noRate ? (
        <Card accent={th.accent}>
          <H>Parti dal contratto</H>
          <Body muted>{tl('Per il conto serve la paga: carica il contratto (foto o PDF) o scrivi paga oraria, ore settimanali e ferie. Ci metti due minuti.')}</Body>
          <Btn icon="file" title="Inserisci il contratto" onPress={onContract} style={{ marginTop: 10 }} />
        </Card>
      ) : null}

      <Row>
        <Press accessibilityLabel={tl('Mese precedente')} onPress={() => setMonth(addMonth(month, -1))} style={{ padding: 10 }}><View style={{ transform: [{ rotate: '90deg' }] }}><Icon name="chevron" size={20} color={th.text} /></View></Press>
        <Text style={{ color: th.text, fontSize: 18, fontWeight: '800' }}>{monthTitle(month)}</Text>
        <Press accessibilityLabel={tl('Mese successivo')} onPress={() => setMonth(addMonth(month, 1))} style={{ padding: 10 }}><View style={{ transform: [{ rotate: '-90deg' }] }}><Icon name="chevron" size={20} color={th.text} /></View></Press>
      </Row>

      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <Big label="Netto stimato del mese" value={money(pay.net)} color={th.positive} sub={pay.confirmedNet !== pay.net ? tl('{0} già confermati', money(pay.confirmedNet)) : undefined} />
          <Big label="Lordo del mese" value={money(pay.gross)} sub={pay.fixed ? tl('di cui fisso {0}', money(pay.fixed)) : undefined} />
        </Row>
        <Row style={{ marginTop: 10 }}>
          <Big label="Ore" value={`${pay.hours}`} sub={pay.overtimeHours ? (pay.bankHours ? tl('{0} h in più: {1} in banca ore', pay.overtimeHours, pay.bankHours) : tl('{0} di straordinario', pay.overtimeHours)) : undefined} />
          <Big label="Trattenute usate" value={`${Math.round((1 - pay.ratio) * 100)}%`} sub={pay.ratioFrom === 'buste paga' ? tl('viste nelle tue buste paga') : tl('dal contratto')} />
        </Row>
        <Body small muted style={{ marginTop: 8 }}>{pay.pending ? tl('{0} giornate da confermare: finché non le confermi sono una previsione.', pay.pending) : tl('Il netto usa le trattenute del contratto e poi quelle vere delle tue buste paga, senza le imposte sul reddito.')}</Body>
      </Card>

      <Row gap={8} style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        <Btn small icon="plus" title="Giornata" onPress={() => setEdit({ day: fresh(month === today.slice(0, 7) ? today : `${month}-01`), isNew: true })} />
        <Btn small ghost icon="calendar" title="Dai turni" onPress={fromShifts} />
        <Btn small ghost icon="camera" disabled={busy} title={busy ? 'Theia legge…' : 'Da foto'} onPress={() => setPick(true)} />
        {toConfirm ? <Btn small ghost icon="check" title={tl('Conferma fino a oggi ({0})', toConfirm)} onPress={confirmUntilToday} /> : null}
      </Row>

      <Card>
        <H>Giorno per giorno</H>
        {pay.days.length === 0 ? <Empty text={tl('Ancora nessuna giornata in questo mese. Aggiungila a mano, dai turni o da una foto del foglio ore.')} /> : pay.days.map((x, i) => {
          const d = days[x.date]!;
          return (
            <Item key={x.date} last={i === pay.days.length - 1} onPress={() => setEdit({ day: d, isNew: false })}>
              <Row gap={10}>
                <View style={{ width: 46 }}><Text style={{ color: th.text, fontWeight: '800', fontSize: 16 }}>{Number(x.date.slice(8))}</Text><Body small muted>{tl(WD[weekdayOf(x.date)] ?? '')}</Body></View>
                <View style={{ flex: 1 }}>
                  <Body bold>{d.kind === 'work' ? `${x.hours} h${d.start && d.end ? ` · ${d.start}-${d.end}` : ''}` : tl(KIND_TXT[d.kind] ?? '')}</Body>
                  <Body small muted>{[d.shiftName, d.holiday ? tl('Festivo lavorato') : '', x.bankHours ? tl('+{0} h in banca', x.bankHours) : '', d.kind === 'recovery' ? tl('-{0} h dalla banca', Math.round(c.weekHours / 5 * 100) / 100) : '', !x.confirmed ? tl('Da confermare') : ''].filter(Boolean).join(' · ') || ' '}</Body>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: x.confirmed ? th.positive : th.muted, fontWeight: '800' }}>{x.value || x.hours ? money(x.valueNet) : '—'}</Text>
                  <Body small muted>{x.value ? tl('lordo {0}', money(x.value)) : ' '}</Body>
                </View>
                {!x.confirmed ? <Press accessibilityLabel={tl('Conferma')} onPress={() => usePayroll.getState().confirm([x.date])} style={{ padding: 8 }}><Icon name="check" size={20} color={th.accent} /></Press> : null}
              </Row>
            </Item>
          );
        })}
      </Card>

      {bank.on || bank.recoveryDays ? (
        <Card accent={bank.balance < 0 ? th.danger : th.accent}>
          <H>Banca ore</H>
          <Row style={{ alignItems: 'flex-start' }}>
            <Big label="Saldo" value={`${bank.balance > 0 ? '+' : ''}${bank.balance} h`} color={bank.balance < 0 ? th.danger : th.positive} sub={bank.balance >= 0 ? tl('{0} giorni di recupero', Math.round(bank.balance / Math.max(0.1, c.weekHours / 5) * 10) / 10) : tl('sei sotto di ore')} />
            <Big label="Con le giornate previste" value={`${bankPlan.balance > 0 ? '+' : ''}${bankPlan.balance} h`} sub={tl('guadagnate {0} · recuperate {1}', bank.accrued, bank.recovered)} />
          </Row>
          {bank.nextExpiry ? <Body small color={th.warn} style={{ marginTop: 8 }}>{tl('{0} h scadono il {1}: recuperale prima.', bank.nextExpiry.hours, bank.nextExpiry.date)}</Body> : null}
          {bank.expired ? <Body small muted style={{ marginTop: 4 }}>{tl('{0} h sono scadute.', bank.expired)}</Body> : null}
          {bank.overCap ? <Body small color={th.warn} style={{ marginTop: 4 }}>{tl('Sei {0} h oltre il tetto della banca ore.', bank.overCap)}</Body> : null}
          <Body small muted style={{ marginTop: 6 }}>{tl('Per recuperare, aggiungi una giornata di tipo «Recupero ore».')}</Body>
        </Card>
      ) : null}

      <Card>
        <H>{tl('Ferie e ore in più {0}', bal.year)}</H>
        <Row style={{ alignItems: 'flex-start' }}>
          <Big label="Ferie rimaste" value={`${bal.vacationLeft}`} sub={tl('su {0} · godute {1}', bal.vacationTotal, bal.vacationTaken)} />
          <Big label="Maturate finora" value={`${bal.vacationLeftAccrued}`} sub={tl('{0} maturate', bal.vacationAccrued)} />
        </Row>
        <Row style={{ marginTop: 10, alignItems: 'flex-start' }}>
          <Big label="Ore in più (anno)" value={`${bal.overtimeHours}`} sub={tl('oltre {0} h a settimana', c.weekHours)} />
          <Big label="Ore lavorate (anno)" value={`${bal.workedHours}`} sub={bal.sickDays ? tl('{0} giorni di malattia', bal.sickDays) : undefined} />
        </Row>
      </Card>

      <CaptureSheet visible={pick} title="Foglio ore o turni" onClose={() => setPick(false)} onCaptured={(cap) => { void fromPhoto(cap); }} />
      {edit ? <DayEditor key={edit.day.date + String(edit.isNew)} day={edit.day} isNew={edit.isNew} contract={c} onClose={() => setEdit(null)}
        onSave={(d) => { usePayroll.getState().setDay(d); setEdit(null); if (d.date.slice(0, 7) !== month) setMonth(d.date.slice(0, 7)); toast(d.confirmed ? 'Giornata confermata' : 'Giornata salvata come previsione'); }}
        onDelete={edit.isNew ? undefined : () => { usePayroll.getState().removeDay(edit.day.date); setEdit(null); toast('Giornata eliminata'); }} /> : null}
    </>
  );
}

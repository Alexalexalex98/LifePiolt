import { useState } from 'react';
import { View } from 'react-native';

import { Body, Btn, Pill, Row, Sheet } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { DAY_KINDS, hoursBetween, isTime, monthPay, validDay, weekdayOf, type Contract, type Day, type DayKind } from '@/lib/payroll';
import { toast } from '@/store/toast';

import { Field, WD, eur, fromNum, toNum } from './shared';

/** Una giornata: tipo (lavoro, ferie, malattia…), orari o ore, e quanto vale. Confermi o la lasci come previsione. */
export function DayEditor({ day, isNew, contract, onSave, onDelete, onClose }: { day: Day; isNew: boolean; contract: Contract; onSave: (d: Day) => void; onDelete?: () => void; onClose: () => void }) {
  const [d, setD] = useState<Day>(day);
  const [date, setDate] = useState(day.date);
  const [start, setStart] = useState(day.start ?? ''); const [end, setEnd] = useState(day.end ?? '');
  const [pause, setPause] = useState(String(day.pause ?? contract.pauseMin ?? 0)); const [hours, setHours] = useState(fromNum(day.hours));
  const [note, setNote] = useState(day.note ?? '');
  const times = isTime(start) && isTime(end);
  const build = (confirmed: boolean): Day | null => {
    if (!validDay(date)) { toast('Scrivi la data così: 2026-11-30'); return null; }
    if (d.kind === 'work' && !times && !toNum(hours)) { toast('Scrivi gli orari (09:00 e 17:00) oppure le ore totali'); return null; }
    const p = Math.round(toNum(pause));
    const h = d.kind === 'work' ? (times ? hoursBetween(start, end, p) : toNum(hours)) : 0;
    return { ...d, date, confirmed, hours: h, ...(d.kind === 'work' && times ? { start, end, pause: p } : { start: undefined, end: undefined, pause: undefined }), ...(note.trim() ? { note: note.trim().slice(0, 120) } : { note: undefined }) };
  };
  const preview = (() => {
    const x = validDay(date) ? build(true) : null; if (!x) return null;
    const p = monthPay(date.slice(0, 7), [x], contract, []).days[0]; return p ? { hours: p.hours, gross: p.value, net: p.valueNet } : null;
  })();
  return (
    <Sheet visible title={isNew ? 'Aggiungi una giornata' : 'Modifica la giornata'} onClose={onClose}>
      <View style={{ gap: 10 }}>
        {isNew ? <Field label="Data (anno-mese-giorno)" value={date} onChange={setDate} placeholder="2026-11-30" /> : <Body bold>{`${tl(WD[weekdayOf(date)] ?? '')} ${date}`}</Body>}
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>
          {DAY_KINDS.map((k) => <Pill key={k.k} label={tl(k.n)} on={d.kind === k.k} onPress={() => setD({ ...d, kind: k.k as DayKind })} />)}
        </Row>
        {d.kind === 'work' ? (
          <>
            <Row gap={10}>
              <View style={{ flex: 1 }}><Field label="Inizio" value={start} onChange={setStart} placeholder="09:00" /></View>
              <View style={{ flex: 1 }}><Field label="Fine" value={end} onChange={setEnd} placeholder="17:00" /></View>
              <View style={{ flex: 1 }}><Field label="Pausa (min)" value={pause} onChange={setPause} numeric /></View>
            </Row>
            {!times ? <Field label="Oppure ore totali" value={hours} onChange={setHours} placeholder="7,5" numeric /> : null}
            <Row style={{ justifyContent: 'flex-start' }} gap={6}><Pill label={tl('Festivo lavorato')} on={!!d.holiday} onPress={() => setD({ ...d, holiday: !d.holiday })} /></Row>
          </>
        ) : <Body small muted>{contract.paidLeave ? tl('Conta come una giornata di contratto.') : tl('Non è pagata dal tuo contratto.')}</Body>}
        <Field label="Nota (facoltativa)" value={note} onChange={setNote} />
        {preview && d.kind === 'work' ? <Body small muted>{tl('{0} h · lordo {1} · netto stimato {2}', preview.hours, eur(preview.gross, contract.currency), eur(preview.net, contract.currency))}</Body> : null}
        <Btn icon="check" title="Conferma" onPress={() => { const x = build(true); if (x) onSave(x); }} />
        <Btn ghost title="Salva come previsione" onPress={() => { const x = build(false); if (x) onSave(x); }} />
        {onDelete ? <Btn ghost danger icon="trash" title="Elimina la giornata" onPress={onDelete} /> : null}
      </View>
    </Sheet>
  );
}

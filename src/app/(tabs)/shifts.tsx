import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Body, Btn, Card, H, Input, Item, Page, Pill, Row, Sheet } from '@/components/ui';
import { InfoTip } from '@/components/InfoTip';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { countdown, hoursOf, isTime, upcoming, whenText, type Shift } from '@/lib/shifts';
import { useShifts } from '@/store/shifts';
import { toast } from '@/store/toast';

const WD = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const COLORS = ['#8fa4ff', '#7be0b0', '#ffb84f', '#ff9d9d', '#c9b6ff', '#6ec9dd'];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const empty = (): Omit<Shift, 'id'> => ({ name: '', start: '08:00', end: '16:00', weekdays: [], dates: [], color: COLORS[0] });

/** I turni di lavoro: orari che si ripetono ogni settimana o in date scelte. Il prossimo turno compare anche nei widget della Dashboard. */
export default function Shifts() {
  const t = useTheme();
  const shifts = useShifts((s) => s.shifts);
  const save = useShifts((s) => s.save);
  const remove = useShifts((s) => s.remove);
  const [edit, setEdit] = useState<(Omit<Shift, 'id'> & { id?: string }) | null>(null);
  const now = Date.now();
  const next = upcoming(shifts, now, 60).slice(0, 8);
  const days = Array.from({ length: 28 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });

  const submit = () => {
    if (!edit) return;
    if (!edit.name.trim()) { toast('Dai un nome al turno'); return; }
    if (!isTime(edit.start) || !isTime(edit.end)) { toast('Scrivi gli orari così: 06:00'); return; }
    if (!edit.weekdays.length && !edit.dates.length) { toast('Scegli i giorni: ogni settimana o date precise'); return; }
    save({ ...edit, name: edit.name.trim() });
    setEdit(null);
    toast('Turno salvato');
  };
  const toggleWd = (i: number) => edit && setEdit({ ...edit, weekdays: edit.weekdays.includes(i) ? edit.weekdays.filter((x) => x !== i) : [...edit.weekdays, i].sort() });
  const toggleDate = (k: string) => edit && setEdit({ ...edit, dates: edit.dates.includes(k) ? edit.dates.filter((x) => x !== k) : [...edit.dates, k].sort() });

  return (
    <Page id="shifts" back title="Turni di lavoro">
      <Card accent="#8fa4ff">
        <Row><H style={{ flex: 1 }}>Prossimi turni</H><InfoTip title="Come funzionano i turni" body={['Crei un turno con nome e orario (per esempio «Mattina 06:00-14:00») e scegli i giorni: ogni settimana negli stessi giorni, oppure date precise.', 'Un turno che finisce dopo la mezzanotte (22:00-06:00) finisce il giorno dopo. Il prossimo turno compare nei widget della Dashboard.']} /></Row>
        {next.length ? next.map((o, i) => (
          <Item key={`${o.shift.id}${o.date}`} last={i === next.length - 1}>
            <Row gap={10}>
              <View style={{ width: 6, alignSelf: 'stretch', borderRadius: 3, backgroundColor: o.shift.color ?? t.accent }} />
              <View style={{ flex: 1 }}>
                <Body bold>{o.shift.name}</Body>
                <Body small muted>{`${whenText(o, now)} · ${hoursOf(o)} h`}</Body>
              </View>
              <Body small muted>{o.startTs > now ? countdown(o.startTs, now) : ''}</Body>
            </Row>
          </Item>
        )) : <Body muted style={{ marginTop: 6 }}>Nessun turno in programma. Aggiungine uno qui sotto.</Body>}
      </Card>

      <Card>
        <Row><H style={{ flex: 1 }}>I tuoi turni</H><Btn small icon="plus" title="Nuovo turno" onPress={() => setEdit(empty())} /></Row>
        {shifts.map((s, i) => (
          <Item key={s.id} last={i === shifts.length - 1} onPress={() => setEdit(s)}>
            <Row gap={10}>
              <View style={{ width: 6, alignSelf: 'stretch', borderRadius: 3, backgroundColor: s.color ?? t.accent }} />
              <View style={{ flex: 1 }}>
                <Body bold>{s.name}</Body>
                <Body small muted>{`${s.start}-${s.end} · ${s.weekdays.length ? s.weekdays.map((d) => tl(WD[d])).join(' ') : `${s.dates.length} ${tl('date')}`}${s.weekdays.length && s.dates.length ? ` + ${s.dates.length} ${tl('date')}` : ''}`}</Body>
              </View>
              <Icon name="chevron" size={16} color={t.muted} />
            </Row>
          </Item>
        ))}
        {!shifts.length ? <Body muted style={{ marginTop: 6 }}>Non hai ancora turni.</Body> : null}
      </Card>

      <Sheet visible={!!edit} title={edit?.id ? 'Modifica il turno' : 'Nuovo turno'} onClose={() => setEdit(null)}>
        {edit ? (
          <View style={{ gap: 10 }}>
            <Input placeholder="Nome (es. Mattina, Notte, Weekend)" value={edit.name} onChangeText={(v) => setEdit({ ...edit, name: v })} />
            <Row gap={10}>
              <View style={{ flex: 1 }}><Body small muted>Inizia alle</Body><Input placeholder="06:00" value={edit.start} onChangeText={(v) => setEdit({ ...edit, start: v })} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
              <View style={{ flex: 1 }}><Body small muted>Finisce alle</Body><Input placeholder="14:00" value={edit.end} onChangeText={(v) => setEdit({ ...edit, end: v })} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
            </Row>
            <Body bold>Ogni settimana</Body>
            <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>{WD.map((d, i) => <Pill key={d} label={tl(d)} on={edit.weekdays.includes(i)} onPress={() => toggleWd(i)} />)}</Row>
            <Body bold>Oppure date precise</Body>
            <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>
              {days.map((d) => { const k = iso(d); return <Pill key={k} label={`${tl(WD[(d.getDay() + 6) % 7])} ${d.getDate()}`} on={edit.dates.includes(k)} onPress={() => toggleDate(k)} />; })}
            </Row>
            <Body bold>Colore</Body>
            <Row style={{ justifyContent: 'flex-start' }} gap={10}>
              {COLORS.map((c) => <Pressable key={c} accessibilityRole="button" accessibilityLabel={c} onPress={() => setEdit({ ...edit, color: c })} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, alignItems: 'center', justifyContent: 'center', borderWidth: edit.color === c ? 3 : 0, borderColor: t.text }}>{edit.color === c ? <Icon name="check" size={16} color="#07090d" stroke={3} /> : null}</Pressable>)}
            </Row>
            <Btn title="Salva" onPress={submit} />
            {edit.id ? <Btn ghost danger icon="trash" title="Elimina il turno" onPress={() => { remove(edit.id!); setEdit(null); toast('Turno eliminato'); }} /> : null}
          </View>
        ) : null}
      </Sheet>
    </Page>
  );
}

import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Card, Input, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { PALETTE } from '@/lib/calendarColors';
import { daysBetween, monthGrid, parseKey } from '@/lib/calendarLayout';
import { dayKey } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { goBack } from '@/lib/nav';
import { useLife } from '@/store/life';
import { toast } from '@/store/toast';
import { fmtDate, weekdayNarrow } from '@/i18n/format';
import { t as tl } from '@/i18n/core';

type Range = { id: string; start: string; end: string; name: string };
const MONTHS = 14;
const SWATCH = ['blue', 'orange', 'green', 'violet', 'teal', 'red', 'amber'].map((id) => PALETTE.find((p) => p.id === id)!);
const overlaps = (a: Range, s: string, e: string) => s <= a.end && e >= a.start;

/** Calendario vuoto per scegliere una o più vacanze, come su Booking: primo tocco = partenza, secondo = ritorno. Salvando finiscono nel Plan. */
export default function VacationPlanner() {
  const t = useTheme();
  const addVacation = useLife((s) => s.addVacation);
  const today = dayKey();
  const [ranges, setRanges] = useState<Range[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const mode = t.mode === 'light' ? 'light' : 'dark';
  const colorOf = (i: number) => SWATCH[i % SWATCH.length][mode];

  const months = useMemo(() => {
    const n = new Date();
    return Array.from({ length: MONTHS }, (_, i) => { const d = new Date(n.getFullYear(), n.getMonth() + i, 1); return { y: d.getFullYear(), m: d.getMonth(), rows: monthGrid(d.getFullYear(), d.getMonth()) }; });
  }, []);

  function tap(k: string) {
    if (k < today) return;
    if (!pending) {
      if (ranges.some((r) => k >= r.start && k <= r.end)) { toast('Questo giorno è già in una vacanza'); return; }
      setPending(k);
      return;
    }
    const [s, e] = k >= pending ? [pending, k] : [k, pending];
    if (ranges.some((r) => overlaps(r, s, e))) { toast('Le date si sovrappongono a un\'altra vacanza'); setPending(null); return; }
    setRanges((r) => [...r, { id: `${Date.now()}`, start: s, end: e, name: '' }].sort((a, b) => a.start.localeCompare(b.start)));
    setPending(null);
  }
  const rangeAt = (k: string) => ranges.findIndex((r) => k >= r.start && k <= r.end);

  function save() {
    ranges.forEach((r, i) => {
      const monthLabel = fmtDate(parseKey(r.start), { month: 'long', year: 'numeric' });
      addVacation({ dest: r.name.trim() || tl('Vacanza {0}', i + 1), month: monthLabel, hotel: '', price: 0, days: daysBetween(r.start, r.end, true), flight: 0, start: r.start, end: r.end });
    });
    toast(ranges.length === 1 ? 'Vacanza salvata nel Plan' : tl('{0} vacanze salvate nel Plan', ranges.length));
    goBack();
  }
  const fmt = (k: string) => fmtDate(parseKey(k), { day: 'numeric', month: 'short' });

  return (
    <Page id="vacationPlanner" back title="Pianifica le vacanze">
      <Body small muted>Tocca il giorno di partenza e poi quello di ritorno. Puoi aggiungere quante vacanze vuoi: salvandole le trovi nel Plan.</Body>

      {pending && <Card><Row><Icon name="calendar" size={18} color={t.accent} /><Body style={{ flex: 1 }}>{tl('Partenza: {0}. Ora tocca il giorno di ritorno.', fmt(pending))}</Body><Btn small ghost title="Annulla" onPress={() => setPending(null)} /></Row></Card>}

      {ranges.map((r, i) => (
        <Card key={r.id} accent={colorOf(i)}>
          <Row>
            <View style={{ flex: 1 }}>
              <Body bold>{fmt(r.start)} – {fmt(r.end)} · {tl('{0} giorni', daysBetween(r.start, r.end, true))}</Body>
            </View>
            <Pressable onPress={() => setRanges((x) => x.filter((y) => y.id !== r.id))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Togli questa vacanza"><Icon name="trash" size={18} color={t.muted} /></Pressable>
          </Row>
          <Input placeholder={tl('Nome (es. Vacanza {0})', i + 1)} maxLength={40} value={r.name} onChangeText={(v) => setRanges((x) => x.map((y) => (y.id === r.id ? { ...y, name: v } : y)))} />
        </Card>
      ))}

      <Btn disabled={ranges.length === 0} icon="check" title={ranges.length ? (ranges.length === 1 ? 'Salva nel Plan' : tl('Salva {0} vacanze nel Plan', ranges.length)) : 'Scegli le date'} onPress={save} />

      <View style={{ marginTop: 14 }}>
        {months.map(({ y, m, rows }) => (
          <View key={`${y}-${m}`} style={{ marginBottom: 18 }}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '800', marginBottom: 6, textTransform: 'capitalize' }}>{fmtDate(new Date(y, m, 1), { month: 'long', year: 'numeric' })}</Text>
            <View style={{ flexDirection: 'row', marginBottom: 2 }}>{[1, 2, 3, 4, 5, 6, 0].map((wd, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: t.muted, fontSize: 11 }}>{weekdayNarrow(wd)}</Text>)}</View>
            {rows.map((row, ri) => (
              <View key={ri} style={{ flexDirection: 'row' }}>
                {row.map((k, ci) => {
                  if (!k) return <View key={ci} style={{ flex: 1, height: 44 }} />;
                  const past = k < today;
                  const ri2 = rangeAt(k);
                  const inR = ri2 >= 0;
                  const isStart = inR && ranges[ri2].start === k, isEnd = inR && ranges[ri2].end === k;
                  const isPend = pending === k;
                  const col = inR ? colorOf(ri2) : t.accent;
                  const prevIn = inR && k > ranges[ri2].start && ci > 0;
                  const nextIn = inR && k < ranges[ri2].end && ci < 6;
                  return (
                    <Pressable key={ci} disabled={past} onPress={() => tap(k)} accessibilityRole="button" accessibilityLabel={fmtDate(parseKey(k), { weekday: 'long', day: 'numeric', month: 'long' })} style={{ flex: 1, height: 44, justifyContent: 'center' }}>
                      {inR && <View style={{ position: 'absolute', top: 5, bottom: 5, left: isStart || ci === 0 ? 4 : 0, right: isEnd || ci === 6 ? 4 : 0, backgroundColor: col + '30', borderTopLeftRadius: isStart || !prevIn ? 20 : 0, borderBottomLeftRadius: isStart || !prevIn ? 20 : 0, borderTopRightRadius: isEnd || !nextIn ? 20 : 0, borderBottomRightRadius: isEnd || !nextIn ? 20 : 0 }} />}
                      <View style={{ alignSelf: 'center', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: isStart || isEnd || isPend ? col : 'transparent', borderWidth: k === today && !(isStart || isEnd || isPend) ? 1.5 : 0, borderColor: t.accent }}>
                        <Text style={{ color: isStart || isEnd || isPend ? t.onAccent : past ? t.muted : t.text, opacity: past ? 0.45 : 1, fontSize: 14, fontWeight: inR || isPend ? '800' : '500' }}>{Number(k.slice(8))}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        ))}
      </View>
    </Page>
  );
}

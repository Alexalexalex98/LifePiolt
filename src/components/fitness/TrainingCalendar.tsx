import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { FIT } from '@/components/fitness/kit';
import { Text } from '@/components/T';
import { Body, Card, H, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { addDays, dayInfo, parseIso } from '@/lib/fitness/dayPlan';
import { programById } from '@/lib/fitness/programsExtra';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useFitness } from '@/store/fitness';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const WD = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

/** Il mese intero: i giorni in cui ti sei allenato sono pieni, quelli saltati hanno una croce; tocchi un giorno e lo apri (anche nel passato). */
export function TrainingCalendar() {
  const t = useTheme();
  const fit = useFitness();
  const [off, setOff] = useState(0);
  const today = iso(new Date());
  const first = useMemo(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + off, 1); }, [off]);
  const active = fit.activeProgram ? programById(fit.activeProgram) ?? null : null;
  const ctx = { program: active, profile: fit.profile, history: fit.history, plans: fit.plans ?? {}, now: new Date() };
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: count }, (_, i) => iso(new Date(first.getFullYear(), first.getMonth(), i + 1)))];
  while (cells.length % 7) cells.push(null);
  const month = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const doneN = cells.filter((d) => d && dayInfo(d, ctx).done).length;
  return (
    <Card>
      <Row>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Mese precedente')} hitSlop={10} onPress={() => setOff(off - 1)}><Icon name="arrow-left" size={20} color={t.text} /></Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}><H style={{ marginBottom: 0, textTransform: 'capitalize' }}>{month}</H><Body small muted>{tl('{0} allenamenti fatti', doneN)}</Body></View>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Mese successivo')} hitSlop={10} onPress={() => setOff(off + 1)}><Icon name="arrow-right" size={20} color={t.text} /></Pressable>
      </Row>
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        {WD.map((w, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: t.muted, fontSize: 11, fontWeight: '800' }}>{w}</Text>)}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={{ flexDirection: 'row', marginTop: 6, gap: 4 }}>
          {cells.slice(r * 7, r * 7 + 7).map((d, c) => {
            if (!d) return <View key={c} style={{ flex: 1, height: 40 }} />;
            const i = dayInfo(d, ctx);
            const missed = i.planned && !i.done && d < today;
            const partial = !i.done && !!(fit.exDone ?? {})[d]?.idx.length;
            return (
              <Pressable key={c} accessibilityRole="button" accessibilityLabel={tl('Apri la giornata del {0}', d)} onPress={() => go('fitnessPlanDay', { date: d })}
                style={{ flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: i.done ? FIT : missed ? t.warn + '26' : i.planned ? FIT + '2e' : t.chip + '99', borderWidth: d === today ? 2 : 0, borderColor: FIT }}>
                <Text style={{ color: i.done ? '#1c0b04' : t.text, fontWeight: '800', fontSize: 13 }}>{parseIso(d).getDate()}</Text>
                {partial ? <View style={{ position: 'absolute', bottom: 3, width: 5, height: 5, borderRadius: 3, backgroundColor: FIT }} /> : null}
                {missed ? <View style={{ position: 'absolute', top: 3, end: 4 }}><Icon name="x" size={9} color={t.warn} stroke={3.5} /></View> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
      <Row style={{ marginTop: 10 }} gap={14}>
        <Row gap={5}><View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: FIT }} /><Body small muted>Fatto</Body></Row>
        <Row gap={5}><View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: FIT + '2e' }} /><Body small muted>In programma</Body></Row>
        <Row gap={5}><Icon name="x" size={12} color={t.warn} stroke={3} /><Body small muted>Non fatto</Body></Row>
      </Row>
    </Card>
  );
}

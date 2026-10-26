import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { FIT } from '@/components/fitness/kit';
import { Text } from '@/components/T';
import { Body, Card, H, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { parseIso } from '@/lib/fitness/dayPlan';
import { groupByDay } from '@/lib/fitness/mealInsights';
import type { Meal } from '@/store/fitness';
import { Icon } from '@/lib/icons';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const WD = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const GREEN = '#5fd39a', AMBER = '#ffb020', RED = '#ff6b6b', BLUE = '#6aa8ff';

/** Colore del giorno in base a quante calorie hai mangiato rispetto all'obiettivo: poche (azzurro), in linea (verde), un po' sopra (arancio), molto sopra (rosso). */
export function kcalTone(kcal: number, target?: number): string | null {
  if (!kcal) return null;
  if (!target) return FIT;
  const r = kcal / target;
  return r < 0.6 ? BLUE : r <= 1.1 ? GREEN : r <= 1.3 ? AMBER : RED;
}

/** Il mese intero: scegli il giorno toccandolo; ogni giorno è colorato e riporta le calorie mangiate. */
export function MealCalendar({ meals, target, selected, onPick }: { meals: Meal[]; target?: number; selected: string; onPick: (day: string) => void }) {
  const t = useTheme();
  const [off, setOff] = useState(0);
  const first = useMemo(() => { const s = parseIso(selected); return new Date(s.getFullYear(), s.getMonth() + off, 1); }, [selected, off]);
  const kcal = useMemo(() => { const m = new Map<string, number>(); groupByDay(meals).forEach((g) => m.set(g.key, Math.round(g.total.kcal))); return m; }, [meals]);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: count }, (_, i) => iso(new Date(first.getFullYear(), first.getMonth(), i + 1)))];
  while (cells.length % 7) cells.push(null);
  const today = iso(new Date());
  const month = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const logged = cells.filter((d) => d && kcal.get(d)).length;
  return (
    <Card>
      <Row>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Mese precedente')} hitSlop={10} onPress={() => setOff(off - 1)}><Icon name="arrow-left" size={20} color={t.text} /></Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}><H style={{ marginBottom: 0, textTransform: 'capitalize' }}>{month}</H><Body small muted>{tl('{0} giorni con pasti', logged)}</Body></View>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Mese successivo')} hitSlop={10} onPress={() => setOff(off + 1)}><Icon name="arrow-right" size={20} color={t.text} /></Pressable>
      </Row>
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        {WD.map((w, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: t.muted, fontSize: 11, fontWeight: '800' }}>{w}</Text>)}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={{ flexDirection: 'row', marginTop: 5, gap: 4 }}>
          {cells.slice(r * 7, r * 7 + 7).map((d, c) => {
            if (!d) return <View key={c} style={{ flex: 1, height: 52 }} />;
            const k = kcal.get(d) ?? 0;
            const tone = kcalTone(k, target);
            const sel = d === selected;
            return (
              <Pressable key={c} accessibilityRole="button" accessibilityLabel={`${parseIso(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}${k ? `, ${k} kcal` : ''}`} onPress={() => onPick(d)}
                style={{ flex: 1, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: tone ? tone + '33' : t.chip + '88', borderWidth: sel ? 2.5 : d === today ? 1.5 : 0, borderColor: sel ? t.text : FIT }}>
                <Text style={{ color: t.text, fontWeight: '800', fontSize: 13 }}>{parseIso(d).getDate()}</Text>
                <Text style={{ color: tone ?? t.muted, fontWeight: '800', fontSize: 9.5, marginTop: 1 }}>{k ? k : '·'}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
      <Row style={{ marginTop: 10, flexWrap: 'wrap', justifyContent: 'flex-start' }} gap={12}>
        {[[BLUE, 'Poche'], [GREEN, 'In linea'], [AMBER, 'Un po\' sopra'], [RED, 'Molto sopra']].map(([c, l]) => (
          <Row key={l} gap={5}><View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: c }} /><Body small muted>{l}</Body></Row>
        ))}
      </Row>
      <Body small muted style={{ marginTop: 6 }}>{target ? tl('Colori rispetto al tuo obiettivo di {0} kcal.', target) : 'Imposta i tuoi dati per vedere i colori rispetto all\'obiettivo.'}</Body>
    </Card>
  );
}

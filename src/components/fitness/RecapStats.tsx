import { View } from 'react-native';
import { Text } from '@/components/T';

import { Bars, Donut } from '@/components/charts';
import { FIT, StatTile } from '@/components/fitness/kit';
import { Body, Card, H, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import type { DayMeal } from '@/lib/fitness/mealInsights';
import { recap } from '@/lib/fitness/recapStats';

const P = '#6aa8ff', C = '#ffd166', F = '#ff7a8a', GREEN = '#5fd39a', AMBER = '#ffb020';
const SLOT: Record<string, string> = { colazione: 'Colazione', pranzo: 'Pranzo', merenda: 'Merenda', cena: 'Cena', notte: 'Dopo cena' };
const pc = (n: number) => `${Math.round(n * 100)}%`;
const dl = (key: string) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };

/** Statistiche di un periodo: numeri chiave, andamento delle calorie, ripartizione dei macro, fasce della giornata, cibi più frequenti e confronto. */
export function RecapStats({ meals, days, targetKcal, sugarMax, now = Date.now() }: { meals: DayMeal[]; days: number; targetKcal?: number; sugarMax?: number; now?: number }) {
  const t = useTheme();
  const r = recap(meals, now, days, { targetKcal, sugarMax });
  if (!r.logged) return null;
  const single = days === 1;
  const slotMax = Math.max(1, ...r.slots.map((s) => s.kcal));
  const row2 = (a: [string, string, string?], b: [string, string, string?]) => <Row gap={10}><StatTile value={a[0]} label={tl(a[1])} icon={a[2]} /><StatTile value={b[0]} label={tl(b[1])} icon={b[2]} /></Row>;
  return (
    <>
      <Card>
        <H>{single ? 'Il giorno in numeri' : 'In numeri'}</H>
        <View style={{ gap: 10, marginTop: 8 }}>
          {single ? row2([String(r.meals), 'pasti registrati', 'lifefitness'], [`${r.kcal}`, 'calorie totali', 'sparkle'])
            : <>
              {row2([String(r.logged), `giorni registrati su ${r.span}`, 'calendar'], [String(r.meals), 'pasti in tutto', 'lifefitness'])}
              {row2([`${r.avgKcal}`, 'kcal medie al giorno', 'sparkle'], [String(r.mealsPerDay).replace('.', ','), 'pasti al giorno', 'lifefitness'])}
              {row2([r.onTarget !== undefined ? pc(r.onTarget) : '-', 'giorni vicini all\'obiettivo', 'check'], [`${r.streak}`, 'giorni di fila', 'sparkle'])}
            </>}
        </View>
        {r.delta !== undefined && !single ? <Body small style={{ marginTop: 10, color: Math.abs(r.delta) < 5 ? t.muted : AMBER }}>{r.delta === 0 ? tl('Calorie medie uguali al periodo precedente.') : tl(r.delta > 0 ? 'Calorie medie al giorno: {0}% in più rispetto al periodo precedente.' : 'Calorie medie al giorno: {0}% in meno rispetto al periodo precedente.', Math.abs(r.delta))}</Body> : null}
      </Card>

      {r.series.length > 1 ? (
        <Card>
          <H>{days > 31 ? 'Calorie medie per mese' : 'Calorie giorno per giorno'}</H>
          <View style={{ marginTop: 10 }}><Bars data={r.series.map((s) => s.kcal)} color={`${FIT}88`} hi={FIT} height={90} /></View>
          <Row style={{ marginTop: 4 }}><Text style={{ color: t.muted, fontSize: 11 }}>{r.series[0].label}</Text><Text style={{ color: t.muted, fontSize: 11 }}>{r.series[r.series.length - 1].label}</Text></Row>
          {targetKcal ? <Body small muted style={{ marginTop: 6 }}>{tl('Obiettivo: {0} kcal al giorno. La barra più alta è colorata.', targetKcal)}</Body> : null}
        </Card>
      ) : null}

      <Card>
        <H>Da dove vengono le calorie</H>
        <Row gap={16} style={{ marginTop: 10 }}>
          <Donut parts={[{ p: r.split.p, c: P }, { p: r.split.c, c: C }, { p: r.split.f, c: F }]} size={116} hole={22} holeColor={t.card} />
          <View style={{ flex: 1, gap: 8 }}>
            {[['Proteine', r.split.p, P], ['Carboidrati', r.split.c, C], ['Grassi', r.split.f, F]].map(([l, v, col]) => (
              <Row key={String(l)} gap={8} style={{ justifyContent: 'flex-start' }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: String(col) }} /><Body style={{ flex: 1 }}>{tl(String(l))}</Body><Body bold>{pc(Number(v))}</Body></Row>
            ))}
          </View>
        </Row>
      </Card>

      <Card>
        <H>Quando mangi</H>
        {r.slots.map((s) => (
          <View key={s.id} style={{ marginTop: 8 }}>
            <Row><Body small muted>{tl(SLOT[s.id])}</Body><Body small bold>{s.kcal ? `${s.kcal} kcal · ${pc(s.share)}` : '-'}</Body></Row>
            <View style={{ height: 7, borderRadius: 4, backgroundColor: t.chip, overflow: 'hidden', marginTop: 3 }}><View style={{ width: `${Math.round((s.kcal / slotMax) * 100)}%`, height: 7, backgroundColor: FIT }} /></View>
          </View>
        ))}
      </Card>

      <Card>
        <H>Qualità in sintesi</H>
        <View style={{ gap: 8, marginTop: 8 }}>
          {row2([`${r.sugarAvg}`.replace('.', ',') + ' g', 'zuccheri al giorno (media)'], [`${r.fibreAvg}`.replace('.', ',') + ' g', 'fibre al giorno (media)'])}
        </View>
        <Body small style={{ marginTop: 10, color: r.junkShare >= 0.35 ? AMBER : GREEN }}>{tl('Cibo molto lavorato (fritti, dolci, bibite, fast food): {0} delle calorie.', pc(r.junkShare))}</Body>
        {!single && r.sugarDaysOver ? <Body small style={{ marginTop: 4, color: AMBER }}>{tl('Giorni sopra il limite di zuccheri: {0}.', r.sugarDaysOver)}</Body> : null}
      </Card>

      {r.foods.length ? (
        <Card>
          <H>{single ? 'I piatti di oggi' : 'Cosa mangi più spesso'}</H>
          {r.foods.map((f) => <Row key={f.name} style={{ marginTop: 8 }}><Body style={{ flex: 1 }} numberOfLines={1}>{f.name}</Body><Body small muted>{`${f.count} ${f.count === 1 ? tl('volta') : tl('volte')} · ${f.kcal} kcal`}</Body></Row>)}
        </Card>
      ) : null}

      {!single && r.top ? (
        <Card>
          <H>Record</H>
          <Row style={{ marginTop: 8 }}><Body muted>Giorno con più calorie</Body><Body bold>{`${dl(r.top.key)} · ${r.top.kcal} kcal`}</Body></Row>
          {r.low ? <Row style={{ marginTop: 6 }}><Body muted>Giorno con meno calorie</Body><Body bold>{`${dl(r.low.key)} · ${r.low.kcal} kcal`}</Body></Row> : null}
        </Card>
      ) : null}
    </>
  );
}

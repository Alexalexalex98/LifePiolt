import { View } from 'react-native';
import { Text } from '@/components/T';

import { FIT, Ring } from '@/components/fitness/kit';
import { Body, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { limitState, sumTotals, waterGoal, type LimitState } from '@/lib/fitness/mealInsights';
import { NUTRITION_LEGAL, microRows, type Micro } from '@/lib/fitness/micro';
import { dailyTargets, type Body as BodyT } from '@/lib/fitness/nutrition';
import type { Meal } from '@/store/fitness';

const GREEN = '#5fd39a', AMBER = '#ffb020';
/** Numeri leggibili: dai 100 in su senza decimali, sotto con la virgola e senza «,0». */
const nf = (n: number) => (Math.abs(n) >= 100 ? String(Math.round(n)) : (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '').replace('.', ','));
const L = (n: number) => `${(n / 1000).toFixed(1).replace('.', ',')} L`;

/** Barra con «mangiato / dovresti» in grammi: verde nei limiti, arancione poco oltre, rossa oltre. */
function Dose({ label, eaten, goal, unit = 'g', state, hint }: { label: string; eaten: number; goal?: number; unit?: string; state: LimitState; hint?: string }) {
  const t = useTheme();
  const col = state === 'over' ? t.danger : state === 'warn' ? AMBER : GREEN;
  const pct = goal ? Math.min(100, (eaten / goal) * 100) : 0;
  return (
    <View style={{ marginTop: 8 }}>
      <Row><Text style={{ color: t.muted, fontSize: 13, fontWeight: '600' }}>{label}</Text><Text style={{ color: state === 'ok' ? t.text : col, fontSize: 14, fontWeight: '800' }}>{`${unit === 'L' ? String(eaten).replace('.', ',') : nf(eaten)}${goal ? ` / ${unit === 'L' ? String(goal).replace('.', ',') : nf(goal)}` : ''} ${unit}`}</Text></Row>
      <View style={{ height: 7, borderRadius: 4, backgroundColor: t.chip, overflow: 'hidden', marginTop: 3 }}><View style={{ width: `${Math.max(goal ? 3 : 0, pct)}%`, height: 7, backgroundColor: col }} /></View>
      {hint ? <Text style={{ color: state === 'ok' ? t.muted : col, fontSize: 11.5, marginTop: 2 }}>{hint}</Text> : null}
    </View>
  );
}

/**
 * Resoconto di un giorno (o di una media): anello delle calorie, grammi di proteine, carboidrati e grassi mangiati rispetto a quelli che
 * dovresti mangiare, altri valori con il limite (arancione se superato di poco, rosso se superato di più) e l'acqua.
 */
export function DaySummary({ meals, waterMl, body, avg, micro }: { /** vitamine e minerali stimati */ micro?: Micro; meals: Meal[] | Pick<Meal, 'macros'>[]; waterMl?: number | null; body: BodyT | null; /** valori già medi (al posto della somma dei pasti) */ avg?: ReturnType<typeof sumTotals> }) {
  const t = useTheme();
  const sum = avg ?? sumTotals(meals.map((m) => m.macros));
  const tg = body ? dailyTargets(body) : null;
  const kState = limitState(sum.kcal, tg?.kcal);
  const kCol = kState === 'over' ? t.danger : kState === 'warn' ? AMBER : GREEN;
  const g = (v: number | undefined) => Math.round((v ?? 0) * 10) / 10;
  const wGoal = waterGoal(body?.weightKg);
  const wState: LimitState = 'ok';
  return (
    <View>
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Ring size={156} stroke={15} value={tg ? sum.kcal / tg.kcal : 0} big={String(sum.kcal)} small={tg ? `su ${tg.kcal} kcal` : 'kcal'} color={tg ? kCol : FIT} />
      </View>
      <View style={{ marginTop: 6 }}>
        <Body bold>Macronutrienti</Body>
        <Dose label={tl('Proteine')} eaten={g(sum.p)} goal={tg?.protein} state={limitState(sum.p, tg ? tg.protein * 1.6 : undefined)} hint={tg && sum.p < tg.protein * 0.8 ? tl('ne mancano circa {0} g', Math.round(tg.protein - sum.p)) : undefined} />
        <Dose label={tl('Carboidrati')} eaten={g(sum.c)} goal={tg?.carbs} state={limitState(sum.c, tg?.carbs)} hint={tg && sum.c > tg.carbs ? tl('oltre di {0} g', Math.round(sum.c - tg.carbs)) : undefined} />
        <Dose label={tl('Grassi')} eaten={g(sum.f)} goal={tg?.fat} state={limitState(sum.f, tg?.fat)} hint={tg && sum.f > tg.fat ? tl('oltre di {0} g', Math.round(sum.f - tg.fat)) : undefined} />
      </View>
      {tg && kState !== 'ok' ? <Body bold style={{ marginTop: 8, color: kCol }}>{tl('Hai superato il fabbisogno di {0} kcal', Math.round(sum.kcal - tg.kcal))}</Body> : null}
      <View style={{ marginTop: 12 }}>
        <Body bold>Altri valori</Body>
        <Dose label={tl('Grassi saturi')} eaten={g(sum.sat)} goal={tg?.satMax} state={limitState(sum.sat ?? 0, tg?.satMax)} hint={tg ? tl('massimo {0} g', tg.satMax) : undefined} />
        <Dose label={tl('Zuccheri')} eaten={g(sum.sug)} goal={tg?.sugarMax} state={limitState(sum.sug ?? 0, tg?.sugarMax)} hint={tg ? tl('massimo {0} g (anche quelli di frutta e latte)', tg.sugarMax) : undefined} />
        <Dose label={tl('Fibre')} eaten={g(sum.fib)} goal={tg?.fibre} state="ok" hint={tg && (sum.fib ?? 0) < tg.fibre ? tl('ne servono almeno {0} g', tg.fibre) : undefined} />
        <Dose label={tl('Sale')} eaten={g(sum.salt)} goal={tg?.saltMax} state={limitState(sum.salt ?? 0, tg?.saltMax)} hint={tg ? tl('massimo {0} g', tg.saltMax) : undefined} />
        <Dose label={tl('Acqua')} eaten={Math.round(((waterMl ?? 0) / 1000) * 10) / 10} goal={Math.round((wGoal / 1000) * 10) / 10} unit="L" state={wState} hint={(waterMl ?? 0) < wGoal * 0.7 ? tl('ne servirebbero circa {0}', L(wGoal)) : undefined} />
      </View>
      {micro ? (
        <View style={{ marginTop: 12 }}>
          <Body bold>Vitamine e minerali (stima)</Body>
          <Body small muted>Rispetto al riferimento giornaliero: da 70% in su va bene.</Body>
          {microRows(micro).map((r) => { const col = r.level === 'ok' ? GREEN : r.level === 'basso' ? AMBER : t.danger; return (
            <View key={r.key} style={{ marginTop: 6 }}>
              <Row><Text style={{ color: t.muted, fontSize: 13, fontWeight: '600' }}>{tl(r.label)}</Text><Text style={{ color: r.level === 'ok' ? t.text : col, fontSize: 13, fontWeight: '800' }}>{`${r.value} / ${r.ref} ${r.unit} · ${r.pct}%`}</Text></Row>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: t.chip, overflow: 'hidden', marginTop: 2 }}><View style={{ width: `${Math.max(2, Math.min(100, r.pct))}%`, height: 6, backgroundColor: col }} /></View>
            </View>
          ); })}
        </View>
      ) : null}
      <Body small muted style={{ marginTop: 8 }}>Il totale dei grassi saturi, zuccheri, fibre e sale conta solo gli alimenti di cui conosco questi dati: può essere inferiore al reale. {NUTRITION_LEGAL}</Body>
    </View>
  );
}

import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { FIT } from '@/components/fitness/kit';
import { Body, Btn, Card, H, Input, Page, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { compareDay } from '@/lib/fitness/pantry';
import { InfoTip } from '@/components/InfoTip';
import { balanceDay, dayKcal, kcalOf, type Avoid, type Diet, type PlanMeal } from '@/lib/fitness/mealPlan';
import { dayOf, mealTitle } from '@/lib/fitness/mealInsights';
import { FOOD, NUTRITION_DISCLAIMER, dailyTarget, searchFoods } from '@/lib/fitness/nutrition';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { sendToAssistant } from '@/lib/assistant/run';
import { useFitness } from '@/store/fitness';
import { usePantry } from '@/store/pantry';
import { toast } from '@/store/toast';

const WD = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const DIETS: { id: Diet; label: string }[] = [{ id: 'onnivoro', label: 'Di tutto' }, { id: 'vegetariano', label: 'Vegetariana' }, { id: 'vegano', label: 'Vegana' }];
const AVOIDS: Avoid[] = ['lattosio', 'glutine', 'frutta secca', 'pesce', 'uova'];
const SLOT: Record<string, string> = { colazione: 'Colazione', spuntino: 'Spuntino', pranzo: 'Pranzo', merenda: 'Merenda', cena: 'Cena' };
const todayIdx = () => (new Date().getDay() + 6) % 7;

/** Il piano alimentare: lo crei dalle tue esigenze (non è un piano dietetico), lo cambi come vuoi e lo confronti con ciò che mangi davvero. */
export default function MealPlan() {
  const t = useTheme();
  const fit = useFitness();
  const { plan, planMeta, prefs, setPrefs, makePlan, setPlan } = usePantry();
  const [day, setDay] = useState(todayIdx());
  const [edit, setEdit] = useState<{ d: number; m: PlanMeal } | null>(null);
  const [q, setQ] = useState('');
  const target = prefs.kcalOverride ?? (fit.body ? dailyTarget(fit.body) : prefs.kcal);
  const found = q.trim() ? searchFoods(q, 8) : [];
  const meals = plan?.[day] ?? [];
  const eatenToday = fit.meals.filter((m) => dayOf(m.ts) === dayOf(Date.now()));
  const gapB = meals.length ? balanceDay(meals, target) : null;
  const total = dayKcal(meals);
  const gap = gapB && Math.abs(total - target) > target * 0.08 && gapB.status !== 'ok' ? gapB : null;
  const cmp = plan && day === todayIdx() ? compareDay(meals.flatMap((m) => m.items), eatenToday) : null;

  const create = (again?: boolean) => {
    setPrefs({ kcal: target });
    const w = makePlan(again);
    toast(w.length ? w[0] : tl('Piano pronto: cambia quello che vuoi'));
  };
  const patchMeal = (d: number, id: string, fn: (m: PlanMeal) => PlanMeal | null) => {
    if (!plan) return;
    setPlan(plan.map((dd, i) => (i === d ? dd.map((m) => (m.id === id ? fn(m) : m)).filter((m): m is PlanMeal => !!m) : dd)));
  };
  /** Cambia l'obiettivo calorico: tutta la settimana si ridimensiona (dove è possibile con porzioni ragionevoli). */
  const changeTarget = (v: number) => { setPrefs({ kcalOverride: v, kcal: v }); if (plan) setPlan(plan.map((d) => balanceDay(d, v).day)); };
  /** Salva il pasto cambiato: il titolo segue gli ingredienti e gli altri pasti del giorno si ridimensionano per restare sull'obiettivo. */
  const saveMeal = (d: number, m: PlanMeal) => {
    if (!plan) return;
    const renamed: PlanMeal = { ...m, name: m.items.length ? mealTitle(m.items.map((i) => FOOD(i.foodId)?.name ?? i.foodId)) : m.name };
    const dayNew = plan[d].map((x) => (x.id === m.id ? renamed : x));
    const b = balanceDay(dayNew, target, m.id);
    setPlan(plan.map((dd, i) => (i === d ? b.day : dd)));
    if (b.status !== 'ok') toast(tl('Non riesco a restare sull\'obiettivo: guarda il suggerimento sotto'));
  };
  const missingForWeek = () => {
    if (!plan) return;
    const n = usePantry.getState().shopForPlan(7).length;
    toast(n ? tl('Aggiunti {0} ingredienti alla lista della spesa', n) : tl('In frigo hai già tutto per 7 giorni'));
  };

  return (
    <Page id="fitnessMealPlan" back title={tl('Piano alimentare')}>
      <Card accent={FIT}>
        <Row gap={10}>
          <View style={{ flex: 1 }}>
            <H style={{ marginBottom: 2 }}>{planMeta?.title ?? tl('Crealo con Theia')}</H>
            <Body small muted>{planMeta ? (planMeta.notes ?? tl('Piano scritto con Theia. Se qualcosa non ti piace, dimmelo in chat e lo cambio.')) : tl('Parlane con Theia: ti chiede come stai, cosa non mangi e cosa vuoi ottenere, poi scrive il piano su misura e lo trovi qui.')}</Body>
          </View>
        </Row>
        <Row gap={8} style={{ marginTop: 10, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          <Btn small icon="chat" title={plan ? tl('Cambia con Theia') : tl('Parla con Theia')} onPress={() => { void sendToAssistant(plan ? 'Vorrei cambiare qualcosa nel piano alimentare' : 'Vorrei un piano alimentare su misura per me'); go('ai'); }} />
          {plan ? <Btn small ghost icon="note" title={tl('Lista della spesa')} onPress={missingForWeek} /> : null}
        </Row>
      </Card>
      <Card accent={FIT}>
        <H>{tl('Le tue esigenze')}</H>
        <Body small muted style={{ marginBottom: 8 }}>{tl('Fabbisogno indicativo: {0} kcal al giorno', target)}</Body>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>{DIETS.map((d) => <Pill key={d.id} label={tl(d.label)} on={prefs.diet === d.id} onPress={() => setPrefs({ diet: d.id })} />)}</Row>
        <Body small bold style={{ marginTop: 10, marginBottom: 6 }}>{tl('Cosa evitare')}</Body>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>{AVOIDS.map((a) => <Pill key={a} label={tl(a)} on={prefs.avoid.includes(a)} onPress={() => setPrefs({ avoid: prefs.avoid.includes(a) ? prefs.avoid.filter((x) => x !== a) : [...prefs.avoid, a] })} />)}</Row>
        <Body small bold style={{ marginTop: 10, marginBottom: 6 }}>{tl('Per quante persone fai la spesa')}</Body>
        <Row style={{ justifyContent: 'flex-start', alignItems: 'center' }} gap={14}>
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Meno')} hitSlop={8} onPress={() => setPrefs({ people: Math.max(1, (prefs.people ?? 1) - 1) })}><Icon name="minus" size={22} color={t.text} /></Pressable>
          <Text style={{ color: t.text, fontWeight: '900', fontSize: 18 }}>{prefs.people ?? 1}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Di più')} hitSlop={8} onPress={() => setPrefs({ people: Math.min(20, (prefs.people ?? 1) + 1) })}><Icon name="plus" size={22} color={t.text} /></Pressable>
          <Body small muted style={{ flex: 1 }}>{tl('Il piano è per una persona: le quantità della spesa si moltiplicano.')}</Body>
        </Row>
        <Body small bold style={{ marginTop: 10, marginBottom: 6 }}>{tl('Pasti al giorno')}</Body>
        <Row style={{ justifyContent: 'flex-start' }} gap={6}>{([3, 4, 5] as const).map((n) => <Pill key={n} label={String(n)} on={prefs.meals === n} onPress={() => setPrefs({ meals: n })} />)}</Row>
        <Row gap={8} style={{ marginTop: 12 }}>
          <Btn style={{ flex: 1 }} icon="sparkle" title={plan ? tl('Rifai il piano') : tl('Crea il piano')} onPress={() => create(!!plan)} />
        </Row>
        <Body small muted style={{ marginTop: 8 }}>{tl('È un suggerimento a regole, non un piano dietetico: non sostituisce un nutrizionista. Puoi cambiare ogni pasto e ogni quantità.')}</Body>
      </Card>

      {plan ? (
        <>
          <Row style={{ justifyContent: 'space-between' }} gap={4}>
            {WD.map((w, i) => (
              <Pressable key={w} accessibilityRole="button" accessibilityState={{ selected: day === i }} onPress={() => setDay(i)} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, backgroundColor: day === i ? FIT : t.chip }}>
                <Text style={{ color: day === i ? '#1c0b04' : i === todayIdx() ? FIT : t.muted, fontWeight: '800', fontSize: 12 }}>{tl(w)}</Text>
              </Pressable>
            ))}
          </Row>
          <Row gap={8}>
            <Body small muted style={{ flex: 1 }}>{tl('Totale del giorno: {0} kcal (obiettivo {1})', dayKcal(meals), target)}</Body>
            <Pressable accessibilityRole="button" accessibilityLabel={tl('Meno')} hitSlop={8} onPress={() => changeTarget(Math.max(1000, target - 100))}><Icon name="minus" size={18} color={t.muted} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={tl('Di più')} hitSlop={8} onPress={() => changeTarget(Math.min(6000, target + 100))}><Icon name="plus" size={18} color={t.muted} /></Pressable>
          </Row>
          {gap ? (
            <Card accent={t.warn}>
              <Row gap={8}><H style={{ flex: 1, marginBottom: 0 }}>{gap.status === 'low' ? tl('Mancano calorie') : tl('Troppe calorie')}</H><InfoTip title={tl('Perché non riesco a restare sull\'obiettivo')} body={gap.status === 'low' ? [tl('Per arrivare a {0} kcal con {1} pasti ogni porzione dovrebbe diventare enorme: oltre circa il doppio di una porzione normale. Con porzioni ragionevoli, questi pasti arrivano al massimo a {2} kcal.', target, meals.length, gap.max), tl('Hai due strade: aggiungere un pasto o uno spuntino (così le calorie si distribuiscono su più momenti), oppure abbassare l\'obiettivo.')] : [tl('Per scendere a {0} kcal con {1} pasti ogni porzione dovrebbe diventare minuscola: meno della metà di una porzione normale. Con porzioni ragionevoli, questi pasti non scendono sotto {2} kcal.', target, meals.length, gap.min), tl('Hai due strade: togliere un pasto o uno spuntino, oppure alzare l\'obiettivo.')]} /></Row>
              <Body small style={{ marginTop: 4 }}>{gap.status === 'low' ? tl('Con {0} pasti arrivo al massimo a circa {1} kcal.', meals.length, gap.max) : tl('Con {0} pasti non scendo sotto circa {1} kcal.', meals.length, gap.min)}</Body>
              <Row style={{ marginTop: 8, flexWrap: 'wrap', justifyContent: 'flex-start' }} gap={8}>
                <Btn small title={gap.status === 'low' ? tl('Obiettivo a {0} kcal', gap.max) : tl('Obiettivo a {0} kcal', gap.min)} onPress={() => changeTarget(gap.status === 'low' ? gap.max : gap.min)} />
                {gap.status === 'low' && prefs.meals < 5 ? <Btn small ghost title={tl('Passa a {0} pasti', prefs.meals + 1)} onPress={() => { setPrefs({ meals: (prefs.meals + 1) as 3 | 4 | 5 }); create(false); }} /> : null}
                {gap.status === 'high' && prefs.meals > 3 ? <Btn small ghost title={tl('Passa a {0} pasti', prefs.meals - 1)} onPress={() => { setPrefs({ meals: (prefs.meals - 1) as 3 | 4 | 5 }); create(false); }} /> : null}
              </Row>
            </Card>
          ) : null}
          {meals.map((m) => (
            <Card key={m.id} onPress={() => setEdit({ d: day, m })}>
              <Row><View style={{ flex: 1 }}><Body small color={FIT}>{tl(SLOT[m.slot])} · {kcalOf(m.items)} kcal</Body><Body bold>{m.name}</Body>{(m as { note?: string }).note ? <Body small muted>{(m as { note?: string }).note}</Body> : null}<Body small muted>{m.items.map((i) => `${FOOD(i.foodId)?.name ?? i.foodId} ${i.grams} g`).join(' · ')}</Body></View><Icon name="edit" size={18} color={t.muted} /></Row>
            </Card>
          ))}

          {cmp ? (
            <Card>
              <H>{tl('Oggi: previsto e mangiato')}</H>
              {cmp.rows.length ? cmp.rows.slice(0, 8).map((r) => (
                <Row key={r.foodId} style={{ paddingVertical: 3 }}><View style={{ flex: 1 }}><Body small>{r.name}</Body></View><Body small muted>{r.planned} g → {r.eaten} g</Body><Text style={{ color: r.diff < 0 ? t.warn : FIT, fontWeight: '800', fontSize: 12, width: 64, textAlign: 'right' }}>{r.diff > 0 ? '+' : ''}{r.diff} g</Text></Row>
              )) : <Body small muted>{eatenToday.length ? tl('Hai mangiato come previsto.') : tl('Non hai ancora segnato pasti oggi.')}</Body>}
              {cmp.unmatchedMeals ? <Body small muted style={{ marginTop: 6 }}>{tl('{0} pasti segnati senza ingredienti non entrano nel confronto.', cmp.unmatchedMeals)}</Body> : null}
            </Card>
          ) : null}

          <Btn ghost icon="plus" title={tl('Aggiungi alla spesa ciò che manca (7 giorni)')} onPress={missingForWeek} />
          <Row gap={8}><Btn style={{ flex: 1 }} ghost icon="people" title={tl('Frigo e spesa')} onPress={() => go('fitnessFridge')} /><Btn style={{ flex: 1 }} ghost icon="lifefitness" title={tl('Cosa cucino?')} onPress={() => go('fitnessCook')} /></Row>
        </>
      ) : null}
      <Body small muted>{NUTRITION_DISCLAIMER}</Body>

      <Sheet visible={!!edit} title={edit ? tl(SLOT[edit.m.slot]) : ''} onClose={() => { setEdit(null); setQ(''); }}>
        {edit ? (
          <View>
            <Body bold>{edit.m.name}</Body>
            {edit.m.items.map((i, k) => (
              <Row key={k} style={{ paddingVertical: 4 }}>
                <View style={{ flex: 1 }}><Body>{FOOD(i.foodId)?.name ?? i.foodId}</Body></View>
                <Pressable accessibilityRole="button" accessibilityLabel={tl('Meno')} hitSlop={8} onPress={() => { const g = Math.max(5, i.grams - 10); setEdit({ d: edit.d, m: { ...edit.m, items: edit.m.items.map((x, j) => (j === k ? { ...x, grams: g } : x)) } }); }}><Icon name="minus" size={20} color={t.muted} /></Pressable>
                <Text style={{ color: t.text, fontWeight: '800', width: 62, textAlign: 'center' }}>{i.grams} g</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={tl('Di più')} hitSlop={8} onPress={() => setEdit({ d: edit.d, m: { ...edit.m, items: edit.m.items.map((x, j) => (j === k ? { ...x, grams: x.grams + 10 } : x)) } })}><Icon name="plus" size={20} color={t.muted} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={tl('Togli')} hitSlop={8} style={{ marginStart: 10 }} onPress={() => setEdit({ d: edit.d, m: { ...edit.m, items: edit.m.items.filter((_, j) => j !== k) } })}><Icon name="x" size={18} color={t.muted} /></Pressable>
              </Row>
            ))}
            <Input value={q} onChangeText={setQ} placeholder={tl('Aggiungi un alimento')} autoCapitalize="none" />
            {found.map((f) => <Pressable key={f.id} accessibilityRole="button" onPress={() => { setEdit({ d: edit.d, m: { ...edit.m, items: [...edit.m.items, { foodId: f.id, grams: f.portion }] } }); setQ(''); }} style={{ paddingVertical: 8 }}><Body>{f.name} <Text style={{ color: t.muted }}>· {f.portion} g</Text></Body></Pressable>)}
            <Row gap={8} style={{ marginTop: 10 }}>
              <Btn style={{ flex: 1 }} title={tl('Salva')} onPress={() => { saveMeal(edit.d, edit.m); setEdit(null); setQ(''); }} />
              <Btn style={{ flex: 1 }} ghost danger title={tl('Togli il pasto')} onPress={() => { patchMeal(edit.d, edit.m.id, () => null); setEdit(null); }} />
            </Row>
            <Body small muted style={{ marginTop: 8 }}>{tl('Le calorie del pasto: {0} kcal.', kcalOf(edit.m.items))}</Body>
          </View>
        ) : null}
      </Sheet>
    </Page>
  );
}

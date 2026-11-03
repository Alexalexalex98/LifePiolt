import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/T';
import { Btn, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { CAT_COLOR, fmtClock, itemName, ovenLeadMin, prettyAmount, scaleGrams, stepSeconds, type FullRecipe } from '@/lib/recipes/book';
import { addMinutes, secLeft, startTimer, stopTimer, useKitchenTimers } from '@/lib/recipes/timers';
import { macrosFor, sumMacros, FOOD } from '@/lib/fitness/nutrition';
import { useFitness } from '@/store/fitness';
import { useRecipes } from '@/store/recipes';
import { toast } from '@/store/toast';

/** Tiene lo schermo acceso mentre si cucina (se il modulo c'è nella versione installata). */
function useKeepAwake(on: boolean) {
  useEffect(() => {
    if (!on) return;
    let mod: { activateKeepAwakeAsync?: (t?: string) => Promise<void>; deactivateKeepAwake?: (t?: string) => Promise<void> } | null = null;
    try { mod = require('expo-keep-awake'); } catch { mod = null; }
    void mod?.activateKeepAwakeAsync?.('cook')?.catch?.(() => undefined);
    return () => { void mod?.deactivateKeepAwake?.('cook')?.catch?.(() => undefined); };
  }, [on]);
}

/** Cucina con me: un passaggio per schermata, timer che continuano a schermo spento, avviso per il forno, ingredienti spuntabili. */
export function CookMode({ r, onClose }: { r: FullRecipe; onClose: () => void }) {
  const th = useTheme(); const insets = useSafeAreaInsets(); const c = CAT_COLOR[r.cat];
  const cooking = useRecipes((s) => s.cooking);
  const { timers, now } = useKitchenTimers();
  const [ing, setIng] = useState(false); const [fin, setFin] = useState(false); const [stars, setStars] = useState(0); const [diary, setDiary] = useState(true);
  useKeepAwake(!!cooking);
  const fit = useFitness();
  const servings = cooking?.servings ?? r.servings; const i = Math.min(cooking?.step ?? 0, r.steps.length - 1);
  const step = r.steps[i]!; const last = i === r.steps.length - 1;
  const mine = timers.filter((x) => x.recipeId === r.id);
  const go = (n: number) => { void Haptics.selectionAsync().catch(() => undefined); useRecipes.getState().patchCooking({ step: Math.max(0, Math.min(r.steps.length - 1, n)) }); };
  const left = useMemo(() => r.steps.slice(i).reduce((a, s) => a + stepSeconds(s), 0), [r, i]);
  /* il forno serve più avanti: se manca poco al passaggio che lo richiede, ricorda di accenderlo */
  const ovenAhead = useMemo(() => {
    if (step.oven) return null;
    let acc = 0;
    for (let k = i; k < r.steps.length; k++) { const s = r.steps[k]!; if (s.oven && k > i) { const lead = ovenLeadMin(s.oven) * 60; return acc <= lead + 90 ? { k, o: s.oven, lead } : null; } acc += stepSeconds(s); }
    return null;
  }, [r, i, step.oven]);
  const running = step.timer ? mine.find((x) => x.label === step.timer!.label && !x.fired) : undefined;

  const finish = () => {
    useRecipes.getState().markCooked(r.id, stars || undefined);
    if (diary) {
      const its = r.items.filter((x) => FOOD(x.foodId)).map((x) => ({ foodId: x.foodId, name: FOOD(x.foodId)!.name, grams: Math.round(scaleGrams(x.grams, r.servings, 1)) }));
      const m = sumMacros(its.map((x) => macrosFor(FOOD(x.foodId)!, x.grams)));
      fit.addMeal({ ts: Date.now(), name: r.name, grams: its.reduce((a, x) => a + x.grams, 0), macros: m, items: its });
      toast(tl('Buon appetito! Segnato nel diario.'));
    } else toast(tl('Buon appetito!'));
    mine.forEach((x) => stopTimer(x.id));
    useRecipes.getState().stopCooking(); setFin(false); onClose();
  };
  const leave = () => { onClose(); };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={leave} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: th.bg, paddingTop: insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
          <Pressable onPress={leave} hitSlop={10} accessibilityRole="button" accessibilityLabel={tl('Esci dalla cucina')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: th.card, borderWidth: 1, borderColor: th.border, alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={18} color={th.text} stroke={2.4} /></Pressable>
          <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: th.text, fontWeight: '800', fontSize: 16 }}>{r.name}</Text><Text style={{ color: th.muted, fontSize: 12 }}>{`${tl('Passaggio {0} di {1}', i + 1, r.steps.length)} · ${tl('mancano circa {0}', fmtClock(left))}`}</Text></View>
          <Pressable onPress={() => setIng(true)} accessibilityRole="button" style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: th.card, borderWidth: 1, borderColor: th.border }}><Icon name="meal" size={15} color={th.text} /><Text style={{ color: th.text, fontWeight: '800', fontSize: 13 }}>{tl('Ingredienti')}</Text></Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 3, paddingHorizontal: 16 }}>{r.steps.map((_, k) => <Pressable key={k} onPress={() => go(k)} hitSlop={6} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: k <= i ? c : th.border }} />)}</View>

        {mine.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingVertical: 12 }}>
            {mine.map((tm) => { const s = secLeft(tm, now); const done = s <= 0; return (
              <View key={tm.id} style={{ backgroundColor: done ? th.danger : th.card, borderRadius: 16, borderWidth: 1, borderColor: done ? th.danger : th.border, paddingHorizontal: 12, paddingVertical: 8, minWidth: 150 }}>
                <Text style={{ color: done ? '#fff' : th.muted, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>{tm.label}</Text>
                <Text style={{ color: done ? '#fff' : th.text, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{done ? tl('Pronto!') : fmtClock(s)}</Text>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
                  <Pressable onPress={() => addMinutes(tm.id, 1)} hitSlop={8}><Text style={{ color: done ? '#fff' : th.accent, fontWeight: '800', fontSize: 12 }}>+1 min</Text></Pressable>
                  <Pressable onPress={() => stopTimer(tm.id)} hitSlop={8}><Text style={{ color: done ? '#fff' : th.muted, fontWeight: '800', fontSize: 12 }}>{done ? tl('Ok') : tl('Ferma')}</Text></Pressable>
                </View>
              </View>
            ); })}
          </ScrollView>
        ) : null}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 18 }}>
          {ovenAhead ? (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#e8955f22', borderColor: '#e8955f', borderWidth: 1, borderRadius: 16, padding: 12 }}>
              <Icon name="alert" size={20} color="#e8955f" />
              <Text style={{ flex: 1, color: th.text, fontSize: 14, lineHeight: 20 }}>{tl('Accendi il forno adesso a {0}° ({1}): serve circa {2} minuti per scaldarsi.', ovenAhead.o.temp, tl(ovenAhead.o.mode), Math.round(ovenAhead.lead / 60))}</Text>
            </View>
          ) : null}
          <Text style={{ color: th.text, fontSize: 27, lineHeight: 38, fontWeight: '600' }}>{step.text}</Text>
          {step.oven ? (
            <View style={{ backgroundColor: th.card, borderRadius: 18, borderWidth: 1, borderColor: th.border, padding: 14, gap: 4 }}>
              <Text style={{ color: th.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>{tl('Forno')}</Text>
              <Text style={{ color: th.text, fontSize: 24, fontWeight: '800' }}>{`${step.oven.temp}° · ${tl(step.oven.mode)}`}</Text>
              <Text style={{ color: th.muted, fontSize: 13 }}>{tl('Se il forno è freddo, preriscaldalo prima di infornare.')}</Text>
              <Btn small ghost icon="timer" style={{ marginTop: 6, alignSelf: 'flex-start' }} title={tl('Preriscalda: avvia il timer')} onPress={() => { startTimer(tl('Forno in temperatura'), ovenLeadMin(step.oven!) * 60, r.id); }} />
            </View>
          ) : null}
          {step.timer ? (
            <View style={{ backgroundColor: th.card, borderRadius: 18, borderWidth: 1, borderColor: running ? c : th.border, padding: 14, gap: 8 }}>
              <Text style={{ color: th.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>{tl('Timer')}</Text>
              <Text style={{ color: th.text, fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{running ? fmtClock(secLeft(running, now)) : fmtClock(step.timer.sec)}</Text>
              <Btn icon="timer" title={running ? tl('Timer in corso') : tl('Avvia il timer: {0}', step.timer.label)} disabled={!!running} onPress={() => { startTimer(step.timer!.label, step.timer!.sec, r.id); }} />
              <Text style={{ color: th.muted, fontSize: 12 }}>{tl('Continua anche con lo schermo spento: ti avviso con una notifica.')}</Text>
            </View>
          ) : null}
          {r.tip && last ? <Text style={{ color: th.muted, fontSize: 14, lineHeight: 21 }}>{`${tl('Consiglio')}: ${r.tip}`}</Text> : null}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderTopColor: th.border }}>
          <Btn ghost style={{ flex: 1 }} title={tl('Indietro')} disabled={i === 0} onPress={() => go(i - 1)} />
          <Btn style={{ flex: 2 }} title={last ? tl('Finito!') : tl('Avanti')} onPress={() => (last ? setFin(true) : go(i + 1))} />
        </View>

        <Sheet visible={ing} title={tl('Ingredienti per {0} porzioni', servings)} onClose={() => setIng(false)}>
          {r.items.map((it, k) => { const id = `${k}`; const on = !!cooking?.checked.includes(id); const nm = itemName(it); return (
            <Pressable key={id} onPress={() => useRecipes.getState().patchCooking({ checked: on ? (cooking?.checked ?? []).filter((x) => x !== id) : [...(cooking?.checked ?? []), id] })} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: k ? 1 : 0, borderTopColor: th.border }}>
              <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: on ? c : th.muted, backgroundColor: on ? c : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{on ? <Icon name="check" size={14} color="#fff" stroke={3} /> : null}</View>
              <Text style={{ flex: 1, color: on ? th.muted : th.text, fontSize: 16, textDecorationLine: on ? 'line-through' : 'none' }}>{nm}{it.note ? ` (${it.note})` : ''}</Text>
              <Text style={{ color: th.muted, fontSize: 14 }}>{it.grams ? prettyAmount(nm, scaleGrams(it.grams, r.servings, servings)) : tl('q.b.')}</Text>
            </Pressable>
          ); })}
        </Sheet>
        <Sheet visible={fin} title={tl('Piatto finito')} onClose={() => setFin(false)}>
          <View style={{ gap: 14 }}>
            <Text style={{ color: th.text, fontSize: 15 }}>{tl('Com\'è venuto?')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>{[1, 2, 3, 4, 5].map((n) => <Pressable key={n} onPress={() => setStars(n)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${n}`}><Icon name="star" size={32} color={n <= stars ? '#e0c97b' : th.muted} fill={n <= stars ? '#e0c97b' : 'none'} /></Pressable>)}</View>
            <Pressable onPress={() => setDiary(!diary)} accessibilityRole="checkbox" accessibilityState={{ checked: diary }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: diary ? c : th.muted, backgroundColor: diary ? c : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{diary ? <Icon name="check" size={14} color="#fff" stroke={3} /> : null}</View>
              <Text style={{ flex: 1, color: th.text, fontSize: 15 }}>{tl('Segna una porzione nel diario alimentare')}</Text>
            </Pressable>
            <Btn title={tl('Fatto')} onPress={finish} />
          </View>
        </Sheet>
      </View>
    </Modal>
  );
}

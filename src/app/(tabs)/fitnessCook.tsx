import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { FIT } from '@/components/fitness/kit';
import { Body, Btn, Card, H, Input, Page, Pill, Row, Sheet, TabRow } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { cookable, recipeStatus, type RecipeLike } from '@/lib/fitness/cooking';
import { RECIPES, matchRecipes } from '@/lib/fitness/foodDb';
import { FOOD, NUTRITION_DISCLAIMER, macrosFor, sumMacros } from '@/lib/fitness/nutrition';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useFitness } from '@/store/fitness';
import { usePantry } from '@/store/pantry';
import { toast } from '@/store/toast';

/** «Cosa cucino?»: scegli un piatto (ricetta e cosa manca) oppure guarda cosa puoi preparare con quello che hai in frigo. */
export default function Cook() {
  const t = useTheme();
  const items = usePantry((s) => s.items);
  const addShop = usePantry((s) => s.addShop);
  const fit = useFitness();
  const [tab, setTab] = useState('Con quello che ho');
  const [servings, setServings] = useState(1);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<RecipeLike | null>(null);
  const can = useMemo(() => cookable(RECIPES, items, servings), [items, servings]);
  const found = q.trim() ? matchRecipes(q, 20).map((x) => x.recipe) : RECIPES.slice(0, 20);
  const st = open ? recipeStatus(open, items, servings) : null;

  const toList = () => {
    if (!st) return;
    st.missing.forEach((m) => addShop(m.name, m.missing, 'g'));
    toast(tl('Aggiunti {0} ingredienti alla lista della spesa', st.missing.length));
  };
  const cooked = () => {
    if (!open) return;
    const its = open.items.filter((i) => FOOD(i.foodId)).map((i) => ({ foodId: i.foodId, name: FOOD(i.foodId)!.name, grams: Math.round(i.grams * servings) }));
    const m = sumMacros(its.map((i) => macrosFor(FOOD(i.foodId)!, i.grams)));
    fit.addMeal({ ts: Date.now(), name: open.name, grams: its.reduce((a, i) => a + i.grams, 0), macros: m, items: its });
    toast(tl('Segnato nel diario e tolto dal frigo'));
    setOpen(null);
  };
  const row = (r: RecipeLike, extra?: string) => (
    <Card key={r.id} onPress={() => setOpen(r)}>
      <Row><View style={{ flex: 1 }}><Body bold>{r.name}</Body>{extra ? <Body small color={FIT}>{extra}</Body> : null}</View><Icon name="chevron" size={18} color={t.muted} /></Row>
    </Card>
  );

  return (
    <Page id="fitnessCook" back title={tl('Cosa cucino?')}>
      <TabRow options={['Con quello che ho', 'Scegli un piatto']} value={tab} onChange={setTab} />
      <Row gap={6} style={{ justifyContent: 'flex-start', alignItems: 'center' }}>
        <Body small muted>{tl('Per quante persone')}</Body>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Meno')} hitSlop={8} onPress={() => setServings((n) => Math.max(1, n - 1))}><Icon name="minus" size={22} color={t.text} /></Pressable>
        <Text style={{ color: t.text, fontWeight: '900', fontSize: 18, minWidth: 28, textAlign: 'center' }}>{servings}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={tl('Di più')} hitSlop={8} onPress={() => setServings((n) => Math.min(20, n + 1))}><Icon name="plus" size={22} color={t.text} /></Pressable>
      </Row>

      {tab === 'Con quello che ho' ? (
        items.length ? (
          <>
            <H>{tl('Puoi cucinarli adesso')}</H>
            {can.now.length ? can.now.slice(0, 25).map((x) => row(x.r)) : <Card><Body muted>{tl('Con il frigo di adesso nessun piatto completo. Guarda quelli a cui manca poco.')}</Body></Card>}
            {can.soon.length ? (
              <>
                <H style={{ marginTop: 6 }}>{tl('Manca solo una cosa')}</H>
                {can.soon.slice(0, 20).map((x) => row(x.r, tl('Manca: {0}', x.missing.map((m) => m.name).join(', '))))}
              </>
            ) : null}
          </>
        ) : (
          <Card>
            <Body bold>{tl('Il frigo è vuoto')}</Body>
            <Body small muted style={{ marginTop: 4 }}>{tl('Carica uno scontrino o scrivi cosa hai comprato: poi ti dico cosa puoi cucinare senza fare la spesa.')}</Body>
            <Btn style={{ marginTop: 10 }} small icon="plus" title={tl('Apri il frigo')} onPress={() => go('fitnessFridge')} />
          </Card>
        )
      ) : (
        <>
          <Input value={q} onChangeText={setQ} placeholder={tl('Cerca un piatto (es. risotto, pollo)')} autoCapitalize="none" />
          {found.map((r) => { const s = recipeStatus(r, items, servings); return row(r, items.length ? (s.ok ? tl('Hai tutto') : tl('Mancano {0} ingredienti', s.missing.length)) : undefined); })}
        </>
      )}
      <Body small muted>{NUTRITION_DISCLAIMER}</Body>

      <Sheet visible={!!open} title={open?.name ?? ''} onClose={() => setOpen(null)}>
        {open && st ? (
          <View>
            <H>{tl('Ingredienti per {0}', servings === 1 ? tl('1 porzione') : tl('{0} porzioni', servings))}</H>
            {st.ings.map((i) => (
              <Row key={i.foodId} style={{ paddingVertical: 4 }}>
                <Icon name={i.missing > 0 && !i.staple ? 'x' : 'check'} size={16} color={i.missing > 0 && !i.staple ? t.warn : FIT} stroke={2.6} />
                <View style={{ flex: 1, marginStart: 8 }}><Body>{i.name}</Body>{i.similar ? <Body small muted>{tl('Hai un alimento simile')}</Body> : i.staple ? <Body small muted>{tl('Di solito in casa')}</Body> : null}</View>
                <Text style={{ color: i.missing > 0 && !i.staple ? t.warn : t.muted, fontWeight: '700' }}>{i.need} g{i.missing > 0 && !i.staple ? ` · ${tl('manca')} ${i.missing} g` : ''}</Text>
              </Row>
            ))}
            <H style={{ marginTop: 10 }}>{tl('Come si fa')}</H>
            <Body>{open.method}</Body>
            <Body small muted style={{ marginTop: 6 }}>{tl('Le quantità sono indicative (per porzione) e le ricette sono semplici: adatta tempi e dosi al tuo gusto.')}</Body>
            {st.missing.length ? <Btn style={{ marginTop: 12 }} icon="plus" title={tl('Aggiungi ciò che manca alla spesa')} onPress={toList} /> : null}
            <Btn style={{ marginTop: 8 }} ghost icon="check" title={tl("L'ho cucinato")} onPress={cooked} />
          </View>
        ) : null}
      </Sheet>
    </Page>
  );
}

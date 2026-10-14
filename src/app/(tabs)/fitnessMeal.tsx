import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Card, H, Input, Item, Page, Pill, Progress, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { FOODS, FOOD, dailyTarget, macrosFor, searchFoods, sumMacros, type Body as BodyT, type Food } from '@/lib/fitness/nutrition';
import { matchRecipes, recipeAsFood, type Recipe } from '@/lib/fitness/foodDb';
import { Icon } from '@/lib/icons';
import { pickNetMediaMany, takeNetPhoto } from '@/lib/netMedia';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

const DEFAULT_BODY: BodyT = { sex: 'f', age: 30, weightKg: 65, heightCm: 168, activity: 'media', goal: 'mantenere' };

/** Pasti e calorie: scatti la foto del piatto, scegli cos'è e quanto ne mangi. Il riconoscimento automatico dalla foto non c'è ancora. */
export default function FitnessMeal() {
  const t = useTheme();
  const fit = useFitness();
  const [photo, setPhoto] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [plate, setPlate] = useState<{ food: Food; grams: string }[]>([]);
  const [cookOpen, setCookOpen] = useState(false);
  const [cookQ, setCookQ] = useState('');
  const [cookSel, setCookSel] = useState<Recipe | null>(null);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [body, setBody] = useState<BodyT>(fit.body ?? DEFAULT_BODY);
  const today = fit.meals.filter((m) => new Date(m.ts).toDateString() === new Date().toDateString());
  const sum = sumMacros(today.map((m) => m.macros));
  const target = fit.body ? dailyTarget(fit.body) : null;
  const found = q.trim() ? searchFoods(q, 14) : FOODS.slice(0, 8);
  const gOf = (v: string) => Number(v.replace(',', '.')) || 0;
  const rows = plate.map((x) => ({ ...x, g: gOf(x.grams), m: macrosFor(x.food, gOf(x.grams)) }));
  const preview = rows.length && rows.every((r) => r.g > 0) ? sumMacros(rows.map((r) => r.m)) : null;
  const cooked = cookQ.trim() ? matchRecipes(cookQ) : [];

  const snap = async (camera: boolean) => {
    try {
      if (camera) { const m = await takeNetPhoto(); if (m) setPhoto(m.uri); }
      else { const l = await pickNetMediaMany(1); if (l[0] && l[0].media === 'photo') setPhoto(l[0].uri); }
    } catch (e) { toast(e instanceof Error ? e.message : 'Non riesco ad aprire la fotocamera'); }
  };
  const choose = (f: Food) => { setPlate((p) => [...p, { food: f, grams: String(f.portion) }]); setQ(''); };
  const setG = (i: number, v: string) => setPlate((p) => p.map((x, j) => (j === i ? { ...x, grams: v } : x)));
  const drop = (i: number) => setPlate((p) => p.filter((_, j) => j !== i));
  const add = (name?: string) => {
    if (!preview) { toast('Scegli gli alimenti e i grammi'); return; }
    const total = rows.reduce((a, r) => a + r.g, 0);
    const one = rows.length === 1;
    fit.addMeal({ ts: Date.now(), name: name ?? (one ? rows[0].food.name : rows.map((r) => r.food.name).slice(0, 3).join(', ')), foodId: one ? rows[0].food.id : undefined, grams: Math.round(total), macros: preview, photo: photo ?? undefined, items: rows.map((r) => ({ foodId: r.food.id, name: r.food.name, grams: r.g })) });
    toast(tl('Aggiunto: {0} kcal', preview.kcal)); setPlate([]); setPhoto(null); setQ('');
  };
  const loadRecipe = (r: Recipe) => { setPlate(r.items.flatMap((i) => { const f = FOOD(i.foodId); return f ? [{ food: f, grams: String(i.grams) }] : []; })); setCookOpen(false); setCookSel(null); setCookQ(''); };
  const confirmRecipe = (r: Recipe) => {
    const rows2 = r.items.flatMap((i) => { const f = FOOD(i.foodId); return f ? [{ f, g: i.grams }] : []; });
    const m = sumMacros(rows2.map((x) => macrosFor(x.f, x.g)));
    fit.addMeal({ ts: Date.now(), name: r.name, grams: Math.round(rows2.reduce((a, x) => a + x.g, 0)), macros: m, photo: photo ?? undefined, items: rows2.map((x) => ({ foodId: x.f.id, name: x.f.name, grams: x.g })) });
    toast(tl('Aggiunto: {0} kcal', m.kcal)); setCookOpen(false); setCookSel(null); setCookQ(''); setPhoto(null);
  };
  const num = (k: 'age' | 'weightKg' | 'heightCm', v: string) => setBody({ ...body, [k]: Number(v.replace(',', '.')) || 0 });

  return (
    <Page id="fitnessMeal" back title="Pasti e calorie">
      <Card>
        <Row><H>Oggi</H><Btn small ghost title={target ? 'Obiettivo' : 'Imposta l\'obiettivo'} onPress={() => setBodyOpen(true)} /></Row>
        <Text style={{ color: t.text, fontSize: 30, fontWeight: '900', marginTop: 4 }}>{sum.kcal} <Text style={{ fontSize: 14, color: t.muted }}>{target ? `/ ${target} kcal` : 'kcal'}</Text></Text>
        {target ? <Progress value={Math.min(100, Math.round((sum.kcal / target) * 100))} color={sum.kcal > target ? t.warn : undefined} /> : null}
        <Row style={{ marginTop: 8 }} gap={8}>
          {[['Proteine', sum.p], ['Carboidrati', sum.c], ['Grassi', sum.f]].map(([l, v]) => <View key={String(l)} style={{ flex: 1 }}><Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }}>{v} g</Text><Text style={{ color: t.muted, fontSize: 11.5 }}>{tl(String(l))}</Text></View>)}
        </Row>
      </Card>

      <Card>
        <H>Aggiungi un pasto</H>
        <Row style={{ marginTop: 8 }} gap={8}>
          <Btn small ghost icon="camera" title="Scatta" onPress={() => void snap(true)} />
          <Btn small ghost icon="image" title="Galleria" onPress={() => void snap(false)} />
        </Row>
        {photo ? <Image source={{ uri: photo }} style={{ width: '100%', height: 190, borderRadius: 14, marginTop: 10 }} contentFit="cover" /> : null}
        <Body small muted style={{ marginTop: 8 }}>Dalla foto non riconosco ancora il piatto da solo: per quello servirà l'AI esterna, che non è collegata. Intanto scegli tu cos'è: la foto resta insieme al pasto.</Body>
        <Btn style={{ marginTop: 10 }} ghost icon="note" title="Ho preparato un piatto" onPress={() => setCookOpen(true)} />
        <Input placeholder="Cerca tra oltre 2000 alimenti (es. pasta, pizza, insalata)" value={q} onChangeText={setQ} />
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
          {found.map((f) => <Pill key={f.id} label={f.name} off onPress={() => choose(f)} />)}
        </Row>
        {rows.length ? (
          <View style={{ marginTop: 10 }}>
            <Body bold>Il tuo piatto</Body>
            {rows.map((r, i) => (
              <Row key={i} gap={8} style={{ marginTop: 6 }}>
                <View style={{ flex: 1 }}><Body>{r.food.name}</Body><Body small muted>{r.m.kcal} kcal</Body></View>
                <Input style={{ width: 80 }} keyboardType="numeric" placeholder="g" value={r.grams} onChangeText={(v) => setG(i, v)} />
                <Body muted>g</Body>
                <Pressable accessibilityRole="button" accessibilityLabel={tl('Elimina')} onPress={() => drop(i)} hitSlop={10}><Icon name="trash" size={18} color={t.muted} /></Pressable>
              </Row>
            ))}
            {preview ? <Body bold style={{ marginTop: 8 }}>{preview.kcal} kcal · P {preview.p} g · C {preview.c} g · G {preview.f} g</Body> : null}
            <Btn style={{ marginTop: 8 }} title="Aggiungi al diario" onPress={() => add()} />
          </View>
        ) : null}
      </Card>

      {today.length ? (
        <Card>
          <H>I pasti di oggi</H>
          {today.map((m, i) => (
            <Item key={m.id} last={i === today.length - 1}>
              <Row gap={10}>
                {m.photo ? <Image source={{ uri: m.photo }} style={{ width: 44, height: 44, borderRadius: 10 }} contentFit="cover" /> : null}
                <View style={{ flex: 1 }}><Body bold>{m.name}</Body><Body small muted>{m.grams} g · {m.macros.kcal} kcal</Body></View>
                <Pressable accessibilityRole="button" accessibilityLabel={tl('Elimina')} onPress={() => fit.delMeal(m.id)} hitSlop={10}><Icon name="trash" size={18} color={t.muted} /></Pressable>
              </Row>
            </Item>
          ))}
        </Card>
      ) : null}
      <Body small muted>I valori sono medie indicative e il fabbisogno è una stima: non è un consiglio medico né nutrizionale.</Body>

      <Sheet visible={cookOpen} title="Ho preparato…" onClose={() => { setCookOpen(false); setCookSel(null); }}>
        {cookSel ? (
          <View>
            <H>{cookSel.name}</H>
            <Body small muted style={{ marginTop: 4 }}>Per una porzione, di solito si fa così:</Body>
            {cookSel.items.map((i, k) => <Body key={k}>{FOOD(i.foodId)?.name} · {i.grams} g</Body>)}
            <Body style={{ marginTop: 8 }}>{cookSel.method}</Body>
            <Body bold style={{ marginTop: 10 }}>{(() => { const m = macrosFor(recipeAsFood(cookSel), recipeAsFood(cookSel).portion); return `${m.kcal} kcal · P ${m.p} g · C ${m.c} g · G ${m.f} g`; })()}</Body>
            <Body small muted style={{ marginVertical: 8 }}>È andata così?</Body>
            <Btn title="È proprio così" onPress={() => confirmRecipe(cookSel)} />
            <Btn style={{ marginTop: 8 }} ghost title="L'ho fatto diversamente" onPress={() => loadRecipe(cookSel)} />
          </View>
        ) : (
          <View>
            <Body small muted>Dimmi cosa hai preparato e con cosa, per esempio «un risotto con funghi e burro»: ti dico la ricetta e mi confermi se è davvero così, altrimenti mi racconti come l'hai fatto.</Body>
            <Input placeholder="Es. risotto ai funghi" value={cookQ} onChangeText={setCookQ} />
            {cooked.map((x) => <Item key={x.recipe.id}><Pressable accessibilityRole="button" onPress={() => setCookSel(x.recipe)}><Body bold>{x.recipe.name}</Body><Body small muted>{x.recipe.items.map((i) => FOOD(i.foodId)?.name).slice(0, 5).join(', ')}</Body></Pressable></Item>)}
            {cookQ.trim() && !cooked.length ? <Body small muted style={{ marginTop: 8 }}>Non trovo una ricetta simile. Compone il piatto tu: cerca gli ingredienti e indica i grammi.</Body> : null}
            <Btn style={{ marginTop: 10 }} ghost title="Compongo io il piatto" onPress={() => setCookOpen(false)} />
          </View>
        )}
      </Sheet>

      <Sheet visible={bodyOpen} title="Il tuo obiettivo giornaliero" onClose={() => setBodyOpen(false)}>
        <Row style={{ justifyContent: 'flex-start' }} gap={8}>{(['f', 'm'] as const).map((x) => <Pill key={x} label={x === 'f' ? 'Donna' : 'Uomo'} on={body.sex === x} onPress={() => setBody({ ...body, sex: x })} />)}</Row>
        <Row gap={8} style={{ marginTop: 8 }}>
          <Input style={{ flex: 1 }} keyboardType="numeric" placeholder="Età" value={String(body.age || '')} onChangeText={(v) => num('age', v)} />
          <Input style={{ flex: 1 }} keyboardType="numeric" placeholder="Peso kg" value={String(body.weightKg || '')} onChangeText={(v) => num('weightKg', v)} />
          <Input style={{ flex: 1 }} keyboardType="numeric" placeholder="Altezza cm" value={String(body.heightCm || '')} onChangeText={(v) => num('heightCm', v)} />
        </Row>
        <Body bold style={{ marginTop: 10, marginBottom: 6 }}>Quanto ti muovi</Body>
        <Row style={{ justifyContent: 'flex-start' }} gap={8}>{(['bassa', 'media', 'alta'] as const).map((x) => <Pill key={x} label={x.charAt(0).toUpperCase() + x.slice(1)} on={body.activity === x} onPress={() => setBody({ ...body, activity: x })} />)}</Row>
        <Body bold style={{ marginTop: 10, marginBottom: 6 }}>Obiettivo</Body>
        <Row style={{ justifyContent: 'flex-start' }} gap={8}>{(['dimagrire', 'mantenere', 'massa'] as const).map((x) => <Pill key={x} label={x === 'massa' ? 'Mettere massa' : x.charAt(0).toUpperCase() + x.slice(1)} on={body.goal === x} onPress={() => setBody({ ...body, goal: x })} />)}</Row>
        <Body small muted style={{ marginVertical: 8 }}>{tl('Fabbisogno stimato: {0} kcal al giorno', dailyTarget(body))}</Body>
        <Btn title="Salva" onPress={() => { fit.set({ body }); setBodyOpen(false); }} />
      </Sheet>
    </Page>
  );
}

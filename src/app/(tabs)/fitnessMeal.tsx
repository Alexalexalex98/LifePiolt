import { FIT, MacroBar, Ring } from '@/components/fitness/kit';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Body, Btn, Card, H, Input, Item, Page, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { FOODS, FOOD, dailyTarget, macrosFor, searchFoods, sumMacros, type Body as BodyT, type Food } from '@/lib/fitness/nutrition';
import { matchRecipes, recipeAsFood, type Recipe } from '@/lib/fitness/foodDb';
import { MEAL_PROMPT, parseMealReply, resolveItems, type Resolved } from '@/lib/fitness/mealPhoto';
import { hasAccess } from '@/lib/fitness/premium';
import { routeRequest } from '@/lib/aiRouter';
import { go } from '@/lib/nav';
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
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTs, setEditTs] = useState(0);
  const [report, setReport] = useState<{ found: Resolved[]; note?: string } | null>(null);
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
      let uri: string | null = null;
      if (camera) { const m = await takeNetPhoto(); if (m) uri = m.uri; }
      else { const l = await pickNetMediaMany(1); if (l[0] && l[0].media === 'photo') uri = l[0].uri; }
      if (uri) { setPhoto(uri); setReport(null); if (hasAccess(fit.sub, Date.now())) void analyze(uri); }
    } catch (e) { toast(e instanceof Error ? e.message : 'Non riesco ad aprire la fotocamera'); }
  };
  const premium = hasAccess(fit.sub, Date.now());
  const analyze = async (uriArg?: string) => {
    const uri = uriArg ?? photo;
    if (!uri || busy) return;
    setBusy(true); setReport(null);
    try {
      const res = await routeRequest({ text: MEAL_PROMPT, lang: 'it', source: 'typed', images: [{ uri, mime: 'image/jpeg' }] });
      if (res.status !== 'answered' || !res.text) { setReport({ found: [], note: res.message }); return; }
      const found = resolveItems(parseMealReply(res.text));
      if (!found.length) { setReport({ found: [], note: tl('Non riconosco cibo in questa foto. Prova con più luce o scegli tu gli alimenti.') }); return; }
      setPlate(found.flatMap((x) => (x.food ? [{ food: x.food, grams: String(x.grams) }] : [])));
      setReport({ found });
    } catch { setReport({ found: [], note: tl('Non sono riuscito a contattare il servizio di analisi.') }); }
    finally { setBusy(false); }
  };
  const choose = (f: Food) => { setPlate((p) => [...p, { food: f, grams: String(f.portion) }]); setQ(''); };
  const setG = (i: number, v: string) => setPlate((p) => p.map((x, j) => (j === i ? { ...x, grams: v } : x)));
  const drop = (i: number) => setPlate((p) => p.filter((_, j) => j !== i));
  const add = (name?: string) => {
    if (!preview) { toast('Scegli gli alimenti e i grammi'); return; }
    const total = rows.reduce((a, r) => a + r.g, 0);
    const one = rows.length === 1;
    if (editId) fit.delMeal(editId);
    fit.addMeal({ ts: editId ? editTs : Date.now(), name: name ?? (one ? rows[0].food.name : rows.map((r) => r.food.name).slice(0, 3).join(', ')), foodId: one ? rows[0].food.id : undefined, grams: Math.round(total), macros: preview, photo: photo ?? undefined, items: rows.map((r) => ({ foodId: r.food.id, name: r.food.name, grams: r.g })) });
    toast(editId ? tl('Pasto aggiornato: {0} kcal', preview.kcal) : tl('Aggiunto: {0} kcal', preview.kcal)); setPlate([]); setPhoto(null); setQ(''); setEditId(null); setReport(null);
  };
  const editMeal = (m: (typeof fit.meals)[number]) => {
    const items = m.items?.length ? m.items : m.foodId ? [{ foodId: m.foodId, name: m.name, grams: m.grams }] : [];
    const rowsIn = items.flatMap((i) => { const f = FOOD(i.foodId); return f ? [{ food: f, grams: String(i.grams) }] : []; });
    if (!rowsIn.length) { toast('Questo pasto non si può modificare: eliminalo e rifallo'); return; }
    setPlate(rowsIn); setPhoto(m.photo ?? null); setEditId(m.id); setEditTs(m.ts); setReport(null); toast('Modifica gli alimenti e i grammi, poi salva');
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
      <Card accent={FIT}>
        <Row><H>Oggi</H><Btn small ghost title={target ? 'Obiettivo' : 'Imposta l\'obiettivo'} onPress={() => setBodyOpen(true)} /></Row>
        <Row gap={16} style={{ marginTop: 4 }}>
          <Ring size={112} stroke={12} value={target ? sum.kcal / target : 0} big={String(sum.kcal)} small={target ? `/ ${target} kcal` : 'kcal'} color={target && sum.kcal > target ? t.warn : FIT} />
          <View style={{ flex: 1, gap: 8 }}>
            {(() => { const tot = Math.max(1, sum.p + sum.c + sum.f); return [['Proteine', sum.p, '#6ec9dd'], ['Carboidrati', sum.c, FIT], ['Grassi', sum.f, '#e0c97b']].map(([l, v, c]) => <MacroBar key={String(l)} label={tl(String(l))} grams={Number(v)} color={String(c)} pct={(Number(v) / tot) * 100} />); })()}
          </View>
        </Row>
      </Card>

      <Card>
        <H>Aggiungi un pasto</H>
        <Row style={{ marginTop: 8 }} gap={8}>
          <Btn small ghost icon="camera" title="Scatta" onPress={() => void snap(true)} />
          <Btn small ghost icon="image" title="Galleria" onPress={() => void snap(false)} />
        </Row>
        {photo ? <Image source={{ uri: photo }} style={{ width: '100%', height: 190, borderRadius: 14, marginTop: 10 }} contentFit="cover" /> : null}
        {photo ? (premium
          ? <Btn style={{ marginTop: 10 }} icon="sparkle" title={busy ? 'Analizzo il piatto…' : 'Analizza il piatto'} disabled={busy} onPress={() => void analyze()} />
          : <View style={{ marginTop: 10 }}><Body small muted>Con il LifePass analizzo la foto: ti dico cosa c'è nel piatto e i valori nutrizionali.</Body><Btn style={{ marginTop: 6 }} ghost icon="lock" title="Scopri il LifePass" onPress={() => go('lifefitness')} /></View>) : <Body small muted style={{ marginTop: 8 }}>Scatta o scegli la foto del piatto: con il LifePass lo analizzo e ti faccio il resoconto. In ogni caso puoi comporlo tu qui sotto.</Body>}
        {report ? (
          <View style={{ marginTop: 10 }}>
            <Body bold>Resoconto del piatto</Body>
            {report.note ? <Body small muted style={{ marginTop: 4 }}>{report.note}</Body> : null}
            {report.found.map((x, i) => <Body key={i} small>{x.food ? `${x.name} → ${x.food.name} · ${x.grams} g · ${macrosFor(x.food, x.grams).kcal} kcal` : tl('{0}: non lo trovo nel database, cercalo qui sotto', x.name)}</Body>)}
            {report.found.length && preview ? <Btn style={{ marginTop: 8 }} title="Sì, è corretto: aggiungi al diario" onPress={() => add()} /> : null}
            {report.found.length ? <Body small muted style={{ marginTop: 4 }}>Ho riconosciuto questo dalla foto: è una stima. Se è giusto tocca «Sì, è corretto», altrimenti correggi alimenti e grammi qui sotto.</Body> : null}
          </View>
        ) : null}
        <Btn style={{ marginTop: 10 }} ghost icon="note" title="Ho preparato un piatto" onPress={() => setCookOpen(true)} />
        <Input placeholder="Cerca tra oltre 2000 alimenti (es. pasta, pizza, insalata)" value={q} onChangeText={setQ} />
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
          {found.map((f) => <Pill key={f.id} label={f.name} onPress={() => choose(f)} />)}
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
            <Btn style={{ marginTop: 8 }} title={editId ? 'Salva le modifiche' : 'Aggiungi al diario'} onPress={() => add()} />
            {editId ? <Btn style={{ marginTop: 6 }} ghost title="Annulla la modifica" onPress={() => { setEditId(null); setPlate([]); setPhoto(null); }} /> : null}
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
                <Pressable accessibilityRole="button" accessibilityLabel={tl('Modifica')} onPress={() => editMeal(m)} hitSlop={10}><Icon name="edit" size={18} color={t.muted} /></Pressable>
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
        <Body small muted style={{ marginTop: 6 }}>Servono solo per stimare quante calorie ti servono in un giorno. Restano sul tuo telefono.</Body>
        <Row gap={8} style={{ marginTop: 8, alignItems: 'flex-start' }}>
          {([['age', 'Età', 'anni', body.age], ['weightKg', 'Peso', 'kg', body.weightKg], ['heightCm', 'Altezza', 'cm', body.heightCm]] as const).map(([k, l, u, v]) => (
            <View key={k} style={{ flex: 1 }}>
              <Body bold>{l}</Body>
              <Input keyboardType="numeric" placeholder={u} value={String(v || '')} onChangeText={(x) => num(k, x)} accessibilityLabel={`${l} (${u})`} />
              <Body small muted>{u}</Body>
            </View>
          ))}
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

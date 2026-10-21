import { DaySummary } from '@/components/fitness/DaySummary';
import { dayOf } from '@/lib/fitness/mealInsights';
import { FIT } from '@/components/fitness/kit';
import { Image } from 'expo-image';
import { LogoLoader } from '@/components/LogoLoader';
import { Text } from '@/components/T';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Body, Btn, Card, H, Input, Item, Page, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { AiNote } from '@/components/AiNote';
import { FOODS, FOOD, NUTRITION_DISCLAIMER, dailyTarget, dailyTargets, macrosFor, searchFoods, sumMacros, type Body as BodyT, type Food } from '@/lib/fitness/nutrition';
import { matchRecipes, recipeAsFood, type Recipe } from '@/lib/fitness/foodDb';
import { MEAL_PROMPT, parseMealReply, resolveItems, type Resolved } from '@/lib/fitness/mealPhoto';
import { hasPremiumFeature } from '@/lib/premiumApp';
import { routeRequest } from '@/lib/aiRouter';
import { aiReadFiles, aiServerConfigured, AiServerError } from '@/lib/aiServer';
import { askSend, askSendRouted, logSend } from '@/lib/aiConsent';
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
  const [manualOpen, setManualOpen] = useState(false);
  const [plate, setPlate] = useState<{ food: Food; grams: string; share?: number }[]>([]);
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
  const found = q.trim() ? searchFoods(q, 14) : [];
  const gOf = (v: string) => Number(v.replace(',', '.')) || 0;
  const rows = plate.map((x) => { const g = Math.round(gOf(x.grams) * (x.share ?? 1) * 10) / 10; return { ...x, g, m: macrosFor(x.food, g) }; });
  const preview = rows.length && rows.every((r) => r.g > 0) ? sumMacros(rows.map((r) => r.m)) : null;
  const cooked = cookQ.trim() ? matchRecipes(cookQ) : [];

  const snap = async (camera: boolean) => {
    try {
      let uri: string | null = null;
      if (camera) { const m = await takeNetPhoto(); if (m) uri = m.uri; }
      else { const l = await pickNetMediaMany(1); if (l[0] && l[0].media === 'photo') uri = l[0].uri; }
      if (uri) { setPhoto(uri); setReport(null); if (hasPremiumFeature('meal-photo')) void analyze(uri); }
    } catch (e) { toast(e instanceof Error ? e.message : 'Non riesco ad aprire la fotocamera'); }
  };
  const premium = hasPremiumFeature('meal-photo');
  const analyze = async (uriArg?: string) => {
    const uri = uriArg ?? photo;
    if (!uri || busy) return;
    setBusy(true); setReport(null); if (!editId) setPlate([]);
    try {
      let reply = '';
      if (aiServerConfigured) {
        if (!(await askSend('food'))) { setReport({ found: [], note: tl('Non invio la foto: senza il permesso non posso analizzare il piatto. Puoi comporlo tu qui sotto.') }); return; }
        logSend('food', 0, ['image/jpeg']);
        reply = await aiReadFiles(MEAL_PROMPT, [{ uri, mime: 'image/jpeg' }], 70000);
      }
      else {
        const gate = await askSendRouted('food');
        if (!gate.ok) { setReport({ found: [], note: tl('Non invio la foto: senza il permesso non posso analizzare il piatto. Puoi comporlo tu qui sotto.') }); return; }
        try {
          const res = await routeRequest({ text: MEAL_PROMPT, lang: 'it', source: 'typed', images: [{ uri, mime: 'image/jpeg' }] });
          if (res.status !== 'answered' || !res.text) { setReport({ found: [], note: res.message }); return; }
          reply = res.text;
        } finally { gate.restore(); }
      }
      const found = resolveItems(parseMealReply(reply));
      if (!found.length) { setReport({ found: [], note: tl('Non ho trovato nessun piatto in questa foto. Inquadra il cibo da vicino e con più luce, oppure scegli tu gli alimenti qui sotto.') }); return; }
      setPlate(found.flatMap((x) => (x.food ? [{ food: x.food, grams: String(x.grams) }] : [])));
      setReport({ found });
    } catch (e) { setReport({ found: [], note: e instanceof AiServerError ? e.message : tl('Non sono riuscito a contattare il servizio di analisi.') }); }
    finally { setBusy(false); }
  };
  const choose = (f: Food) => { setPlate((p) => [...p, { food: f, grams: String(f.portion) }]); setQ(''); };
  const setG = (i: number, v: string) => setPlate((p) => p.map((x, j) => (j === i ? { ...x, grams: v } : x)));
  const dup = (i: number) => setPlate((p) => [...p.slice(0, i + 1), { ...p[i] }, ...p.slice(i + 1)]);
  const setShare = (i: number, s: number) => setPlate((p) => p.map((x, j) => (j === i ? { ...x, share: s } : x)));
  const drop = (i: number) => setPlate((p) => p.filter((_, j) => j !== i));
  const add = (name?: string) => {
    if (!preview) { toast('Scegli gli alimenti e i grammi'); return; }
    const total = rows.reduce((a, r) => a + r.g, 0);
    const one = rows.length === 1;
    const aiUsed = rows.filter((r) => r.food.id.startsWith('ai-')).map((r) => r.food);
    if (aiUsed.length) fit.set({ aiFoods: [...aiUsed, ...fit.aiFoods.filter((f) => !aiUsed.some((u) => u.id === f.id))].slice(0, 300) });
    if (editId) fit.delMeal(editId);
    fit.addMeal({ ts: editId ? editTs : Date.now(), name: name ?? (one ? rows[0].food.name : rows.map((r) => r.food.name).slice(0, 3).join(', ')), foodId: one ? rows[0].food.id : undefined, grams: Math.round(total), macros: preview, photo: photo ?? undefined, items: rows.map((r) => ({ foodId: r.food.id, name: r.food.name, grams: r.g })) });
    toast(editId ? tl('Pasto aggiornato: {0} kcal', preview.kcal) : tl('Aggiunto: {0} kcal', preview.kcal)); setPlate([]); setPhoto(null); setQ(''); setEditId(null); setReport(null); setManualOpen(false);
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

  const { edit } = useLocalSearchParams<{ edit?: string }>();
  useEffect(() => {
    if (!edit) return;
    const m = fit.meals.find((x) => x.id === String(edit));
    if (m) editMeal(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit]);
  const cancelEdit = () => { setEditId(null); setPlate([]); setPhoto(null); setQ(''); };
  const editor = rows.length ? (

      <View style={{ marginTop: 10 }}>
        <Body bold>Il tuo piatto</Body>
        {rows.map((r, i) => (
          <View key={i} style={{ marginTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: t.border }}>
            <Row gap={8}>
              <View style={{ flex: 1 }}><Body>{r.food.name}</Body><Body small muted>{r.m.kcal} kcal{(r.share ?? 1) < 1 ? ` · ${tl('la tua parte')}` : ''}</Body></View>
              <Input style={{ width: 80 }} keyboardType="numeric" placeholder="g" value={r.grams} onChangeText={(v) => setG(i, v)} />
              <Body muted>g</Body>
              <Pressable accessibilityRole="button" accessibilityLabel={tl('Duplica')} onPress={() => dup(i)} hitSlop={10}><Icon name="copy" size={18} color={t.muted} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={tl('Elimina')} onPress={() => drop(i)} hitSlop={10}><Icon name="trash" size={18} color={t.muted} /></Pressable>
            </Row>
            <Row gap={6} style={{ marginTop: 6, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              <Body small muted>{tl('Quanto ne hai mangiato?')}</Body>
              {([[1, 'Tutto'], [0.5, '1/2'], [1 / 3, '1/3'], [0.25, '1/4']] as [number, string][]).map(([s, l]) => <Pill key={l} label={l} on={Math.abs((r.share ?? 1) - s) < 0.01} onPress={() => setShare(i, s)} />)}
            </Row>
          </View>
        ))}
        {preview ? <Body bold style={{ marginTop: 8 }}>{preview.kcal} kcal · P {preview.p} g · C {preview.c} g · G {preview.f} g</Body> : null}
        {preview ? <Body small muted style={{ marginTop: 2 }}>{tl('zuccheri {0} g · grassi saturi {1} g · fibre {2} g · sale {3} g', preview.sug ?? 0, preview.sat ?? 0, preview.fib ?? 0, preview.salt ?? 0)} · {tl('stima')}</Body> : null}
        <Btn style={{ marginTop: 8 }} title={editId ? 'Salva le modifiche' : 'Aggiungi al diario'} onPress={() => add()} />
        {editId ? <Btn style={{ marginTop: 6 }} ghost title="Annulla la modifica" onPress={cancelEdit} /> : null}
      </View>
      ) : null;
  const manual = (manualOpen || (!photo && !rows.length)) ? (
    <View style={{ marginTop: 8 }}>
        <Btn style={{ marginTop: 4 }} ghost icon="note" title="Ho preparato un piatto" onPress={() => setCookOpen(true)} />
        <Input placeholder="Cerca tra oltre 2000 alimenti (es. pasta, pizza, insalata)" value={q} onChangeText={setQ} />
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
          {found.map((f) => <Pill key={f.id} label={f.name} onPress={() => choose(f)} />)}
        </Row>
    </View>
  ) : (
    <Btn style={{ marginTop: 12 }} ghost icon="plus" title="Aggiungi o cerca alimenti a mano" onPress={() => setManualOpen(true)} />
  );
  return (
    <Page id="fitnessMeal" back title="Pasti e calorie">
      <Card accent={FIT}>
        <Row><H>Oggi</H><Btn small ghost title={target ? 'Obiettivo' : 'Imposta l\'obiettivo'} onPress={() => setBodyOpen(true)} /></Row>
        <DaySummary meals={today} waterMl={(fit.water ?? {})[dayOf(Date.now())]} body={fit.body} />
        <Btn style={{ marginTop: 10 }} ghost small title="Resoconto di oggi con l'analisi" onPress={() => go('fitnessDay', { day: dayOf(Date.now()) })} />
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
          : <View style={{ marginTop: 10 }}><Body small muted>L'analisi del piatto dalla foto è una funzione Premium di LifePilot.</Body></View>) : <Body small muted style={{ marginTop: 8 }}>Scatta o scegli la foto del piatto: con il Premium di LifePilot lo analizzo e ti faccio il resoconto. In ogni caso puoi comporlo tu qui sotto.</Body>}
        {busy ? <Row gap={10} style={{ marginTop: 10, justifyContent: 'flex-start' }}><LogoLoader size={44} /><Body muted style={{ flex: 1 }}>Sto analizzando il piatto: ci vogliono alcuni secondi.</Body></Row> : null}
        {report ? (
          <View style={{ marginTop: 10 }}>
            <Body bold>Resoconto del piatto</Body>
            {report.note ? <Body small muted={report.found.length > 0} style={{ marginTop: 4 }}>{report.note}</Body> : null}
            {report.found.filter((x) => !x.food).map((x, i) => <Body key={i} small>{tl('{0}: non lo trovo nel database, cercalo qui sotto', x.name)}</Body>)}
            {report.found.some((x) => x.food) ? (() => { const tot = sumMacros(report.found.flatMap((x) => (x.food ? [macrosFor(x.food, x.grams)] : []))); return <><Body bold style={{ marginTop: 4 }}>{tl('Totale stimato: {0} kcal · proteine {1} g · carboidrati {2} g · grassi {3} g', tot.kcal, tot.p, tot.c, tot.f)}</Body><Body small style={{ marginTop: 2 }}>{tl('di cui zuccheri {0} g · grassi saturi {1} g · fibre {2} g · sale {3} g', tot.sug ?? 0, tot.sat ?? 0, tot.fib ?? 0, tot.salt ?? 0)}</Body></>; })() : null}
            <AiNote />
            {report.found.some((x) => x.source === 'ai') ? <Body small muted>I valori con la stima dell'AI sono approssimativi: dipendono dalla porzione che vede nella foto.</Body> : null}
            {report.found.length ? <Body small muted style={{ marginTop: 4 }}>Ho riconosciuto questo dalla foto: è una stima. Qui sotto, in «Il tuo piatto», puoi correggere i grammi, duplicare o togliere un alimento, aggiungerne altri e scegliere quanto ne hai mangiato tu.</Body> : null}
          </View>
        ) : null}
        {!editId ? editor : null}
        {!editId ? manual : null}
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
      <Card accent={FIT} onPress={() => go('fitnessDiary')}>
        <Row><View style={{ flex: 1 }}><H>Storico dei pasti</H><Body small muted>Giorno per giorno, con le foto, l'acqua e l'analisi di Theia su come mangi.</Body></View><Icon name="chevron" size={18} color={t.muted} /></Row>
      </Card>
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

      <Sheet visible={!!editId} title="Modifica il piatto" onClose={cancelEdit}>
        {editor}
        {manual}
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
        {body.age > 0 && body.weightKg > 0 && body.heightCm > 0 ? (() => {
          const g = dailyTargets(body);
          const cell = (label: string, v: string) => <View style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: t.item, borderRadius: 14, padding: 10 }}><Body small muted>{label}</Body><Body bold>{v}</Body></View>;
          return (
            <View style={{ marginTop: 12 }}>
              <View style={{ alignItems: 'center', backgroundColor: t.item, borderRadius: 18, padding: 14 }}>
                <Body small muted>Fabbisogno stimato</Body>
                <Text style={{ color: FIT, fontSize: 38, fontWeight: '800' }}>{g.kcal}</Text>
                <Body small muted>kcal al giorno</Body>
              </View>
              <Row gap={8} style={{ marginTop: 8, flexWrap: 'wrap', alignItems: 'stretch' }}>
                {cell('Proteine', `circa ${g.protein} g`)}{cell('Carboidrati', `circa ${g.carbs} g`)}{cell('Grassi', `circa ${g.fat} g`)}{cell('Fibre', `almeno ${g.fibre} g`)}
                {cell('Zuccheri', `max ${g.sugarMax} g`)}{cell('Grassi saturi', `max ${g.satMax} g`)}{cell('Sale', `max ${g.saltMax} g`)}{cell('Acqua', `circa ${String(g.waterL).replace('.', ',')} litri`)}
              </Row>
            </View>
          );
        })() : <Body small muted style={{ marginVertical: 8 }}>Inserisci età, peso e altezza per vedere il tuo fabbisogno.</Body>}
        <View style={{ marginTop: 12, backgroundColor: t.item, borderRadius: 14, padding: 12, borderLeftWidth: 3, borderLeftColor: t.warn }}>
          <Body small bold>Importante</Body>
          <Body small muted style={{ marginTop: 2 }}>{NUTRITION_DISCLAIMER}</Body>
        </View>
        <Btn style={{ marginTop: 12 }} title="Salva" onPress={() => { fit.set({ body }); setBodyOpen(false); }} />
      </Sheet>
    </Page>
  );
}

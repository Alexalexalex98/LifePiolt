import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Card, H, Input, Item, Page, Pill, Progress, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { FOODS, dailyTarget, macrosFor, searchFoods, sumMacros, type Body as BodyT, type Food } from '@/lib/fitness/nutrition';
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
  const [food, setFood] = useState<Food | null>(null);
  const [grams, setGrams] = useState('');
  const [bodyOpen, setBodyOpen] = useState(false);
  const [body, setBody] = useState<BodyT>(fit.body ?? DEFAULT_BODY);
  const today = fit.meals.filter((m) => new Date(m.ts).toDateString() === new Date().toDateString());
  const sum = sumMacros(today.map((m) => m.macros));
  const target = fit.body ? dailyTarget(fit.body) : null;
  const found = q.trim() ? searchFoods(q) : FOODS.slice(0, 8);
  const g = Number(grams.replace(',', '.')) || 0;
  const preview = food && g > 0 ? macrosFor(food, g) : null;

  const snap = async (camera: boolean) => {
    try {
      if (camera) { const m = await takeNetPhoto(); if (m) setPhoto(m.uri); }
      else { const l = await pickNetMediaMany(1); if (l[0] && l[0].media === 'photo') setPhoto(l[0].uri); }
    } catch (e) { toast(e instanceof Error ? e.message : 'Non riesco ad aprire la fotocamera'); }
  };
  const choose = (f: Food) => { setFood(f); setGrams(String(f.portion)); };
  const add = () => {
    if (!food || !preview) { toast('Scegli un alimento e le quantità'); return; }
    fit.addMeal({ ts: Date.now(), name: food.name, foodId: food.id, grams: g, macros: preview, photo: photo ?? undefined });
    toast(tl('Aggiunto: {0} kcal', preview.kcal)); setFood(null); setGrams(''); setPhoto(null); setQ('');
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
        <Input placeholder="Cerca un alimento (es. pasta, pizza, insalata)" value={q} onChangeText={setQ} />
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
          {found.map((f) => <Pill key={f.id} label={f.name} on={food?.id === f.id} onPress={() => choose(f)} />)}
        </Row>
        {food ? (
          <View style={{ marginTop: 10 }}>
            <Row gap={8}><Input style={{ flex: 1 }} keyboardType="numeric" placeholder="Grammi" value={grams} onChangeText={setGrams} /><Body muted>g</Body></Row>
            <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 6 }} gap={8}>
              {[0.5, 1, 1.5].map((k) => <Pill key={k} label={k === 1 ? 'Porzione' : k < 1 ? 'Mezza' : 'Una e mezza'} off onPress={() => setGrams(String(Math.round(food.portion * k)))} />)}
            </Row>
            {preview ? <Body bold>{preview.kcal} kcal · P {preview.p} g · C {preview.c} g · G {preview.f} g</Body> : null}
            <Btn style={{ marginTop: 8 }} title="Aggiungi al diario" onPress={add} />
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

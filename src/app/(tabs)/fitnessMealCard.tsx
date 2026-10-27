import { Image } from 'expo-image';
import { livePhoto } from '@/lib/driveSave';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { PhotoViewer } from '@/components/PhotoViewer';
import { displayName } from '@/lib/fitness/mealInsights';

import { AiNote } from '@/components/AiNote';
import { RichText } from '@/components/RichText';
import { askSend, logSend } from '@/lib/aiConsent';
import { AiServerError, aiChatRaw, aiServerConfigured } from '@/lib/aiServer';
import { tidy } from '@/lib/aiPersona';
import { toast } from '@/store/toast';

import { FIT } from '@/components/fitness/kit';
import { DaySummary } from '@/components/fitness/DaySummary';
import { Icon } from '@/lib/icons';
import { Body, Btn, Card, H, Item, Page, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { mealAiPrompt, mealOpinion, slotOf } from '@/lib/fitness/mealInsights';
import { microOfMeal } from '@/lib/fitness/mealMicro';
import { NUTRITION_LEGAL, microRows } from '@/lib/fitness/micro';
import { FOOD, dailyTarget, macrosFor } from '@/lib/fitness/nutrition';
import { router } from 'expo-router';
import { go } from '@/lib/nav';
import { useFitness } from '@/store/fitness';

const SLOT: Record<string, string> = { colazione: 'Colazione', pranzo: 'Pranzo', merenda: 'Merenda', cena: 'Cena', notte: 'Dopo cena' };

/** La scheda di un pasto: foto, ingredienti, valori e il parere di Theia. */
export default function FitnessMealCard() {
  const t = useTheme();
  const fit = useFitness();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const m = fit.meals.find((x) => x.id === String(id));
  const [viewer, setViewer] = useState(false);
  const [full, setFull] = useState(false);
  const [ai, setAi] = useState<{ busy: boolean; text?: string; error?: string }>({ busy: false });
  if (!m) return <Page id="fitnessMealCard" back title="Pasto"><Card><Body muted>Questo pasto non c'è più.</Body></Card></Page>;
  const x = m.macros;
  const op = mealOpinion(m, { targetKcal: fit.body ? dailyTarget(fit.body) : undefined, weightKg: fit.body?.weightKg, goal: fit.body?.goal });
  const when = new Date(m.ts).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const items = m.items?.length ? m.items : [{ foodId: m.foodId ?? '', name: m.name, grams: m.grams }];
  return (
    <Page id="fitnessMealCard" back title={displayName(m)}>
      {m.photo ? <Pressable accessibilityRole="button" accessibilityLabel={tl('Apri la foto')} onPress={() => setViewer(true)}><Image source={{ uri: livePhoto(m.photo) }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 18 }} contentFit="cover" cachePolicy="disk" /></Pressable> : null}
      <PhotoViewer uri={viewer ? livePhoto(m.photo) ?? null : null} onClose={() => setViewer(false)} />
      <Card>
        <H>{displayName(m)}</H>
        <Body small muted style={{ textTransform: 'capitalize' }}>{`${tl(SLOT[slotOf(m.ts)])} · ${when}`}</Body>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }} gap={8}>
          <Pill label={`${x.kcal} kcal`} off /><Pill label={`P ${x.p} g`} off /><Pill label={`C ${x.c} g`} off /><Pill label={`G ${x.f} g`} off />
        </Row>
        <Body small muted style={{ marginTop: 10 }}>{tl('zuccheri {0} g · grassi saturi {1} g · fibre {2} g · sale {3} g', x.sug ?? 0, x.sat ?? 0, x.fib ?? 0, x.salt ?? 0)} · {tl('stima')}</Body>
      </Card>
      <Card accent={FIT}>
        <Row><H style={{ flex: 1 }}>Il parere di Theia</H><Pill label={op.verdict === 'ok' ? 'Va bene' : 'Da migliorare'} on={op.verdict === 'ok'} off={op.verdict !== 'ok'} /></Row>
        <Body style={{ marginTop: 6 }}>{op.text}</Body>
        <Body small muted style={{ marginTop: 8 }}>È calcolato sui valori di questo pasto, non su una visita. {NUTRITION_LEGAL}</Body>
      </Card>
      <Card>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: full }} accessibilityLabel={tl('Valori nutrizionali completi del piatto')} onPress={() => setFull((v) => !v)}>
          <Row gap={10}>
            <View style={{ flex: 1 }}><H style={{ marginBottom: 2 }}>Valori nutrizionali completi</H><Body small muted>{full ? 'Solo di questo piatto: macronutrienti, altri valori, vitamine e minerali.' : 'Tocca per aprire: macronutrienti, zuccheri, fibre, sale, vitamine e minerali di questo piatto.'}</Body></View>
            <Icon name="chevron" size={18} color={t.muted} />
          </Row>
        </Pressable>
        {full ? <DaySummary single meals={[m]} micro={microOfMeal(m)} body={fit.body} /> : null}
      </Card>
      <Card>
        <H>Parere più dettagliato dell'AI</H>
        <Body small muted style={{ marginTop: 2 }}>Mando all'AI solo il testo del pasto (ingredienti e valori), senza la foto, e ti rispondo con un parere più ragionato.</Body>
        {ai.text ? <View style={{ marginTop: 10 }}><RichText text={ai.text} color={t.text} accent={t.text} /></View> : null}
        {ai.error ? <Body small style={{ marginTop: 8, color: t.danger }}>{ai.error}</Body> : null}
        {ai.text ? <AiNote /> : null}
        <Btn style={{ marginTop: 10 }} icon="sparkle" ghost={!!ai.text} title={ai.busy ? 'Chiedo all\'AI…' : ai.text ? 'Chiedi di nuovo' : 'Chiedi all\'AI un parere più dettagliato'} disabled={ai.busy} onPress={async () => {
          if (!aiServerConfigured) { setAi({ busy: false, error: 'L\'AI non è collegata in questa app.' }); return; }
          if (!(await askSend('summary', `${m.name} · ${x.kcal} kcal`))) { toast('Non invio niente: senza il tuo permesso non chiedo il parere all\'AI.'); return; }
          setAi({ busy: true });
          try {
            const since = m.ts - 14 * 86400000;
            const recentHighSugar = fit.meals.filter((o) => o.id !== m.id && o.ts >= since && o.ts <= m.ts && (o.macros.sug ?? 0) >= 20).length;
            const prompt = mealAiPrompt(m, items, { targetKcal: fit.body ? dailyTarget(fit.body) : undefined, goal: fit.body?.goal, recentHighSugar });
            logSend('summary', prompt.length, ['testo']);
            setAi({ busy: false, text: tidy(await aiChatRaw(prompt)) });
          } catch (e) { setAi({ busy: false, error: e instanceof AiServerError ? e.message : 'Non sono riuscito a contattare il servizio AI.' }); }
        }} />
      </Card>
      <Card>
        <H>Cosa c'è dentro</H>
        {items.map((it, i) => { const f = FOOD(it.foodId); return <Item key={i} last={i === items.length - 1}><Row><Body style={{ flex: 1 }}>{it.name}</Body><Body small muted>{`${it.grams} g${f ? ` · ${macrosFor(f, it.grams).kcal} kcal` : ''}`}</Body></Row></Item>; })}
      </Card>
      <Btn title="Modifica il pasto" onPress={() => go('fitnessMeal', { edit: m.id })} />
      <Btn ghost style={{ marginTop: 8 }} title="Elimina il pasto" onPress={() => { fit.delMeal(m.id); router.back(); }} />
    </Page>
  );
}

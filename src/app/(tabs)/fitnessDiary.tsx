import { Image } from 'expo-image';
import { livePhoto } from '@/lib/driveSave';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { FIT, Ring } from '@/components/fitness/kit';
import { AiNote } from '@/components/AiNote';
import { RichText } from '@/components/RichText';
import { Body, Btn, Card, H, Item, Page, Pill, Row, Sheet, Switch } from '@/components/ui';
import { deepAnalysisText, fullAnalysisText } from '@/lib/assistant/foodTheia';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { DaySummary } from '@/components/fitness/DaySummary';
import { withMicro } from '@/lib/fitness/mealMicro';
import { NUTRITION_LEGAL } from '@/lib/fitness/micro';
import { WATER_NOTE, WHAT_IF_HIGH, WHAT_IF_HIGH_WARN, WHAT_IF_LOW, WHAT_IF_LOW_WARN, dayKey, waterPeriod, waterVerdict } from '@/lib/fitness/waterInsights';
import { dayOf, displayName, groupByDay, periodStats, quality, slotOf, waterGoal } from '@/lib/fitness/mealInsights';
import { dailyTarget, dailyTargets } from '@/lib/fitness/nutrition';
import { refreshFoodReminders } from '@/lib/foodNotify';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { requestPermission } from '@/lib/notify';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

const dayLabel = (ts: number) => {
  const k = dayOf(ts), now = Date.now();
  if (k === dayOf(now)) return tl('Oggi');
  if (k === dayOf(now - 86400000)) return tl('Ieri');
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
};
const hhmm = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const Bar = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const t = useTheme();
  return <View style={{ height: 8, borderRadius: 4, backgroundColor: t.chip, overflow: 'hidden', marginVertical: 6 }}><View style={{ width: `${Math.min(100, Math.round((value / Math.max(1, max)) * 100))}%`, height: 8, backgroundColor: color }} /></View>;
};
const SLOT: Record<string, string> = { colazione: 'Colazione', pranzo: 'Pranzo', merenda: 'Merenda', cena: 'Cena', notte: 'Dopo cena' };

/** Storico dei pasti giorno per giorno, acqua, promemoria e analisi di Theia su come si mangia. */
export default function FitnessDiary() {
  const t = useTheme();
  const fit = useFitness();
  const [shown, setShown] = useState(10);
  const [period, setPeriod] = useState<7 | 30>(7);
  const [recap, setRecap] = useState(false);
  const [deep, setDeep] = useState<{ busy: boolean; text?: string; ok?: boolean }>({ busy: false });
  const askAi = async () => { setDeep({ busy: true }); const r = await deepAnalysisText(); setDeep({ busy: false, text: r.text, ok: r.ok }); };
  const groups = groupByDay(withMicro(fit.meals));
  const target = fit.body ? dailyTarget(fit.body) : null;
  const st = periodStats(withMicro(fit.meals), fit.water ?? {}, Date.now(), period);
  const tg = fit.body ? dailyTargets(fit.body) : null;
  const q = tg ? quality(st, tg) : null;
  const qCol = q ? (q.level === 'ok' ? '#5fd39a' : q.level === 'attenzione' ? '#ffb020' : t.danger) : FIT;
  const today = dayOf(Date.now());
  const [wDay, setWDay] = useState(today);
  const [whatIf, setWhatIf] = useState<'low' | 'high' | null>(null);
  const wAmount = (fit.water ?? {})[wDay] ?? 0;
  const wDays = Array.from({ length: 7 }, (_, i) => { const ts = Date.now() - i * 86400000; return { key: dayKey(ts), label: i === 0 ? tl('Oggi') : i === 1 ? tl('Ieri') : new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' }) }; });
  const goal = waterGoal(fit.body?.weightKg);
  const wp = waterPeriod(fit.water ?? {}, Date.now(), period, goal);
  const wv = waterVerdict(wp);
  const wCol = !wv ? FIT : wv.level === 'ok' ? '#5fd39a' : wv.level === 'attenzione' ? '#ffb020' : t.danger;
  const w = fit.waterRemind ?? { on: false, everyMin: 120, from: '09:00', to: '21:00' };
  const ev = fit.eveningCheck ?? { on: true, at: '20:45' };

  const setRemind = async (p: Partial<typeof w>) => {
    if ((p.on ?? w.on) || p.everyMin) { const r = await requestPermission(); if (!r.ok) { toast(r.message || 'Per gli avvisi servono le notifiche: attivale in Impostazioni'); return; } }
    fit.setWaterRemind(p);
    await refreshFoodReminders();
  };

  return (
    <Page id="fitnessDiary" back title="Storico dei pasti">
      <Card accent={FIT}>
        <H>Come mangi</H>
        <Body small muted style={{ marginTop: 2 }}>Un parere breve dell'AI e, sotto, l'analisi di Theia su tutti i nutrienti degli ultimi 7 giorni. L'analisi di Theia si fa sul telefono; il parere dell'AI parte solo se consenti.</Body>
        <Btn style={{ marginTop: 10 }} icon="sparkle" title="Approfondimento" onPress={() => { setRecap(true); void askAi(); }} />
      </Card>

      <Card>
        <H>Qualità della tua alimentazione</H>
        <Row style={{ justifyContent: 'flex-start', marginTop: 6 }} gap={8}>{([7, 30] as const).map((d) => <Pill key={d} label={`${d} ${tl('giorni')}`} on={period === d} onPress={() => setPeriod(d)} />)}</Row>
        {q ? (
          <View>
            <Row gap={16} style={{ marginTop: 12 }}>
              <Ring size={104} stroke={11} value={q.score / 100} big={String(q.score)} small="/ 100" color={qCol} />
              <View style={{ flex: 1 }}>
                <Body bold style={{ color: qCol, fontSize: 20 }}>{tl(q.label)}</Body>
                <Body small muted style={{ marginTop: 2 }}>{tl('Calcolata su {0} giorni con pasti registrati.', st.days)}</Body>
              </View>
            </Row>
            <View style={{ marginTop: 12 }}>
              {q.parts.map((p) => {
                const r = p.score / p.max;
                const col = r >= 0.75 ? '#5fd39a' : r >= 0.45 ? '#ffb020' : t.danger;
                return (
                  <View key={p.id} style={{ marginTop: 8 }}>
                    <Row><Body small bold>{tl(p.label)}</Body><Body small style={{ color: col, fontWeight: '800' }}>{`${Math.round(p.score)}/${p.max}`}</Body></Row>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: t.chip, overflow: 'hidden', marginTop: 3 }}><View style={{ width: `${Math.max(3, Math.round(r * 100))}%`, height: 6, backgroundColor: col }} /></View>
                    <Body small muted style={{ marginTop: 2 }}>{p.note}</Body>
                  </View>
                );
              })}
            </View>
            <Body small muted style={{ marginTop: 10 }}>Sono stime, non un dato medico: vitamine e minerali sono calcolati per categoria di alimento.</Body>
          </View>
        ) : <Body small muted style={{ marginTop: 8 }}>{fit.body ? 'Registra qualche pasto per vedere la qualità della tua alimentazione.' : 'Imposta i tuoi dati in «Pasti e calorie» (sesso, età, peso, altezza) per vedere qualità e valori consigliati.'}</Body>}
      </Card>

      {st.days ? (
        <Card>
          <H>Valori medi al giorno</H>
          <Body small muted>{tl('Media degli ultimi {0} giorni (quelli con pasti registrati) rispetto a quanto dovresti mangiare.', period)}</Body>
          <DaySummary meals={[]} avg={st.avg} micro={st.micro} waterMl={st.waterMl} body={fit.body} />
        </Card>
      ) : null}

      <Card accent={FIT}>
        <Row><H style={{ flex: 1 }}>Acqua</H><Body bold>{`${(wAmount / 1000).toFixed(1).replace('.', ',')} / ${(goal / 1000).toFixed(1).replace('.', ',')} L`}</Body></Row>
        <Body small muted style={{ marginTop: 2 }}>Scegli il giorno e segna quanta acqua hai bevuto: puoi sistemare anche i giorni passati.</Body>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 8 }} gap={6}>
          {wDays.map((d) => <Pill key={d.key} label={d.label} on={wDay === d.key} onPress={() => setWDay(d.key)} />)}
        </Row>
        <Bar value={wAmount} max={goal} color={FIT} />
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 8 }} gap={8}>
          {[200, 500, 1000].map((ml) => <Pill key={ml} label={ml === 1000 ? '+ 1 L' : `+ ${ml} ml`} onPress={() => { fit.addWater(ml, wDay); }} />)}
          {wAmount > 0 ? <Pill label="Annulla ultimo" onPress={() => { fit.addWater(-200, wDay); }} /> : null}
        </Row>
        {wAmount > 0 && wAmount < goal ? <Body small muted style={{ marginTop: 6 }}>{tl('Ti mancano ancora {0} per arrivare all\'obiettivo.', `${(Math.max(0, goal - wAmount) / 1000).toFixed(1).replace('.', ',')} L`)}</Body> : null}
        {wAmount >= goal ? <Body small style={{ marginTop: 6, color: '#5fd39a' }}>Obiettivo raggiunto per questo giorno.</Body> : null}

        <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.border }}>
          <Body bold>A che punto sei</Body>
          <Row style={{ justifyContent: 'flex-start', marginTop: 6 }} gap={8}>{([7, 30] as const).map((d) => <Pill key={d} label={`${d} ${tl('giorni')}`} on={period === d} onPress={() => setPeriod(d)} />)}</Row>
          {wv && wp.avgMl !== null ? (
            <View style={{ marginTop: 10 }}>
              <Row><Body bold style={{ color: wCol, fontSize: 18 }}>{tl(wv.title)}</Body><Body bold>{`${Math.round(wp.pct * 100)}%`}</Body></Row>
              <Bar value={wp.avgMl} max={wp.goal} color={wCol} />
              <Body small muted style={{ marginTop: 6 }}>{tl('In media {0} al giorno su {1}: obiettivo raggiunto in {2} giorni su {3} con acqua segnata.', `${(wp.avgMl / 1000).toFixed(1).replace('.', ',')} L`, `${(wp.goal / 1000).toFixed(1).replace('.', ',')} L`, wp.daysAtGoal, wp.loggedDays)}</Body>
              {wp.unloggedDays > 0 ? <Body small muted style={{ marginTop: 2 }}>{tl('{0} giorni senza acqua segnata: non li conto nella media.', wp.unloggedDays)}</Body> : null}
              {wv.advice ? <Body small style={{ marginTop: 6 }}>{tl(wv.advice)}</Body> : null}
            </View>
          ) : <Body small muted style={{ marginTop: 8 }}>Segna l'acqua che bevi: dopo qualche giorno ti dico se ne bevi abbastanza.</Body>}
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }} gap={8}>
            <Pill label="Se ne bevo poca" on={whatIf === 'low'} onPress={() => setWhatIf(whatIf === 'low' ? null : 'low')} />
            <Pill label="Se ne bevo troppa" on={whatIf === 'high'} onPress={() => setWhatIf(whatIf === 'high' ? null : 'high')} />
          </Row>
          {whatIf ? (
            <View style={{ marginTop: 8, gap: 4 }}>
              <Body small bold>{whatIf === 'low' ? 'Cosa può succedere se ne bevi poca' : 'Cosa può succedere se ne bevi troppa'}</Body>
              {(whatIf === 'low' ? WHAT_IF_LOW : WHAT_IF_HIGH).map((x) => <Body key={x} small muted>{`• ${tl(x)}`}</Body>)}
              <Body small style={{ marginTop: 4 }}>{tl(whatIf === 'low' ? WHAT_IF_LOW_WARN : WHAT_IF_HIGH_WARN)}</Body>
            </View>
          ) : null}
          <Body small muted style={{ marginTop: 8 }}>{WATER_NOTE}</Body>
        </View>
        <Row style={{ marginTop: 12 }}><View style={{ flex: 1 }}><Body>Avvisami per bere</Body><Body small muted>{`${tl('Ogni')} ${Math.round(w.everyMin / 60)} ${tl('ore')}, ${w.from}-${w.to}`}</Body></View><Switch value={w.on} onValueChange={(v) => void setRemind({ on: v })} accessibilityLabel="Avvisami per bere" /></Row>
        {w.on ? (
          <Row style={{ justifyContent: 'flex-start', marginTop: 6 }} gap={8}>
            {[1, 2, 3, 4].map((h) => <Pill key={h} label={`${h} h`} on={Math.round(w.everyMin / 60) === h} onPress={() => void setRemind({ everyMin: h * 60 })} />)}
          </Row>
        ) : null}
        <Row style={{ marginTop: 12 }}><View style={{ flex: 1 }}><Body>Banner «hai bevuto?» all'apertura</Body><Body small muted>{`${tl('Se non segni acqua da')} ${Math.round((fit.waterBanner?.afterMin ?? 120) / 60)} ${tl('ore')}`}</Body></View><Switch value={fit.waterBanner?.on ?? true} onValueChange={(v) => fit.setWaterBanner({ on: v })} accessibilityLabel="Banner hai bevuto" /></Row>
        {(fit.waterBanner?.on ?? true) ? (
          <Row style={{ justifyContent: 'flex-start', marginTop: 6 }} gap={8}>
            {[1, 2, 3, 4].map((h) => <Pill key={h} label={`${h} h`} on={Math.round((fit.waterBanner?.afterMin ?? 120) / 60) === h} onPress={() => fit.setWaterBanner({ afterMin: h * 60 })} />)}
          </Row>
        ) : null}
        <Row style={{ marginTop: 12 }}><View style={{ flex: 1 }}><Body>Domanda serale su cibo e acqua</Body><Body small muted>{`${tl('Una notifica verso le')} ${ev.at}`}</Body></View><Switch value={ev.on} onValueChange={async (v) => { if (v) { const r = await requestPermission(); if (!r.ok) { toast(r.message || 'Per la notifica serve il permesso alle notifiche'); return; } } fit.setEveningCheck({ on: v }); await refreshFoodReminders(); }} accessibilityLabel="Domanda serale" /></Row>
      </Card>

      {!groups.length ? <Card><Body muted>Non hai ancora pasti nel diario. Aggiungine uno da «Pasti e calorie»: con una foto lo salvo con tutto.</Body><Btn style={{ marginTop: 10 }} title="Aggiungi un pasto" onPress={() => go('fitnessMeal')} /></Card> : null}

      {groups.slice(0, shown).map((g) => (
        <Card key={g.key}>
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Apri il resoconto del giorno')} onPress={() => go('fitnessDay', { day: g.key })}><Row><H style={{ flex: 1, textTransform: 'capitalize' }}>{dayLabel(g.ts)}</H><Body bold>{g.total.kcal} kcal</Body><Icon name="chevron" size={18} color={t.muted} /></Row></Pressable>
          {target ? <Bar value={g.total.kcal} max={target} color={FIT} /> : null}
          <Body small muted style={{ marginBottom: 4 }}>{tl('proteine {0} g · carboidrati {1} g · grassi {2} g', g.total.p, g.total.c, g.total.f)}{(fit.water ?? {})[g.key] ? ` · ${tl('acqua')} ${(((fit.water ?? {})[g.key]) / 1000).toFixed(1).replace('.', ',')} L` : ''}</Body>
          {g.meals.map((m, i) => (
            <Item key={m.id} last={i === g.meals.length - 1}>
              <Pressable accessibilityRole="button" accessibilityLabel={m.name} onPress={() => go('fitnessMealCard', { id: m.id })}>
                <Row gap={10}>
                  {m.photo ? <Image source={{ uri: livePhoto(m.photo) }} style={{ width: 52, height: 52, borderRadius: 12 }} contentFit="cover" /> : <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}><Icon name="lifefitness" size={22} color={t.muted} /></View>}
                  <View style={{ flex: 1 }}><Body bold numberOfLines={1}>{displayName(m)}</Body><Body small muted>{`${tl(SLOT[slotOf(m.ts)])} · ${hhmm(m.ts)} · ${m.macros.kcal} kcal`}</Body></View>
                  <Icon name="chevron" size={18} color={t.muted} />
                </Row>
              </Pressable>
            </Item>
          ))}
        </Card>
      ))}
      {groups.length > shown ? <Btn ghost title={tl('Mostra altri giorni ({0})', groups.length - shown)} onPress={() => setShown(shown + 10)} /> : null}
      <Body small muted style={{ marginTop: 8 }}>{NUTRITION_LEGAL}</Body>
      <Sheet visible={recap} title="Approfondimento" onClose={() => setRecap(false)}>
        <Body bold>Il parere dell'AI</Body>
        {deep.busy ? <Body small muted style={{ marginTop: 6 }}>Chiedo all'AI…</Body> : deep.text ? <View style={{ marginTop: 6 }}><RichText text={deep.text} color={t.text} accent={t.text} /></View> : <Body small muted style={{ marginTop: 6 }}>Nessun parere ancora.</Body>}
        {deep.ok ? <AiNote /> : null}
        <Btn style={{ marginTop: 10 }} icon="sparkle" ghost disabled={deep.busy} title={deep.busy ? 'Chiedo all\'AI…' : 'Chiedi di nuovo all\'AI'} onPress={() => void askAi()} />
        <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.border }}>
          <Body bold>Analisi di Theia</Body>
          <View style={{ marginTop: 6 }}><RichText text={fullAnalysisText()} color={t.text} accent={t.text} /></View>
        </View>
        <Body small muted style={{ marginTop: 10 }}>{NUTRITION_LEGAL}</Body>
        <Btn style={{ marginTop: 8 }} ghost title="Continua in chat con Theia" onPress={() => { setRecap(false); go('ai', { ask: 'Analizza come mangio' }); }} />
      </Sheet>
    </Page>
  );
}

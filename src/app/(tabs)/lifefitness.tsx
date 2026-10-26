import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { dayOf, displayName } from '@/lib/fitness/mealInsights';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { FIT, FitHero, Ring, StatTile } from '@/components/fitness/kit';
import { QrView } from '@/components/profile/CardFace';
import { Body, Btn, Card, H, Item, Page, Pill, Row, IconSeg, Sheet, Switch, TabRow } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { PARTNER_GYMS, type Goal, type Level, type Place } from '@/lib/fitness/data';
import { ALL_PROGRAMS, NEEDS, programById } from '@/lib/fitness/programsExtra';
import { dayInfo } from '@/lib/fitness/dayPlan';
import { dailyTarget, dailyTargets, sumMacros } from '@/lib/fitness/nutrition';
import { waterGoal } from '@/lib/fitness/mealInsights';
import { recommend, sessionMinutes, stats, weekView, whyThis, type FitProfile } from '@/lib/fitness/plan';
import { PREMIUM_PRICE_LP, daysLeft, passPayload, premiumState } from '@/lib/fitness/premium';
import { TodayCard } from '@/components/fitness/TodayCard';
import { ExerciseBrowser } from '@/components/fitness/ExerciseBrowser';
import { ExercisePicker } from '@/components/fitness/ExercisePicker';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { fmtDate } from '@/lib/when';
import { useApp } from '@/store/app';
import { useBodyCheck } from '@/store/bodyCheck';
import { daysToNextPhotos } from '@/lib/fitness/bodyCheck';
import { useFitness } from '@/store/fitness';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

const GOALS: Goal[] = ['dimagrire', 'tonificare', 'massa', 'forza', 'resistenza', 'mobilità', 'salute'];
const LEVELS: Level[] = ['principiante', 'intermedio', 'avanzato'];
const PLACES: Place[] = ['casa', 'palestra', 'piscina'];
const DAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
/** La pagina è divisa in quattro parti: oggi, allenamenti, cibo e abbonamento/centri. */
const TABS = ['Oggi', 'Allenarsi', 'Cibo', 'LifePass'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** LifeFitness: il personal trainer sempre con te e il LifePass per i centri convenzionati e l'analisi dei pasti. */
export default function LifeFitness() {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const fit = useFitness();
  const net = useNet();
    const [setup, setSetup] = useState(false);
  const [pass, setPass] = useState(false);
  const [tab, setTab] = useState('Oggi');
  const [quick, setQuick] = useState(false);
  /* acquisto del LifePass come un abbonamento: riepilogo, conferma, elaborazione, esito */
  const [buy, setBuy] = useState<'off' | 'ask' | 'busy' | 'done' | 'fail'>('off');
  const [buyMsg, setBuyMsg] = useState('');
  const [lib, setLib] = useState(false);
  const [sub, setSub] = useState('Programmi');
  const [draft, setDraft] = useState<FitProfile>(fit.profile ?? { goal: 'tonificare', level: 'principiante', place: 'casa', days: 3, minutes: 30 });
  /* arrivi da «LifePass» dopo aver letto come funziona: solo ora si apre la conferma */
  const { buy: buyParam } = useLocalSearchParams<{ buy?: string }>();
  useEffect(() => { if (buyParam) { router.setParams({ buy: '' }); setTab('LifePass'); setBuy('ask'); } }, [buyParam]);
  useEffect(() => { fit.settle(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const now = Date.now();
  const state = premiumState(fit.sub, now);
  const active = fit.activeProgram ? programById(fit.activeProgram) ?? null : null;
  const week = active && fit.profile ? weekView(active, fit.profile, fit.history, new Date()) : [];
  const todayIso = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const today = week.find((d) => d.date === new Date(now - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)) ?? week.find((d) => d.date === todayIso);
  const st = stats(fit.history, new Date());
  const recs = fit.profile ? recommend(fit.profile) : [];
  const todayMeals = fit.meals.filter((m) => new Date(m.ts).toDateString() === new Date().toDateString());
  const kcal = sumMacros(todayMeals.map((m) => m.macros)).kcal;
  const target = fit.body ? dailyTarget(fit.body) : null;

  const pick = <K extends keyof FitProfile>(k: K, label: string, options: FitProfile[K][]) => (
    <View style={{ marginBottom: 10 }}>
      <Body bold style={{ marginBottom: 6 }}>{label}</Body>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>{options.map((o) => <Pill key={String(o)} label={typeof o === 'number' ? String(o) : cap(String(o))} on={draft[k] === o} onPress={() => setDraft({ ...draft, [k]: o })} />)}</Row>
    </View>
  );
  const bodyReports = useBodyCheck((s) => s.reports);
  const saveProfile = () => {
    fit.set({ profile: draft, activeProgram: recommend(draft, 1)[0]?.id ?? null });
    setSetup(false); toast('Ho preparato il tuo piano');
  };

  return (
    <Page id="lifefitness" title="LifeFitness">
          <IconSeg value={tab} onChange={setTab} options={[{ id: 'Oggi', icon: 'sun', label: 'Oggi' }, { id: 'Allenarsi', icon: 'lifefitness', label: 'Allenarsi' }, { id: 'Cibo', icon: 'meal', label: 'Cibo' }, { id: 'LifePass', icon: 'award', label: 'LifePass' }]} />

          {tab === 'Oggi' ? (
            <>
          {!fit.profile ? (
            <FitHero eyebrow="Personal trainer" title="Allenati meglio" sub="Obiettivo, livello e luogo: preparo il programma e ti guido sessione dopo sessione, anche senza internet.">
              <Btn title="Crea il tuo piano" onPress={() => setSetup(true)} />
            </FitHero>
          ) : (
            <FitHero eyebrow={active ? active.name : 'Oggi'} title={today?.planned && today.session != null && active ? active.sessions[today.session].name : 'Giorno di recupero'} sub={today?.planned && today.session != null && active ? tl('Circa {0} min', sessionMinutes(active, today.session)) : 'Recuperare fa parte del programma.'}>
              {active && today?.planned && today.session != null ? (
                today.done ? <Body bold color="#1c0b04">Fatto oggi. Bel lavoro.</Body>
                  : <Btn icon="play" title="Inizia l'allenamento" onPress={() => go('fitnessWorkout', { program: active.id, session: String(today.session) })} />
              ) : <Btn ghost title="Cambia il piano" onPress={() => setSetup(true)} />}
            </FitHero>
          )}

          <TodayCard />

          {fit.profile ? (() => {
            const d = daysToNextPhotos(bodyReports[0]?.ts);
            const due = d !== null && d <= 0;
            return (
              <Card accent={FIT} onPress={() => go('fitnessBody')}>
                <Row gap={12}>
                  <Icon name="camera" size={22} color={FIT} />
                  <View style={{ flex: 1 }}>
                    <H style={{ marginBottom: 2 }}>{d === null ? 'Foto del corpo' : due ? 'È ora di nuove foto' : 'Foto del corpo'}</H>
                    <Body small muted>{d === null ? 'Aggiungi 4 foto: l\'AI vede cosa va bene e cosa migliorare con esercizi e alimentazione.' : due ? 'Sono passate 4 settimane: rifai le 4 foto per vedere i tuoi progressi.' : tl('Prossime foto tra {0} giorni, per vedere i progressi.', d)}</Body>
                  </View>
                  <Icon name="chevron" size={18} color={t.muted} />
                </Row>
              </Card>
            );
          })() : null}

          {fit.profile && active ? (
            <Card>
              <Row><H>La tua settimana</H><Btn small ghost title="Cambia" onPress={() => setSetup(true)} /></Row>
              <Row style={{ marginTop: 6, justifyContent: 'space-between' }} gap={4}>
                {week.map((w) => { const d = dayInfo(w.date, { program: active, profile: fit.profile, history: fit.history, plans: fit.plans ?? {}, now: new Date() }); const dw = { ...d, weekday: w.weekday }; const missed = dw.planned && !dw.done && dw.date < todayIso; return (
                  <Pressable key={d.date} accessibilityRole="button" accessibilityLabel={tl('Apri la giornata del {0}', d.date)} onPress={() => go('fitnessPlanDay', { date: d.date })} style={{ flex: 1, alignItems: 'center', gap: 5 }}>
                    <Text style={{ color: d.date === todayIso ? FIT : t.muted, fontSize: 11, fontWeight: '800' }}>{DAYS[dw.weekday]}</Text>
                    <View style={{ width: 34, height: 46, borderRadius: 12, backgroundColor: d.done ? FIT : missed ? t.warn + '26' : d.planned ? FIT + '2e' : t.chip, alignItems: 'center', justifyContent: 'center', borderWidth: d.date === todayIso ? 2 : 0, borderColor: FIT }}>
                      {d.done ? <Icon name="check" size={17} color="#1c0b04" stroke={3} /> : missed ? <Icon name="x" size={17} color={t.warn} stroke={3} /> : d.planned ? <Icon name="lifefitness" size={16} color={FIT} /> : null}
                      {!d.done && (fit.exDone ?? {})[d.date]?.idx.length ? <View style={{ position: 'absolute', bottom: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: FIT }} /> : null}
                    </View>
                  </Pressable>
                ); })}
              </Row>
              <Row style={{ marginTop: 10 }} gap={14}>
                <Row gap={5}><Icon name="check" size={13} color={FIT} stroke={3} /><Body small muted>Fatto</Body></Row>
                <Row gap={5}><Icon name="x" size={13} color={t.warn} stroke={3} /><Body small muted>Non fatto</Body></Row>
              </Row>
              <Row style={{ marginTop: 12 }} gap={8}>
                <Btn small ghost style={{ flex: 1 }} icon="calendar" title="Giorni e allenamenti" onPress={() => go('fitnessPlanDay', { date: todayIso })} />
                <Btn small ghost style={{ flex: 1 }} title="Vedi il programma" onPress={() => go('fitnessProgram', { id: active.id })} />
              </Row>
            </Card>
          ) : null}

          {fit.profile ? (
            <Row gap={10}>
              <StatTile icon="lifefitness" value={st.week} label={tl('questa settimana')} />
              <StatTile icon="sparkle" value={st.streakDays} label={tl('giorni di fila')} />
              <StatTile icon="clock" value={st.minutesWeek} label={tl('minuti')} />
            </Row>
          ) : null}

            </>
          ) : null}

          {tab === 'Allenarsi' ? (
            <>
          <TabRow options={['Programmi', 'Esercizi']} value={sub} onChange={setSub} />
          {sub === 'Esercizi' ? <ExerciseBrowser onCreate={() => setLib(true)} /> : (
            <>
          <H style={{ marginTop: 8 }}>{fit.profile ? 'Programmi per te' : 'Programmi'}</H>
          {(fit.profile ? recs : ALL_PROGRAMS.slice(0, 4)).map((p) => (
            <Card key={p.id} onPress={() => go('fitnessProgram', { id: p.id })}>
              <Row><View style={{ flex: 1 }}><Body bold>{p.name}</Body><Body small muted>{p.tagline}</Body>{fit.profile ? <Body small color={FIT} style={{ marginTop: 3 }}>{whyThis(p, fit.profile)[0]}</Body> : null}</View><Icon name="chevron" size={18} color={t.muted} /></Row>
              <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 8 }} gap={6}>
                <Pill label={cap(p.level)} off /><Pill label={cap(p.place)} off /><Pill label={`${p.days} gg/sett.`} off />{p.specialty ? <Pill label={p.specialty} off /> : null}
              </Row>
            </Card>
          ))}
          <Btn ghost title={tl('Tutte le schede ({0})', ALL_PROGRAMS.length)} onPress={() => go('fitnessProgram', { id: '' })} />
            </>
          )}

          {sub === 'Programmi' ? <Card accent={FIT} onPress={() => go('fitnessGroups')}>
            <Row><View style={{ flex: 1 }}><H>Allenati in gruppo</H><Body small muted>Gruppi gratuiti e a pagamento, ognuno con la sua community. Puoi anche crearne uno.</Body></View><Icon name="chevron" size={18} color={t.muted} /></Row>
          </Card> : null}
            </>
          ) : null}

          {tab === 'Cibo' ? (
            <>
          <Card accent={FIT} onPress={() => go('fitnessMealPlan')}>
            <Row gap={12}><Icon name="lifefitness" size={22} color={FIT} /><View style={{ flex: 1 }}><H style={{ marginBottom: 2 }}>Piano alimentare</H><Body small muted>Un piano su misura che cambi come vuoi, confrontato con ciò che mangi davvero.</Body></View><Icon name="chevron" size={18} color={t.muted} /></Row>
          </Card>
          <Row gap={10}>
            <Card style={{ flex: 1 }} onPress={() => go('fitnessFridge')}><H style={{ marginBottom: 2 }}>Frigo e spesa</H><Body small muted>Scontrino, scorte, lista condivisa</Body></Card>
            <Card style={{ flex: 1 }} onPress={() => go('fitnessCook')}><H style={{ marginBottom: 2 }}>Cosa cucino?</H><Body small muted>Ricette e cosa manca</Body></Card>
          </Row>
          <Card>
            <Pressable accessibilityRole="button" accessibilityLabel={tl('Apri la giornata di oggi')} onPress={() => go('fitnessDay', { day: dayOf(Date.now()) })}>
            <Row gap={14}>
              <Ring value={target ? kcal / target : 0} big={String(kcal)} small={target ? `/ ${target}` : 'kcal'} />
              <View style={{ flex: 1 }}>
                <H style={{ marginBottom: 2 }}>Pasti e calorie</H>
                <Body small muted>{target ? tl('Obiettivo {0} kcal', target) : tl('Imposta il tuo obiettivo')}</Body>
                <Body small muted style={{ marginTop: 4 }}>Oltre 2000 alimenti; con il Premium di LifePilot basta una foto.</Body>
              </View>
              <Icon name="chevron" size={18} color={t.muted} />
            </Row>
            </Pressable>
            <Btn style={{ marginTop: 12 }} icon="camera" title="Aggiungi un pasto" onPress={() => setQuick(true)} />
            {todayMeals.slice(0, 3).map((m) => <Body key={m.id} small muted style={{ marginTop: 4 }}>{displayName(m)} · {m.macros.kcal} kcal</Body>)}
          </Card>

          <Card accent={FIT} onPress={() => go('fitnessDiary')}>
            <Row><View style={{ flex: 1 }}><H>Storico: pasti, acqua e analisi</H><Body small muted>Giorno per giorno, con foto e acqua. Theia ti dice dove sei carente e cosa migliorare.</Body></View><Icon name="chevron" size={18} color={t.muted} /></Row>
          </Card>

            <Sheet visible={quick} title="Aggiungi un pasto" onClose={() => setQuick(false)}>
              <Body small muted>Fai o scegli la foto del piatto: la guardi, e se vuoi la faccio analizzare a Theia.</Body>
              <Btn style={{ marginTop: 12 }} icon="camera" title="Scatta una foto" onPress={() => { setQuick(false); go('fitnessMeal', { start: 'camera' }); }} />
              <Btn style={{ marginTop: 8 }} ghost icon="image" title="Scegli dalla galleria" onPress={() => { setQuick(false); go('fitnessMeal', { start: 'gallery' }); }} />
              <Btn style={{ marginTop: 8 }} ghost title="Compongo il piatto a mano" onPress={() => { setQuick(false); go('fitnessMeal'); }} />
            </Sheet>
            </>
          ) : null}

          {tab === 'LifePass' ? (
            <>
          {state === 'nessuno' || state === 'scaduto' ? (
            <Card accent={FIT}>
              <Pressable onPress={() => go('fitnessPass')} accessibilityRole="button" accessibilityLabel="Apri la pagina LifePass"><Row gap={10}><Icon name="coin" size={30} color={FIT} /><View style={{ flex: 1 }}><H style={{ marginBottom: 0 }}>LifePass</H><Body small muted>{`${PREMIUM_PRICE_LP} LP ${tl('al mese')}`}</Body></View><Icon name="chevron" size={18} color={t.muted} /></Row></Pressable>
              <Body small muted style={{ marginVertical: 8 }}>Un solo pass per entrare in palestre, piscine e centri sportivi convenzionati.</Body>
              {['Accesso a tutti i centri convenzionati: palestre, piscine, centri sportivi', 'Un ingresso al giorno per centro, fino a 2 centri al giorno', 'Pass con codice QR da mostrare all\'ingresso', 'Disdici quando vuoi: resta attivo fino a fine periodo'].map((x) => <Row key={x} style={{ justifyContent: 'flex-start', alignItems: 'flex-start', marginBottom: 6 }} gap={8}><Icon name="check" size={15} color={FIT} stroke={2.6} /><Body small style={{ flex: 1 }}>{x}</Body></Row>)}
              {state === 'scaduto' ? <Body small color={t.warn} style={{ marginTop: 2 }}>Il tuo LifePass è scaduto.</Body> : null}
              <Btn style={{ marginTop: 8 }} title={tl('Attiva il LifePass · {0} LP', PREMIUM_PRICE_LP)} onPress={() => go('fitnessPass')} />
              <Body small muted style={{ marginTop: 6 }}>{tl('Hai {0} LP. Si rinnova da solo ogni 30 giorni, se hai i LifePoints.', net.lifePoints)}</Body>
            </Card>
          ) : (
            <Card accent={FIT}>
              <Pressable onPress={() => go('fitnessPass')} accessibilityRole="button" accessibilityLabel="Apri la pagina LifePass"><Row gap={10}><Icon name="coin" size={30} color={FIT} /><View style={{ flex: 1 }}><H style={{ marginBottom: 0 }}>LifePass attivo</H><Body small muted>{tl('Ancora {0} giorni', daysLeft(fit.sub, now))} · {state === 'attivo' ? 'si rinnova da solo' : 'non si rinnova'}</Body></View><Icon name="chevron" size={18} color={t.muted} /></Row></Pressable>
              <Btn style={{ marginTop: 10 }} icon="lifefitness" title="Mostra il pass d'ingresso" onPress={() => setPass(true)} />
              <Row style={{ marginTop: 10 }}><Body style={{ flex: 1 }}>Rinnovo automatico</Body><Switch value={!!fit.sub?.autoRenew} onValueChange={(v) => fit.setAutoRenew(v)} accessibilityLabel="Rinnovo automatico" /></Row>
            </Card>
          )}

          <Card accent={FIT} onPress={() => go('fitnessGyms')}>
            <Row><View style={{ flex: 1 }}><H>Centri convenzionati</H><Body small muted>{tl('{0} centri: palestre, piscine, centri sportivi', PARTNER_GYMS.length + fit.approved.length)}</Body></View><Icon name="chevron" size={18} color={t.muted} /></Row>
          </Card>
          {fit.visits.length ? (
            <Card>
              <H>I tuoi ingressi</H>
              {fit.visits.slice(0, 5).map((v, i, arr) => { const g = [...PARTNER_GYMS, ...fit.approved].find((x) => x.id === v.gymId); return <Item key={v.id} last={i === arr.length - 1}><Row><Body>{g?.name ?? 'Centro'}</Body><Body small muted>{new Date(v.ts).toLocaleDateString()}</Body></Row></Item>; })}
            </Card>
          ) : null}
          <Card onPress={() => go('fitnessGymRegister')}>
            <Row><View style={{ flex: 1 }}><H>Sei una palestra o un centro sportivo?</H><Body small muted>Registrati gratis e chiedi di entrare nel programma: offri un servizio e ricevi una parte dei ricavi.</Body></View><Icon name="chevron" size={18} color={t.muted} /></Row>
          </Card>
            </>
          ) : null}
      <Body small muted style={{ marginTop: 12 }}>I programmi e le calorie sono indicazioni generali, non sostituiscono il parere di un medico o di un allenatore. Se hai problemi di salute, parlane prima con il tuo medico.</Body>

      <ExercisePicker visible={lib} title="Libreria degli esercizi" onClose={() => setLib(false)} onPick={(e) => { setLib(false); go('fitnessExercise', { id: e.id }); }} />
      <Sheet visible={setup} title="Il tuo piano" onClose={() => setSetup(false)}>
        {pick('goal', 'Obiettivo', GOALS)}
        {pick('level', 'Livello', LEVELS)}
        {pick('place', 'Dove ti alleni', PLACES)}
        {pick('days', 'Giorni a settimana', [2, 3, 4, 5, 6])}
        {pick('minutes', 'Minuti a sessione', [15, 30, 45, 60])}
        <View style={{ marginBottom: 10 }}>
          <Body bold style={{ marginBottom: 2 }}>Cosa ti serve? (facoltativo)</Body>
          <Body small muted style={{ marginBottom: 6 }}>Scegli quello che ti riguarda: preparo una scheda pensata per te, non una scheda per tutti.</Body>
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>
            {NEEDS.map((n) => { const on = (draft.needs ?? []).includes(n.id); return <Pill key={n.id} label={n.label} on={on} onPress={() => setDraft({ ...draft, needs: on ? (draft.needs ?? []).filter((x) => x !== n.id) : [...(draft.needs ?? []), n.id] })} />; })}
          </Row>
        </View>
        <View style={{ marginBottom: 10 }}>
          <Body bold style={{ marginBottom: 2 }}>Foto del corpo (facoltativo)</Body>
          <Body small muted style={{ marginBottom: 6 }}>4 foto (davanti, dietro, lati): l'AI vede cosa va bene e cosa migliorare con esercizi e alimentazione. Poi ti chiedo di rifarle dopo circa 4 settimane per vedere i progressi.</Body>
          <Btn small ghost icon="camera" title={bodyReports.length ? 'Aggiungi nuove foto' : 'Aggiungi le 4 foto'} onPress={() => { saveProfile(); go('fitnessBody'); }} />
        </View>
        <Btn title="Prepara il piano" onPress={saveProfile} />
      </Sheet>
      <Sheet visible={buy !== 'off'} title="Conferma abbonamento" onClose={() => { if (buy !== 'busy') setBuy('off'); }}>
        {buy === 'done' || buy === 'fail' ? (
          <View style={{ alignItems: 'center', paddingVertical: 12, gap: 10 }}>
            <Icon name={buy === 'done' ? 'check' : 'alert'} size={46} color={buy === 'done' ? t.positive : t.danger} stroke={2.2} />
            <H style={{ marginBottom: 0 }}>{buy === 'done' ? 'Abbonamento attivo' : 'Acquisto non riuscito'}</H>
            <Body small muted style={{ textAlign: 'center' }}>{buyMsg}</Body>
            <Btn style={{ alignSelf: 'stretch', marginTop: 6 }} title="Fine" onPress={() => setBuy('off')} />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Row gap={12}><Icon name="coin" size={34} color={FIT} /><View style={{ flex: 1 }}><H style={{ marginBottom: 0 }}>LifePass</H><Body small muted>Abbonamento mensile · centri convenzionati</Body></View></Row>
            <Card>
              <Row><Body muted style={{ flex: 1 }}>Prezzo</Body><Body bold>{`${PREMIUM_PRICE_LP} LP ${tl('al mese')}`}</Body></Row>
              <Row style={{ marginTop: 6 }}><Body muted style={{ flex: 1 }}>Primo rinnovo</Body><Body bold>{fmtDate(Date.now() + 30 * 86400000)}</Body></Row>
              <Row style={{ marginTop: 6 }}><Body muted style={{ flex: 1 }}>Il tuo saldo</Body><Body bold color={net.lifePoints >= PREMIUM_PRICE_LP ? undefined : t.danger}>{`${net.lifePoints} LP`}</Body></Row>
            </Card>
            <Body small muted>Pagamento in LifePoints addebitato ora. L'abbonamento si rinnova da solo ogni 30 giorni, con lo stesso importo, finché non lo disattivi dal LifePass: il rinnovo si può disattivare in qualsiasi momento e il pass resta valido fino a fine periodo.</Body>
            {net.lifePoints < PREMIUM_PRICE_LP ? <Body small color={t.danger}>{tl('Servono {0} LifePoints: ne hai {1}.', PREMIUM_PRICE_LP, net.lifePoints)}</Body> : null}
            <Btn title={buy === 'busy' ? 'Elaborazione in corso…' : tl('Conferma e abbonati · {0} LP', PREMIUM_PRICE_LP)} disabled={buy === 'busy' || net.lifePoints < PREMIUM_PRICE_LP} onPress={() => {
              setBuy('busy');
              setTimeout(() => { const r = fit.subscribe(); setBuyMsg(r.message); setBuy(r.ok ? 'done' : 'fail'); }, 1200);
            }} />
            <Btn ghost title="Annulla" disabled={buy === 'busy'} onPress={() => setBuy('off')} />
          </View>
        )}
      </Sheet>
      <Sheet visible={pass} title="Pass d'ingresso" onClose={() => setPass(false)}>
        {fit.sub ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 16 }}><QrView text={passPayload(me, fit.sub, now)} size={200} color="#111" /></View>
            <Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }}>{me}</Text>
            <Body small muted>{tl('Valido fino al {0}', new Date(fit.sub.renewsAt).toLocaleDateString())}</Body>
            <Body small muted style={{ textAlign: 'center' }}>Mostralo all'ingresso del centro. Il centro controlla che l'abbonamento sia attivo.</Body>
          </View>
        ) : null}
      </Sheet>
    </Page>
  );
}

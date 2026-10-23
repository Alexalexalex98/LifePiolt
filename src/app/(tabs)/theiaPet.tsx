import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseRunner } from '@/components/mascot/ExerciseRunner';
import { Mascot } from '@/components/mascot/Mascot';
import { phaseOf } from '@/components/pet/PetScene';
import { RoomView, type Placed } from '@/components/pet/RoomView';
import { petStats } from '@/hooks/use-pet-stats';
import { HOUSES, ITEMS, KIND_NAME, QUALITY_NAME, ROOMS, houseOf, itemOf, repairCost, wearOf } from '@/lib/petHome';
import { claimable, milestonesOf, sizeFactor, stageOf } from '@/lib/petMilestones';
import { nextInvite, signalsOf } from '@/lib/wellbeing';
import { wellbeingInput } from '@/lib/wellbeingData';
import { usePetHome } from '@/store/petHome';
import { Text } from '@/components/T';
import { Body, Btn, Card, H, Input, Pill, Progress, Row, Sheet, Toggle } from '@/components/ui';
import { earnedForDay, useEarned } from '@/hooks/use-pet-earned';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { KINDS as CK, inviteText, progressOf, progressText, type ChallengeKind } from '@/lib/challenges';
import { Icon } from '@/lib/icons';
import { goBack } from '@/lib/nav';
import { dayKey } from '@/lib/format';
import { EXERCISES, insightsOf, type Exercise } from '@/lib/mindExercises';
import type { Expression, MotionId } from '@/lib/mascot';
import { peoplePool } from '@/lib/network';
import { available, levelProgress, moodOf, publicOf, streakNow, tick, type Kind } from '@/lib/pet';
import { ACCENTS } from '@/lib/themeCustom';
import { useApp } from '@/store/app';
import { useChallenges } from '@/store/challenges';
import { useChat } from '@/store/chat';
import { useMindSpace } from '@/store/mindSpace';
import { newId, topicList, useNet } from '@/store/network';
import { usePet } from '@/store/pet';
import { toast } from '@/store/toast';
import { go } from '@/lib/nav';

const ACTIONS: { k: Kind; title: string; icon: string; earn: string; page: string; expr: Expression; mv: MotionId }[] = [
  { k: 'snack', title: 'Spuntino', icon: 'meal', earn: 'Lo guadagni completando task e segnando i pasti', page: 'lifetask', expr: 'eating', mv: 'bounce' },
  { k: 'water', title: 'Acqua', icon: 'drop', earn: 'La guadagni segnando l\'acqua che bevi', page: 'lifefitness', expr: 'water', mv: 'nod' },
  { k: 'fit', title: 'Energia', icon: 'activity', earn: 'La guadagni facendo un allenamento', page: 'lifefitness', expr: 'workout', mv: 'jump' },
  { k: 'love', title: 'Pensiero', icon: 'heart', earn: 'Lo guadagni segnando come stai', page: 'lifehealth', expr: 'love', mv: 'dance' },
  { k: 'pet', title: 'Coccola', icon: 'smile', earn: 'Poche al giorno, gratis', page: '', expr: 'blushing', mv: 'squish' },
];
type Panel = 'activities' | 'friends' | 'settings' | 'goals' | 'invite' | null;
type View_ = 'theia' | 'home';
const hue = (name: string) => ACCENTS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % ACCENTS.length]!.hex;

function Gauge({ icon, v, color }: { icon: string; v: number; color: string }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#00000040', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 8 }}>
      <Icon name={icon as never} size={16} color="#fff" stroke={2} />
      <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: '#ffffff30', overflow: 'hidden' }}><View style={{ width: `${Math.round(v)}%`, height: 8, backgroundColor: color, borderRadius: 4 }} /></View>
    </View>
  );
}

/** Theia, il gioco: una creatura da accudire e da veder crescere, in un salotto che cambia con l'ora. Cibo e acqua si guadagnano con le cose vere dell'app; se vuoi, giochi con gli amici. */
export default function TheiaPet() {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const me = useApp((s) => s.account.name);
  const { pet, others, refresh, giveTo, rename, setShare, setOthers, visit } = usePet();
  const { earned, day } = useEarned();
  const [mv, setMv] = useState<{ id: MotionId; n: number }>({ id: 'bounce', n: 0 });
  const [temp, setTemp] = useState<Expression | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [name, setName] = useState<string | null>(null);
  const [bubble, setBubble] = useState(true);
  const ch = useChallenges();
  const mind = useMindSpace();
  const [run, setRun] = useState<Exercise | null>(null);
  const [tab, setTab] = useState<'friends' | 'challenges'>('friends');
  const [cs, setCs] = useState<{ with: string; kind: ChallengeKind; target: number; days: number } | null>(null);
  const [upd, setUpd] = useState<{ id: string; n: string } | null>(null);
  const [vis, setVis] = useState<string | null>(null);
  const [vmv, setVmv] = useState<{ id: MotionId; n: number }>({ id: 'bounce', n: 0 });
  const { ex: exParam } = useLocalSearchParams<{ ex?: string }>();
  const home = usePetHome();
  const [view, setView] = useState<View_>('theia');
  const [shopKind, setShopKind] = useState<string | null>(null);
  const inv = useMindSpace((x) => x.inv);
  // la proposta di Theia: solo se i dati mostrano un cambiamento, senza lista in vista e senza insistere
  const invite = useMemo(() => { try { return nextInvite(signalsOf(wellbeingInput()), inv, Date.now()); } catch { return null; } }, [inv.on, inv.lastAny, inv.muted.length]);
  const stats = petStats();
  const pending = claimable(stats, home.claimed);

  useEffect(() => {
    const away = (Date.now() - pet.ts) / 86400000;
    if (away >= 1) { setTemp('happy'); setMv((x) => ({ id: 'bounce', n: x.n + 1 })); setTimeout(() => setTemp(null), 2600); toast('Che bello rivederti!'); }
    refresh(); const h = setInterval(refresh, 60000); return () => clearInterval(h);
  }, [refresh]);
  useEffect(() => {
    if (Object.keys(others).length) return;
    const demo: typeof others = {};
    peoplePool(me).slice(0, 4).forEach((n, i) => { demo[n] = { name: 'Theia', level: 3 + i * 4, streak: 2 + i * 5, expr: i === 1 ? 'proud' : 'happy', label: i === 1 ? 'Sta benissimo' : 'Sta bene', demo: true }; });
    if (Object.keys(demo).length) setOthers(demo);
  }, []);
  useEffect(() => { const e = EXERCISES.find((q) => q.id === exParam); if (e) setRun(e); }, [exParam]);

  const now = tick(pet);
  const mood = moodOf(now);
  const avail = available(now, earned, day);
  const lp = levelProgress(now.xp);
  const streak = streakNow(now, day);
  const phase = phaseOf(new Date().getHours());
  const shown = temp ?? mood.expr;
  const size = Math.round(Math.min(240, (width - 24) * 0.6) * sizeFactor(levelProgress(pet.xp).level));

  const react = (e: Expression, m: MotionId, ms = 1800) => { setTemp(e); setMv((x) => ({ id: m, n: x.n + 1 })); setTimeout(() => setTemp(null), ms); };
  const act = (a: (typeof ACTIONS)[number]) => {
    if (avail[a.k] <= 0) { if (a.page) { toast(`${tl(a.earn)}.`); go(a.page); } else toast('Per oggi basta coccole: tornano domani'); return; }
    const r = giveTo(a.k, earned, day);
    if (!r.ok) return;
    react(a.expr, a.mv); setBubble(false);
    usePetHome.getState().earn(a.k);
    toast(r.leveledUp ? tl('Theia è salita di livello!') : tl('Theia è contenta'));
  };
  const poke = () => { if (avail.pet > 0) giveTo('pet', earned, day); react('blushing', 'squish', 1400); };

  const friends = useMemo(() => Object.entries(others), [others]);
  const peopleList = useMemo(() => peoplePool(me).slice(0, 8), [me]);
  const dm = (to: string, text: string) => { const c = useChat.getState(); c.send(c.ensureDm(to, me), me, { kind: 'text', text }); };
  const mineOn = (kind: ChallengeKind) => (d: string) => earnedForDay(d)[kind];
  const ins = useMemo(() => insightsOf(mind.entries), [mind.entries]);
  const followUp = useMemo(() => { const sch = [...mind.entries].reverse().find((x) => x.ex === 'schedule'); if (!sch || Date.now() - sch.ts < 20 * 3600000) return null; return mind.entries.some((x) => x.ex === 'rate' && x.ts > sch.ts) ? null : sch; }, [mind.entries]);
  const boast = () => {
    const pub = publicOf(now, day);
    const text = `${pub.name} ${tl('è al livello')} ${pub.level}${pub.streak > 1 ? `, ${pub.streak} ${tl('giorni di cura')}` : ''}. ${tl('Theia sta crescendo bene!')}`;
    const net = useNet.getState();
    net.patch({ posts: [{ id: newId(), author: me, text, media: null, tag: topicList[0], likes: 0, ts: Date.now() } as never, ...net.posts] });
    toast('Pubblicato su LifeNetwork');
  };
  const visitDo = (id: MotionId, text?: string) => { setVmv((x) => ({ id, n: x.n + 1 })); if (vis && text) { dm(vis, text); toast('Inviato'); } };
  const openVisit = (n: string) => { setPanel(null); setVis(n); if (visit(n, day)) { usePetHome.getState().earn('visit'); toast('Visita fatta'); } };

  const btn = (round: number, icon: string, label: string, onPress: () => void, badge?: number, dim?: boolean) => (
    <Pressable accessibilityRole="button" accessibilityLabel={tl(label)} onPress={onPress} style={{ alignItems: 'center', width: round + 14 }}>
      <View style={{ width: round, height: round, borderRadius: round / 2, backgroundColor: dim ? '#ffffff30' : th.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#ffffffcc' }}>
        <Icon name={icon as never} size={round * 0.42} color="#fff" stroke={2} />
        {badge ? <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#ff5d73', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{badge}</Text></View> : null}
      </View>
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 4, textShadowColor: '#0008', textShadowRadius: 3 }}>{tl(label)}</Text>
    </Pressable>
  );

  const stage = stageOf(lp.level);
  const placedOf = (room: (typeof ROOMS)[number]['id']): Placed => {
    const out: Placed = {};
    for (const [k, uid] of Object.entries(home.placed[room] ?? {})) { const o = home.owned.find((x) => x.uid === uid); const it = o && itemOf(o.item); if (o && it) out[k as keyof Placed] = { quality: it.quality, wear: wearOf(o, Date.now()) }; }
    return out;
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#12182a' }}>
      {/* in alto: indietro, nome e crescita, stelline, bisogni */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 14, gap: 10 }}>
        <Row gap={8}>
          {btn(40, 'arrow-left', 'Indietro', () => goBack(), undefined, true)}
          <View style={{ flex: 1, backgroundColor: '#ffffff18', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 }}>
            {name === null ? (
              <Pressable onPress={() => setName(pet.name)}><Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }} numberOfLines={1}>{`${pet.name} · ${tl(stage.name)} · ${tl('Livello')} ${lp.level}`}</Text></Pressable>
            ) : <Input value={name} onChangeText={setName} onBlur={() => { rename(name); setName(null); }} onSubmitEditing={() => { rename(name); setName(null); }} autoFocus />}
            <View style={{ height: 7, borderRadius: 4, backgroundColor: '#ffffff30', overflow: 'hidden', marginTop: 4 }}><View style={{ width: `${lp.pct}%`, height: 7, backgroundColor: '#ffd75e' }} /></View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ffffff18', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 }}><Icon name="star" size={15} color="#ffd75e" stroke={2} /><Text style={{ color: '#fff', fontWeight: '800' }}>{home.coins}</Text></View>
        </Row>
        <Row gap={8}>
          <Gauge icon="meal" v={now.food} color="#ffb84f" /><Gauge icon="drop" v={now.water} color="#4fc7e0" /><Gauge icon="heart" v={now.joy} color="#ff6f91" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ffffff18', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 10 }}><Icon name="calendar" size={14} color="#fff" stroke={2} /><Text style={{ color: '#fff', fontWeight: '800' }}>{streak}</Text></View>
        </Row>
      </View>

      {/* la stanza di Theia, come un quadro: Theia dentro, toccala */}
      <View style={{ marginHorizontal: 12, marginTop: 10, borderRadius: 22, overflow: 'hidden', height: view === 'home' ? 230 : Math.min(((width - 24) * 380) / 360, height * 0.48), justifyContent: 'flex-end', alignItems: 'center', paddingBottom: Math.max(6, ((width - 24) / 360) * 58) }}>
        <RoomView room={view === 'home' ? home.room : 'living'} phase={phase} accent={th.accent} placed={placedOf(view === 'home' ? home.room : 'living')} tier={home.tier} />
        <View style={{ position: 'absolute', top: 8, right: 8, gap: 8 }}>
          {btn(38, 'award', 'Traguardi', () => setPanel('goals'), pending.length || undefined, true)}
          {btn(38, 'users', 'Amici', () => setPanel('friends'), undefined, true)}
          {btn(38, 'gear', 'Impostazioni', () => setPanel('settings'), undefined, true)}
        </View>
        {invite && !temp ? (
          <Pressable onPress={() => { setPanel('invite'); useMindSpace.getState().shown(invite.id, Date.now(), dayKey()); }} style={{ backgroundColor: '#ffffffee', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#ff5d73', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '900' }}>!</Text></View>
            <Text style={{ color: '#1a2233', fontWeight: '700' }}>{tl('Theia vuole dirti qualcosa…')}</Text>
          </Pressable>
        ) : bubble && !temp && view === 'theia' ? (
          <Pressable onPress={() => setBubble(false)} style={{ backgroundColor: '#ffffffee', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 14, maxWidth: width * 0.7, marginBottom: 4 }}>
            <Text style={{ color: '#1a2233', fontWeight: '700', textAlign: 'center' }}>{tl(mood.label)}</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={pet.name} onPress={poke}><Mascot size={view === 'home' ? Math.round(size * 0.55) : size} color={th.accent} expression={shown} motion={mv} /></Pressable>
      </View>

      {/* in basso: azioni (Theia) oppure casa e negozio (Casa) */}
      {view === 'theia' ? (
        <View style={{ paddingBottom: 8, gap: 10 }}>
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: 10 }}>
            {ACTIONS.map((a) => <View key={a.k}>{btn(54, a.icon, a.title, () => act(a), avail[a.k] > 0 ? avail[a.k] : undefined, avail[a.k] <= 0)}</View>)}
          </Row>
        </View>
      ) : (
        <ScrollView style={{ flex: 1, backgroundColor: '#12182a', borderTopLeftRadius: 22, borderTopRightRadius: 22 }} contentContainerStyle={{ padding: 14, gap: 10 }}>
          <Row gap={8} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>{houseOf(home).rooms.map((r) => <Pill key={r} label={tl(ROOMS.find((x) => x.id === r)!.name)} on={home.room === r} onPress={() => home.setRoom(r)} />)}</Row>
          {ROOMS.find((r) => r.id === home.room)!.slots.map((k) => {
            const cur = home.placed[home.room]?.[k]; const curO = home.owned.find((o) => o.uid === cur);
            const mine = home.owned.filter((o) => itemOf(o.item)?.kind === k);
            return (
              <View key={k} style={{ backgroundColor: '#1d2540', borderRadius: 16, padding: 12, gap: 6 }}>
                <Row><Body bold style={{ flex: 1 }}>{tl(KIND_NAME[k])}</Body>{curO ? <Body small muted>{`${tl(QUALITY_NAME[itemOf(curO.item)!.quality])} · ${wearOf(curO, Date.now())}% ${tl('usurato')}`}</Body> : <Body small muted>{tl('Vuoto')}</Body>}</Row>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {mine.map((o) => {
                    const it = itemOf(o.item)!; const w = wearOf(o, Date.now()); const inUse = cur === o.uid;
                    return (
                      <View key={o.uid} style={{ width: 150, backgroundColor: inUse ? '#27406b' : '#232d4f', borderRadius: 12, padding: 10, gap: 4 }}>
                        <Body small bold>{tl(QUALITY_NAME[it.quality])}</Body>
                        <Progress value={100 - w} />
                        <Body small muted>{w >= 100 ? tl('Da cambiare') : w >= 70 ? tl('Consumato') : tl('In buono stato')}</Body>
                        <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                          {inUse ? <Btn small ghost title="Togli" onPress={() => home.unplaceItem(home.room, k)} /> : <Btn small title="Usa" onPress={() => { const r = home.placeItem(home.room, o.uid); if (!r.ok) toast(r.reason ?? ''); }} />}
                          {w > 0 ? <Btn small ghost title={`${tl('Ripara')} ${repairCost(it)}`} onPress={() => { const r = home.repairItem(o.uid); toast(r.ok ? 'Riparato' : r.reason ?? ''); }} /> : null}
                          <Btn small ghost danger title={`${tl('Cambia')} +${Math.floor(it.price / 4)}`} onPress={() => { const r = home.sellItem(o.uid); toast(r.ok ? 'Fatto' : r.reason ?? ''); }} />
                        </Row>
                      </View>
                    );
                  })}
                  {([0, 1, 2] as const).map((q) => { const it = ITEMS.find((i) => i.kind === k && i.quality === q)!; return (
                    <View key={it.id} style={{ width: 130, backgroundColor: '#1a2140', borderRadius: 12, padding: 10, gap: 4, borderWidth: 1, borderColor: q === 2 ? '#f2c94c88' : '#2e3a66' }}>
                      <Body small bold>{tl(QUALITY_NAME[q])}</Body>
                      <Body small muted>{`${it.days} ${tl('giorni')}`}</Body>
                      <Btn small title={`${it.price} ★`} onPress={() => { const r = home.buyItem(it.id); if (r.ok && r.uid) { home.placeItem(home.room, r.uid); toast('Comprato'); } else toast(r.reason ?? ''); }} />
                    </View>
                  ); })}
                </ScrollView>
              </View>
            );
          })}
          {HOUSES[home.tier + 1] ? (
            <View style={{ backgroundColor: '#1d2540', borderRadius: 16, padding: 12, gap: 6 }}>
              <Body bold>{`${tl('Cambia casa')}: ${tl(HOUSES[home.tier + 1]!.name)}`}</Body>
              <Body small muted>{`${HOUSES[home.tier + 1]!.rooms.length} ${tl('stanze')} · ${tl('livello')} ${HOUSES[home.tier + 1]!.level} · ${HOUSES[home.tier + 1]!.price} ★`}</Body>
              <Btn small title="Trasloca" onPress={() => { const r = home.upgradeHouse(lp.level); toast(r.ok ? 'Nuova casa!' : r.reason ?? ''); if (r.ok) react('celebrating', 'jump', 2400); }} />
            </View>
          ) : <Body small muted>Hai la casa più grande: l'attico.</Body>}
          <Body small muted>Le stelline arrivano da Theia quando ti prendi cura di te e non si comprano con soldi. I mobili si consumano piano: ripararli o cambiarli è una tua scelta e non cambia come sta Theia.</Body>
        </ScrollView>
      )}

      {/* le due schede del gioco, come nei giochi di cura: Theia e Casa */}
      <View style={{ flexDirection: 'row', margin: 10, marginTop: 4, backgroundColor: '#00000066', borderRadius: 22, padding: 4 }}>
        {([['theia', 'Theia', 'heart'], ['home', 'Casa', 'home']] as const).map(([id, label, icon]) => (
          <Pressable key={id} accessibilityRole="button" onPress={() => setView(id)} style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 18, backgroundColor: view === id ? th.accent : 'transparent' }}>
            <Icon name={icon as never} size={16} color="#fff" stroke={2} /><Text style={{ color: '#fff', fontWeight: '800' }}>{tl(label)}</Text>
          </Pressable>
        ))}
      </View>

      <ExerciseRunner ex={run} onClose={() => setRun(null)} onSave={(answers) => { if (run) { mind.add(run.id, answers); usePet.getState().addXp(4); usePetHome.getState().earn('activity'); toast('Salvato nel diario'); } }} />

      {/* attività insieme: solo se le scegli tu (o se te le propone il gioco) */}
      <Sheet visible={panel === 'activities'} title="Attività insieme a Theia" onClose={() => setPanel(null)}>
        <View style={{ gap: 8 }}>
          <Body small muted>Piccole attività da fare insieme a Theia, quando ti va, per fermarti un momento a capire cosa senti e cosa pensi. Nessuna ti dice cosa fare: scegli tu se e come usarle. Non sono una terapia e non sostituiscono un professionista.</Body>
          {followUp ? <Btn small title={`${tl('Com\'è andata?')} · ${String(followUp.answers.what ?? '')}`} onPress={() => { setPanel(null); setRun(EXERCISES.find((q) => q.id === 'rate')!); }} /> : null}
          {EXERCISES.filter((e) => e.id !== 'rate').map((e) => (
            <Row key={e.id} gap={10} style={{ paddingVertical: 6 }}>
              <View style={{ flex: 1 }}><Body bold>{tl(e.title)}</Body><Body small muted>{`${e.minutes} min · ${tl(e.why)}`}</Body></View>
              <Btn small ghost title="Proviamo" onPress={() => { setPanel(null); setRun(e); }} />
            </Row>
          ))}
          <H>Il vostro diario</H>
          {ins.total > 0 ? <Body small muted>{`${tl('Ultimi 30 giorni')}: ${ins.total} ${tl('attività')}${ins.topEmotions.length ? ` · ${tl('emozioni più nominate')}: ${ins.topEmotions.map((x) => `${tl(x.n)} (${x.c})`).join(', ')}` : ''}${ins.beliefShift ? ` · ${tl('guardando i pensieri da vicino, la fiducia in loro è cambiata in media di')} ${ins.beliefShift.avg > 0 ? '−' : '+'}${Math.abs(ins.beliefShift.avg)} ${tl('punti')}` : ''}.`}</Body> : <Body small muted>Ancora nessuna attività nel diario.</Body>}
          {[...mind.entries].reverse().slice(0, 10).map((x) => {
            const e = EXERCISES.find((q) => q.id === x.ex);
            const t0 = (x.answers.emo as string[] | undefined)?.join(', ') ?? (x.answers.th as string | undefined) ?? (x.answers.a as string | undefined) ?? (x.answers.g1 as string | undefined) ?? (x.answers.what as string | undefined) ?? '';
            return (
              <Row key={x.id} gap={8}>
                <View style={{ flex: 1 }}><Body small bold>{`${new Date(x.ts).toLocaleDateString()} · ${tl(e?.title ?? '')}`}</Body>{t0 ? <Body small muted numberOfLines={2}>{String(t0)}</Body> : null}</View>
                <Btn small ghost danger icon="trash" title="" label="Elimina" onPress={() => mind.remove(x.id)} />
              </Row>
            );
          })}
          <Body small muted>Resta solo sul tuo telefono. Lo esporti o lo cancelli dal Centro Privacy (categoria Salute e umore). Se stai male, parlane con una persona di fiducia: in Svizzera 143, in Europa 112.</Body>
        </View>
      </Sheet>

      {/* amici e sfide */}
      <Sheet visible={panel === 'friends'} title="Amici" onClose={() => setPanel(null)}>
        <View style={{ gap: 8 }}>
          <Row gap={8} style={{ justifyContent: 'flex-start' }}><Pill label={tl('Le Theia degli amici')} on={tab === 'friends'} onPress={() => setTab('friends')} /><Pill label={tl('Sfide insieme')} on={tab === 'challenges'} onPress={() => setTab('challenges')} /></Row>
          {tab === 'friends' ? (
            <>
              <Body small muted>Chi sceglie di mostrare la propria Theia compare qui. Puoi andare a trovarla: le due Theia giocano insieme. Nessuna classifica.</Body>
              {friends.length === 0 ? <Body muted>Ancora nessun amico con la Theia visibile.</Body> : friends.map(([n, p]) => (
                <Row key={n} gap={10} style={{ paddingVertical: 6 }}>
                  <Mascot size={52} color={hue(n)} expression={p.expr} animated={false} />
                  <View style={{ flex: 1 }}><Body bold>{n}</Body><Body small muted>{`${p.name} · ${tl('livello')} ${p.level} · ${p.streak} ${tl('giorni di cura')}${p.demo ? ` · ${tl('esempio')}` : ''}`}</Body></View>
                  <Btn small title="Vai a trovarla" onPress={() => openVisit(n)} />
                </Row>
              ))}
            </>
          ) : (
            <>
              <Body small muted>Si vince insieme: si sommano le cose che fate voi due. Nessuna classifica e nessuna penalità: se non arrivate al traguardo, riprovate con calma.</Body>
              {ch.list.map((c) => {
                const k = CK.find((x) => x.id === c.kind)!; const p = progressOf(c, day, mineOn(c.kind));
                return (
                  <View key={c.id} style={{ gap: 4, marginTop: 6 }}>
                    <Row><Body bold style={{ flex: 1 }}>{`${tl(k.label)} · ${c.withName}`}</Body><Body small muted>{p.state === 'reached' ? tl('Obiettivo raggiunto insieme!') : p.state === 'ended' ? tl('Finita: se vuoi riprovate') : `${p.daysLeft + 1} ${tl('giorni')}`}</Body></Row>
                    <Progress value={p.pct} />
                    <Body small muted>{`${tl('Tu')}: ${p.mine} · ${c.withName}: ${p.friend} · ${tl('insieme')} ${p.total}/${c.target} ${tl(k.unit)}`}</Body>
                    <Row gap={8} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                      <Btn small ghost icon="send" title="Mandagli i miei progressi" onPress={() => { dm(c.withName, progressText(me, c, p)); toast('Inviato'); }} />
                      <Btn small ghost title={`${tl('Cosa ha fatto')} ${c.withName}`} onPress={() => { setPanel(null); setUpd({ id: c.id, n: String(c.friend[day] ?? 0) }); }} />
                      <Btn small ghost danger icon="trash" title="" label="Elimina" onPress={() => ch.remove(c.id)} />
                    </Row>
                  </View>
                );
              })}
              <Btn small ghost style={{ alignSelf: 'flex-start' }} icon="plus" title="Nuova sfida" onPress={() => { setPanel(null); setCs({ with: peopleList[0] ?? '', kind: 'water', target: 14, days: 7 }); }} />
              <Body small muted>I progressi dell'amico arrivano quando anche lui usa LifePilot e ve li scambiate in chat; finché non c'è la rete li scrivi tu dopo averne parlato.</Body>
            </>
          )}
        </View>
      </Sheet>

      {/* una visita: le due Theia insieme */}
      <Sheet visible={!!vis} title={vis ? `${tl('Da')} ${vis}` : ''} onClose={() => { setVis(null); setPanel('friends'); }}>
        {vis ? (
          <View style={{ gap: 10 }}>
            <Row style={{ justifyContent: 'space-evenly', alignItems: 'flex-end' }}>
              <View style={{ alignItems: 'center' }}><Mascot size={120} color={th.accent} expression="happy" motion={vmv} /><Body small muted>{pet.name}</Body></View>
              <View style={{ alignItems: 'center' }}><Mascot size={120} color={hue(vis)} expression={others[vis]?.expr ?? 'happy'} motion={{ id: vmv.id, n: vmv.n }} /><Body small muted>{`${others[vis]?.name ?? 'Theia'} · ${vis}`}</Body></View>
            </Row>
            <Row gap={8} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              <Btn small ghost title="Salutatevi" onPress={() => visitDo('wave')} />
              <Btn small ghost title="Ballate" onPress={() => visitDo('dance')} />
              <Btn small ghost title="Saltate" onPress={() => visitDo('jump')} />
              <Btn small ghost title="Un abbraccio" onPress={() => visitDo('squish', `${me}: ${tl('la mia Theia ha abbracciato la tua!')}`)} />
              <Btn small ghost title="Un regalino" onPress={() => visitDo('bounce', `${me}: ${tl('ti ho lasciato uno spuntino per la tua Theia!')}`)} />
            </Row>
            <Body small muted>Gli abbracci e i regalini arrivano all'amico come messaggio in chat. Se ti va, nessun obbligo di rispondere.</Body>
          </View>
        ) : null}
      </Sheet>


      {/* traguardi: Theia cresce con te */}
      <Sheet visible={panel === 'goals'} title="Traguardi" onClose={() => setPanel(null)}>
        <View style={{ gap: 10 }}>
          <Body small muted>Theia cresce con te: ogni tuo traguardo vero porta a lei dei benefici. Li ritiri quando vuoi e non scadono.</Body>
          {milestonesOf(stats, home.claimed).sort((x, y) => Number(y.done && !y.claimed) - Number(x.done && !x.claimed) || Number(x.claimed) - Number(y.claimed) || y.pct - x.pct).map((m) => (
            <View key={m.id} style={{ gap: 4 }}>
              <Row gap={8}><View style={{ flex: 1 }}><Body bold>{tl(m.title)}</Body><Body small muted>{tl(m.desc)}</Body></View>
                {m.claimed ? <Body small muted>{tl('Ritirato')}</Body> : m.done ? <Btn small title="Ritira" onPress={() => { const r = home.claim(m.id); if (r.ok) { usePet.getState().addXp(r.xp); react('celebrating', 'jump', 2400); toast(`${tl('Theia è felice!')}${m.reward.item ? ` · ${tl('e un mobile in regalo')}` : ''}`); } }} /> : <Body small muted>{`${Math.min(m.value, m.target)}/${m.target}`}</Body>}</Row>
              {!m.done ? <Progress value={m.pct} /> : null}
            </View>
          ))}
        </View>
      </Sheet>

      {/* una proposta di Theia: solo quando i dati mostrano un cambiamento, una cosa su misura, senza insistere */}
      <Sheet visible={panel === 'invite'} title="Theia vuole dirti qualcosa" onClose={() => setPanel(null)}>
        {invite ? (
          <View style={{ gap: 10 }}>
            <Body>{`${tl('Ho notato che')} ${tl(invite.fact)}. ${tl('Non so come stai davvero: se ti va, c\'è una cosa piccola che possiamo fare insieme. Decidi tu.')}`}</Body>
            {invite.exercises.slice(0, 2).map((id) => { const e = EXERCISES.find((q) => q.id === id); return e ? <Btn key={id} title={`${tl(e.title)} · ${e.minutes} min`} onPress={() => { setPanel(null); setRun(e); }} /> : null; })}
            <Row gap={8}>
              <Btn small ghost style={{ flex: 1 }} title="Non adesso" onPress={() => { mind.patchInv({ lastAny: Date.now() }); setPanel(null); }} />
              <Btn small ghost style={{ flex: 1 }} title="Non mostrarmelo più" onPress={() => { mind.patchInv({ muted: [...mind.inv.muted, invite.id] }); setPanel(null); }} />
            </Row>
            <Body small muted>Sono indizi dai tuoi dati sul telefono, non una diagnosi. Se stai male, parlane con una persona di fiducia: in Svizzera 143, in Europa 112.</Body>
          </View>
        ) : <Body muted>Niente da dirti per ora.</Body>}
      </Sheet>

      {/* impostazioni del gioco */}
      <Sheet visible={panel === 'settings'} title="Impostazioni del gioco" onClose={() => setPanel(null)}>
        <View style={{ gap: 8 }}>
          <Toggle label="Mostra la mia Theia nel profilo" value={pet.share} onChange={setShare} hint="Gli altri vedono solo nome, livello, giorni di cura e umore: mai cosa fai o i tuoi dati. Puoi spegnerlo quando vuoi." />
          <Toggle label="Lascia che il gioco mi proponga un'attività quando nota un cambiamento" value={mind.inv.on} onChange={(v) => mind.patchInv({ on: v })} hint="Lo vede solo il telefono, nei tuoi dati: niente esce. Sono indizi, non diagnosi, e ti spiega sempre perché lo vedi. Puoi spegnerlo quando vuoi." />
          <Btn small ghost style={{ alignSelf: 'flex-start' }} icon="send" title="Vantati su LifeNetwork" onPress={boast} />
          <Body small muted>Scrive un post con il livello di Theia e i tuoi giorni di cura. Lo decidi tu: non esce niente senza il tuo tocco.</Body>
          <Btn small ghost style={{ alignSelf: 'flex-start' }} title="Tutte le attività e il diario" onPress={() => setPanel('activities')} />
          <Btn small ghost style={{ alignSelf: 'flex-start' }} icon="palette" title="Colore, espressioni e movimenti" onPress={() => { setPanel(null); go('settings'); }} />
        </View>
      </Sheet>

      <Sheet visible={!!cs} title="Nuova sfida" onClose={() => { setCs(null); setPanel('friends'); setTab('challenges'); }}>
        {cs ? (
          <View style={{ gap: 8 }}>
            <Body small muted>Scegli con chi e cosa fare insieme. Sono cose vere dell'app: acqua, cose fatte, allenamenti.</Body>
            <Body small bold>Con chi</Body>
            <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>{peopleList.map((n) => <Pill key={n} label={n} on={cs.with === n} onPress={() => setCs({ ...cs, with: n })} />)}</Row>
            <Body small bold>Cosa</Body>
            <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>{CK.map((k) => <Pill key={k.id} label={tl(k.label)} on={cs.kind === k.id} onPress={() => setCs({ ...cs, kind: k.id, target: k.presets[0]! })} />)}</Row>
            <Body small bold>Traguardo insieme</Body>
            <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>{CK.find((k) => k.id === cs.kind)!.presets.map((n) => <Pill key={n} label={`${n} ${tl(CK.find((k) => k.id === cs.kind)!.unit)}`} on={cs.target === n} onPress={() => setCs({ ...cs, target: n })} />)}</Row>
            <Body small bold>Quanti giorni</Body>
            <Row gap={6} style={{ justifyContent: 'flex-start' }}>{[3, 7, 14].map((n) => <Pill key={n} label={`${n}`} on={cs.days === n} onPress={() => setCs({ ...cs, days: n })} />)}</Row>
            <Btn title="Invita" disabled={!cs.with} onPress={() => { const c = { withName: cs.with, kind: cs.kind, target: cs.target, startDay: day, days: cs.days }; ch.add(c); dm(cs.with, inviteText(me, c)); setCs(null); setPanel('friends'); setTab('challenges'); toast('Invito mandato in chat'); }} />
          </View>
        ) : null}
      </Sheet>
      <Sheet visible={!!upd} title="Cosa ha fatto oggi" onClose={() => { setUpd(null); setPanel('friends'); setTab('challenges'); }}>
        {upd ? <View style={{ gap: 8 }}>
          <Body small muted>Scrivi quanto ti ha detto che ha fatto oggi (solo per la sfida).</Body>
          <Input value={upd.n} onChangeText={(v) => setUpd({ ...upd, n: v })} keyboardType="numeric" />
          <Btn title="Salva" onPress={() => { ch.setFriend(upd.id, day, Number(upd.n.replace(',', '.')) || 0); setUpd(null); setPanel('friends'); setTab('challenges'); }} />
        </View> : null}
      </Sheet>
    </View>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Mascot } from '@/components/mascot/Mascot';
import { Body, Btn, Card, H, Input, Page, Pill, Progress, Row, Sheet, Toggle } from '@/components/ui';
import { earnedForDay, useEarned } from '@/hooks/use-pet-earned';
import { KINDS as CK, inviteText, progressOf, progressText, type ChallengeKind } from '@/lib/challenges';
import { useChallenges } from '@/store/challenges';
import { useChat } from '@/store/chat';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import type { Expression, MotionId } from '@/lib/mascot';
import { go } from '@/lib/nav';
import { available, levelProgress, moodOf, publicOf, streakNow, tick, type Kind } from '@/lib/pet';
import { peoplePool } from '@/lib/network';
import { useApp } from '@/store/app';
import { newId, topicList, useNet } from '@/store/network';
import { usePet } from '@/store/pet';
import { toast } from '@/store/toast';

const KINDS: { k: Kind; title: string; earn: string; page: string; expr: Expression; mv: MotionId }[] = [
  { k: 'snack', title: 'Spuntino', earn: 'Lo guadagni completando task e segnando i pasti', page: 'lifetask', expr: 'eating', mv: 'bounce' },
  { k: 'water', title: 'Acqua', earn: 'La guadagni segnando l\'acqua che bevi', page: 'lifefitness', expr: 'water', mv: 'nod' },
  { k: 'fit', title: 'Allenamento', earn: 'Lo guadagni facendo un allenamento', page: 'lifefitness', expr: 'workout', mv: 'jump' },
  { k: 'love', title: 'Un pensiero', earn: 'Lo guadagni segnando come stai', page: 'lifehealth', expr: 'love', mv: 'dance' },
  { k: 'pet', title: 'Coccola', earn: 'Poche al giorno, gratis', page: '', expr: 'blushing', mv: 'squish' },
];

/** Theia da accudire: sta bene se ti prendi cura di te. Il cibo si guadagna facendo cose vere; se vuoi, gli altri la vedono e ti sproni a vicenda. */
export default function TheiaPet() {
  const th = useTheme();
  const me = useApp((s) => s.account.name);
  const { pet, others, refresh, giveTo, rename, setShare, setOthers } = usePet();
  const { earned, day } = useEarned();
  const [mv, setMv] = useState<{ id: MotionId; n: number }>({ id: 'bounce', n: 0 });
  const [temp, setTemp] = useState<Expression | null>(null);
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    const away = (Date.now() - pet.ts) / 86400000;
    if (away >= 1) { setTemp('happy'); setMv((x) => ({ id: 'bounce', n: x.n + 1 })); setTimeout(() => setTemp(null), 2600); toast('Che bello rivederti!'); }
    refresh(); const h = setInterval(refresh, 60000); return () => clearInterval(h);
  }, [refresh]);
  // esempi di altri utenti, solo finché non arrivano quelli veri: dichiarati come demo
  useEffect(() => {
    if (Object.keys(others).length) return;
    const demo: typeof others = {};
    peoplePool(me).slice(0, 3).forEach((n, i) => { demo[n] = { name: 'Theia', level: 3 + i * 4, streak: 2 + i * 5, expr: i === 1 ? 'proud' : 'happy', label: i === 1 ? 'Sta benissimo' : 'Sta bene', demo: true }; });
    if (Object.keys(demo).length) setOthers(demo);
  }, []);

  const now = tick(pet);
  const mood = moodOf(now);
  const avail = available(now, earned, day);
  const lp = levelProgress(now.xp);
  const streak = streakNow(now, day);
  const shown = temp ?? mood.expr;
  const bar = (label: string, v: number) => (
    <View style={{ marginTop: 8 }}>
      <Row><Body small bold style={{ flex: 1 }}>{tl(label)}</Body><Body small muted>{Math.round(v)}%</Body></Row>
      <Progress value={Math.round(v)} />
    </View>
  );
  const act = (a: (typeof KINDS)[number]) => {
    if (avail[a.k] <= 0) { if (a.page) { toast(`${tl(a.earn)}.`); go(a.page); } else toast('Per oggi basta coccole: tornano domani'); return; }
    const r = giveTo(a.k, earned, day);
    if (!r.ok) return;
    setTemp(a.expr); setMv((x) => ({ id: a.mv, n: x.n + 1 })); setTimeout(() => setTemp(null), 1800);
    toast(r.leveledUp ? `${tl('Theia è salita di livello!')}` : 'Fatto');
  };
  const boast = () => {
    const pub = publicOf(now, day);
    const text = `${pub.name} ${tl('è al livello')} ${pub.level}${pub.streak > 1 ? `, ${pub.streak} ${tl('giorni di cura')}` : ''}. ${tl('Mi prendo cura di me e lei sta bene!')}`;
    const net = useNet.getState();
    net.patch({ posts: [{ id: newId(), author: me, text, media: null, tag: topicList[0], likes: 0, ts: Date.now() } as never, ...net.posts] });
    toast('Pubblicato su LifeNetwork');
  };
  const others2 = useMemo(() => Object.entries(others), [others]);
  const ch = useChallenges();
  const [cs, setCs] = useState<{ with: string; kind: ChallengeKind; target: number; days: number } | null>(null);
  const [upd, setUpd] = useState<{ id: string; n: string } | null>(null);
  const friends = useMemo(() => peoplePool(me).slice(0, 8), [me]);
  const mineOn = (kind: ChallengeKind) => (d: string) => earnedForDay(d)[kind];
  const dm = (to: string, text: string) => { const c = useChat.getState(); c.send(c.ensureDm(to, me), me, { kind: 'text', text }); };

  return (
    <Page id="theiaPet" back title="Theia da accudire">
      <Body small muted style={{ marginBottom: 8 }}>Theia sta bene se ti prendi cura di te: da mangiare e da bere le guadagni facendo le cose vere dell'app. È un gioco, non un obbligo: se manchi per giorni Theia è tranquilla e contenta di rivederti, e non perde mai nulla.</Body>
      <Card accent={th.accent}>
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Mascot size={190} color={th.accent} expression={shown} motion={mv} />
          {name === null ? <Body bold style={{ marginTop: 6 }} onPress={() => setName(pet.name)}>{pet.name}</Body> : <View style={{ width: 200, marginTop: 6 }}><Input value={name} onChangeText={setName} onBlur={() => { rename(name); setName(null); }} onSubmitEditing={() => { rename(name); setName(null); }} autoFocus /></View>}
          <Body small muted>{tl(mood.label)}</Body>
        </View>
        {bar('Cibo', now.food)}{bar('Acqua', now.water)}{bar('Affetto', now.joy)}
        <Row style={{ marginTop: 12 }}><Body bold style={{ flex: 1 }}>{`${tl('Livello')} ${lp.level}`}</Body><Body small muted>{`${lp.toNext} ${tl('punti al prossimo')}`}</Body></Row>
        <Progress value={lp.pct} />
        <Body small muted style={{ marginTop: 6 }}>{streak > 0 ? `${tl('Giorni di cura')}: ${streak}` : tl('Quando le dai da mangiare e da bere, il giorno si aggiunge ai tuoi giorni di cura.')}</Body>
      </Card>

      <Card>
        <H>Cosa le dai</H>
        <Body small muted style={{ marginTop: 4 }}>I gettoni di oggi si guadagnano con le cose vere: tocca una voce senza gettoni e ti porto dove guadagnarlo.</Body>
        {KINDS.map((a) => (
          <Row key={a.k} style={{ paddingVertical: 8 }}>
            <View style={{ flex: 1 }}><Body bold>{tl(a.title)}</Body><Body small muted>{a.page ? tl(a.earn) : tl(a.earn)}</Body></View>
            <Btn small ghost={avail[a.k] <= 0} title={avail[a.k] > 0 ? `${tl('Dai')} (${avail[a.k]})` : a.page ? tl('Guadagnalo') : tl('Domani')} onPress={() => act(a)} />
          </Row>
        ))}
      </Card>

      <Card>
        <H>Fai vedere Theia agli altri</H>
        <Toggle label="Mostra la mia Theia nel profilo" value={pet.share} onChange={setShare} hint="Gli altri vedono solo nome, livello, giorni di cura e umore: mai cosa fai o i tuoi dati. Puoi spegnerlo quando vuoi." />
        <Btn small ghost style={{ marginTop: 8, alignSelf: 'flex-start' }} icon="send" title="Vantati su LifeNetwork" onPress={boast} />
        <Body small muted style={{ marginTop: 4 }}>Scrive un post con il livello di Theia e i tuoi giorni di cura. Lo decidi tu: non esce niente senza il tuo tocco.</Body>
      </Card>

      <Card>
        <H>Sfide con gli amici</H>
        <Body small muted style={{ marginTop: 4 }}>Si vince insieme: si sommano le cose che fate voi due. Nessuna classifica e nessuna penalità: se non arrivate al traguardo, riprovate con calma.</Body>
        {ch.list.map((c) => {
          const k = CK.find((x) => x.id === c.kind)!; const p = progressOf(c, day, mineOn(c.kind));
          return (
            <View key={c.id} style={{ marginTop: 12, gap: 4 }}>
              <Row><Body bold style={{ flex: 1 }}>{`${tl(k.label)} · ${c.withName}`}</Body><Body small muted>{p.state === 'reached' ? tl('Obiettivo raggiunto insieme!') : p.state === 'ended' ? tl('Finita: se vuoi riprovate') : `${p.daysLeft + 1} ${tl('giorni')}`}</Body></Row>
              <Progress value={p.pct} />
              <Body small muted>{`${tl('Tu')}: ${p.mine} · ${c.withName}: ${p.friend} · ${tl('insieme')} ${p.total}/${c.target} ${tl(k.unit)}`}</Body>
              <Row gap={8} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                <Btn small ghost icon="send" title="Mandagli i miei progressi" onPress={() => { dm(c.withName, progressText(me, c, p)); toast('Inviato'); }} />
                <Btn small ghost title={`${tl('Cosa ha fatto')} ${c.withName}`} onPress={() => setUpd({ id: c.id, n: String(c.friend[day] ?? 0) })} />
                <Btn small ghost danger icon="trash" title="" label="Elimina" onPress={() => ch.remove(c.id)} />
              </Row>
            </View>
          );
        })}
        <Btn small ghost style={{ marginTop: 10, alignSelf: 'flex-start' }} icon="plus" title="Nuova sfida" onPress={() => setCs({ with: friends[0] ?? '', kind: 'water', target: 14, days: 7 })} />
        <Body small muted style={{ marginTop: 6 }}>I progressi dell'amico arrivano quando anche lui usa LifePilot e ve li scambiate in chat; finché non c'è la rete li scrivi tu dopo averne parlato.</Body>
      </Card>

      {others2.length ? (
        <Card>
          <H>La Theia degli altri</H>
          <Body small muted style={{ marginTop: 4 }}>Chi sceglie di mostrarla compare qui. Nessuna classifica: serve solo per ispirarsi e sfidarsi insieme.</Body>
          {others2.map(([n, p]) => (
            <Row key={n} style={{ paddingVertical: 6 }} gap={10}>
              <Mascot size={48} color={th.accent} expression={p.expr} animated={false} />
              <View style={{ flex: 1 }}><Body bold>{n}</Body><Body small muted>{`${p.name} · ${tl('livello')} ${p.level} · ${p.streak} ${tl('giorni di cura')} · ${tl(p.label)}${p.demo ? ` · ${tl('esempio')}` : ''}`}</Body></View>
            </Row>
          ))}
        </Card>
      ) : null}
      <Sheet visible={!!cs} title="Nuova sfida" onClose={() => setCs(null)}>
        {cs ? (
          <View style={{ gap: 8 }}>
            <Body small muted>Scegli con chi e cosa fare insieme. Sono cose vere dell'app: acqua, cose fatte, allenamenti.</Body>
            <Body small bold>Con chi</Body>
            <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>{friends.map((n) => <Pill key={n} label={n} on={cs.with === n} onPress={() => setCs({ ...cs, with: n })} />)}</Row>
            <Body small bold>Cosa</Body>
            <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>{CK.map((k) => <Pill key={k.id} label={tl(k.label)} on={cs.kind === k.id} onPress={() => setCs({ ...cs, kind: k.id, target: k.presets[0]! })} />)}</Row>
            <Body small bold>Traguardo insieme</Body>
            <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>{CK.find((k) => k.id === cs.kind)!.presets.map((n) => <Pill key={n} label={`${n} ${tl(CK.find((k) => k.id === cs.kind)!.unit)}`} on={cs.target === n} onPress={() => setCs({ ...cs, target: n })} />)}</Row>
            <Body small bold>Quanti giorni</Body>
            <Row gap={6} style={{ justifyContent: 'flex-start' }}>{[3, 7, 14].map((n) => <Pill key={n} label={`${n}`} on={cs.days === n} onPress={() => setCs({ ...cs, days: n })} />)}</Row>
            <Btn title="Invita" disabled={!cs.with} onPress={() => { const c = { withName: cs.with, kind: cs.kind, target: cs.target, startDay: day, days: cs.days }; ch.add(c); dm(cs.with, inviteText(me, c)); setCs(null); toast('Invito mandato in chat'); }} />
          </View>
        ) : null}
      </Sheet>
      <Sheet visible={!!upd} title="Cosa ha fatto oggi" onClose={() => setUpd(null)}>
        {upd ? <View style={{ gap: 8 }}>
          <Body small muted>Scrivi quanto ti ha detto che ha fatto oggi (solo per la sfida).</Body>
          <Input value={upd.n} onChangeText={(v) => setUpd({ ...upd, n: v })} keyboardType="numeric" />
          <Btn title="Salva" onPress={() => { ch.setFriend(upd.id, day, Number(upd.n.replace(',', '.')) || 0); setUpd(null); }} />
        </View> : null}
      </Sheet>
    </Page>
  );
}

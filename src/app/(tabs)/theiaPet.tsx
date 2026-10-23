import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Mascot } from '@/components/mascot/Mascot';
import { Body, Btn, Card, H, Input, Page, Progress, Row, Toggle } from '@/components/ui';
import { useEarned } from '@/hooks/use-pet-earned';
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
  useEffect(() => { refresh(); const h = setInterval(refresh, 60000); return () => clearInterval(h); }, [refresh]);
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
    const text = `${pub.name} ${tl('è al livello')} ${pub.level}${pub.streak > 1 ? `, ${pub.streak} ${tl('giorni di fila di cure')}` : ''}. ${tl('Mi prendo cura di me e lei sta bene!')}`;
    const net = useNet.getState();
    net.patch({ posts: [{ id: newId(), author: me, text, media: null, tag: topicList[0], likes: 0, ts: Date.now() } as never, ...net.posts] });
    toast('Pubblicato su LifeNetwork');
  };
  const others2 = useMemo(() => Object.entries(others), [others]);

  return (
    <Page id="theiaPet" back title="Theia da accudire">
      <Body small muted style={{ marginBottom: 8 }}>Theia sta bene se ti prendi cura di te: da mangiare e da bere le guadagni facendo le cose vere dell'app. Niente punizioni: se la trascuri è solo triste.</Body>
      <Card accent={th.accent}>
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Mascot size={190} color={th.accent} expression={shown} motion={mv} />
          {name === null ? <Body bold style={{ marginTop: 6 }} onPress={() => setName(pet.name)}>{pet.name}</Body> : <View style={{ width: 200, marginTop: 6 }}><Input value={name} onChangeText={setName} onBlur={() => { rename(name); setName(null); }} onSubmitEditing={() => { rename(name); setName(null); }} autoFocus /></View>}
          <Body small muted>{tl(mood.label)}</Body>
        </View>
        {bar('Cibo', now.food)}{bar('Acqua', now.water)}{bar('Affetto', now.joy)}
        <Row style={{ marginTop: 12 }}><Body bold style={{ flex: 1 }}>{`${tl('Livello')} ${lp.level}`}</Body><Body small muted>{`${lp.toNext} ${tl('punti al prossimo')}`}</Body></Row>
        <Progress value={lp.pct} />
        <Body small muted style={{ marginTop: 6 }}>{streak > 0 ? `${tl('Serie')}: ${streak} ${streak === 1 ? tl('giorno') : tl('giorni')}` : tl('Dai da mangiare e da bere a Theia oggi per iniziare una serie.')}</Body>
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
        <Toggle label="Mostra la mia Theia nel profilo" value={pet.share} onChange={setShare} hint="Gli altri vedono solo nome, livello, serie di giorni e umore: mai cosa fai o i tuoi dati. Puoi spegnerlo quando vuoi." />
        <Btn small ghost style={{ marginTop: 8, alignSelf: 'flex-start' }} icon="send" title="Vantati su LifeNetwork" onPress={boast} />
        <Body small muted style={{ marginTop: 4 }}>Scrive un post con il livello di Theia e la tua serie. Lo decidi tu: non esce niente senza il tuo tocco.</Body>
      </Card>

      {others2.length ? (
        <Card>
          <H>La Theia degli altri</H>
          <Body small muted style={{ marginTop: 4 }}>Chi sceglie di mostrarla compare qui. Fatti ispirare, o sfidali a restare in serie.</Body>
          {others2.map(([n, p]) => (
            <Row key={n} style={{ paddingVertical: 6 }} gap={10}>
              <Mascot size={48} color={th.accent} expression={p.expr} animated={false} />
              <View style={{ flex: 1 }}><Body bold>{n}</Body><Body small muted>{`${p.name} · ${tl('livello')} ${p.level} · ${p.streak} ${tl('giorni di serie')} · ${tl(p.label)}${p.demo ? ` · ${tl('esempio')}` : ''}`}</Body></View>
            </Row>
          ))}
        </Card>
      ) : null}
    </Page>
  );
}

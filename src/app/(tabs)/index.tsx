import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { LifeScoreSheet } from '@/components/scoreSheet';
import { PlanDaySheet } from '@/components/plan';
import { Bars, Flame, Spark } from '@/components/charts';
import { Body, Btn, Card, Empty, H, Item, Metric, Page, Progress, Row, SectionLabel, Sheet, Tag } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { dayKey, formatCHF, shortDate } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { notePreview, noteTitle } from '@/lib/notes';
import { computeScores } from '@/lib/scores';
import { useApp } from '@/store/app';
import { monthEnd, monthNet, holdings, useFin } from '@/store/finance';
import { last, moodOptions, streakOf, useHealth } from '@/store/health';
import { taskIsDone, useLife } from '@/store/life';
import { toast } from '@/store/toast';
import { LpTag, UserAvatar } from '@/components/network';
import { donationStreak, followerCountFor } from '@/lib/network';
import { useNet } from '@/store/network';
import { weekdayShortDate } from '@/lib/format';

const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

export default function Home() {
  const t = useTheme();
  const name = useApp((s) => s.account.name);
  const life = useLife();
  const health = useHealth();
  const fin = useFin();
  const [scoreSheet, setScoreSheet] = useState(false);
  const [planSheet, setPlanSheet] = useState(false);
  const [insight, setInsight] = useState(false);
  const ns = useNet();
  const demo = useApp((a) => a.demo);
  const lpStreak = donationStreak();
  const donatedToday = ns.dailyPoint.lastGiven === weekdayShortDate();
  const topIdea = ns.ideas.slice().sort((a, b) => b.raised / (b.target || 500) - a.raised / (a.target || 500))[0];
  const topPct = topIdea ? Math.round((topIdea.raised / (topIdea.target || 500)) * 100) : 0;
  const topPosts = [
    ...ns.posts.filter((p) => !ns.mutedAuthors.includes(p.author) && !(p.tag && ns.mutedTopics.includes(p.tag))).map((p) => ({ author: p.author, text: p.text, likes: p.likes })),
    ...ns.communities.filter((c) => c.members.includes(name)).flatMap((c) => c.posts.filter((p) => !ns.mutedAuthors.includes(p.author)).map((p) => ({ author: p.author, text: p.text, likes: p.likes }))),
  ].sort((a, b) => (ns.following.includes(b.author) ? 1 : 0) - (ns.following.includes(a.author) ? 1 : 0) || b.likes - a.likes).slice(0, 3);

  const now = new Date();
  const h = now.getHours();
  const greet = h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const sc = computeScores();

  const todayEvents = (life.events[dayKey()] || []).slice().sort((a, b) => a.time.localeCompare(b.time));
  const activeCount = life.tasks.filter((x) => !taskIsDone(x)).length;
  const doneCount = life.tasks.length - activeCount;
  const lateGoals = life.goals.filter((g) => g.p < 50).length;
  const topGoal = life.goals.slice().sort((a, b) => b.p - a.p)[0];

  const sleep = last(health.series.sleep), steps = last(health.series.steps);
  const stepsStreak = streakOf(health.series.steps, (v) => v >= 10000);
  const sleepStreak = streakOf(health.series.sleep, (v) => v >= 7);
  const moodToday = health.moods[0]?.date === shortDate();

  const cur = fin.months[0];
  const net = cur ? monthNet(cur) : 0;
  const endsChrono = fin.months.slice().reverse().map(monthEnd);
  const topCat = fin.categories.slice().sort((a, b) => b.p - a.p)[0];
  const hold = holdings(fin.stocks);
  const invested = hold.reduce((s, x) => s + x.shares * x.avgCost, 0);
  const value = hold.reduce((s, x) => s + x.shares * x.price, 0);
  const plPct = invested ? ((value - invested) / invested) * 100 : 0;
  const topHold = hold.slice().sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0];
  const lastVac = life.vacations[0];
  const lastNote = life.notes[life.notes.length - 1];
  const lastFile = life.drive[life.drive.length - 1];
  const stepsLast7 = health.series.steps.slice(-7);

  const Streak = ({ label, streak, done, to }: { label: string; streak: number; done: boolean; to: string }) => (
    <Pressable onPress={() => go(to)} style={{ width: 92, alignItems: 'center', backgroundColor: t.tile, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 6 }}>
      <Flame streak={streak} size={40} />
      <Body small muted style={{ marginTop: 4 }}>{label}</Body>
      {!done && <Body small color={t.danger} style={{ marginTop: 3 }}>a rischio</Body>}
    </Pressable>
  );

  return (
    <Page id="index">
      <View style={{ paddingTop: 22, paddingBottom: 10 }}>
        <Body muted>{dayNames[now.getDay()]}</Body>
        <Text style={{ color: t.text, fontSize: 30, fontWeight: '800', marginVertical: 4, letterSpacing: -0.3 }}>{greet}, {name}</Text>
        <Row>
          <Pressable onPress={() => setScoreSheet(true)}>
            <Text style={{ color: t.text, fontSize: 46, fontWeight: '800' }}>{sc.total ?? '—'}<Text style={{ color: t.muted, fontSize: 16, fontWeight: '400' }}> /100</Text></Text>
            <Body small>Life Score · tocca per il dettaglio</Body>
          </Pressable>
          <Btn title="Parla con AI" onPress={() => go('ai')} />
        </Row>
      </View>

      <Card accent={t.border}>
        <H>I tuoi streak</H>
        <Body small muted style={{ marginBottom: 12 }}>Fai qualcosa ogni giorno per non spegnere la fiamma.</Body>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Streak label="LP donato" streak={lpStreak} done={donatedToday} to="lifepointsPage" />
          <Streak label="10k passi" streak={stepsStreak} done={(steps ?? 0) >= 10000} to="lifehealth" />
          <Streak label="Sonno 7h+" streak={sleepStreak} done={(sleep ?? 0) >= 7} to="lifehealth" />
        </View>
      </Card>

      {!moodToday && (
        <Card>
          <H>Come ti senti oggi?</H>
          <Body small muted style={{ marginBottom: 12 }}>Un tocco e via, niente di obbligatorio.</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {moodOptions.map(([m, c]) => (
              <Pressable key={m} onPress={() => { health.logMood(m); toast('Umore registrato: ' + m); }} style={{ width: '31%', alignItems: 'center', paddingVertical: 13, borderRadius: 14, backgroundColor: t.tile, borderWidth: 1, borderColor: t.navBorder }}>
                <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: c, marginBottom: 7 }} />
                <Body small>{m}</Body>
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      <SectionLabel>Oggi</SectionLabel>
      <Card>
        <Tag>✦ BRIEFING AI</Tag>
        <H>{activeCount === 0 && todayEvents.length === 0 ? 'Giornata libera.' : 'Proteggi il focus.'}</H>
        <Body muted style={{ marginBottom: 10 }}>
          {activeCount} priorità aperte, {lateGoals} obiettivi sotto il 50% e {todayEvents.length} impegni in calendario oggi. Posso riorganizzare il resto della giornata.
        </Body>
        <Btn title="Pianifica la giornata" onPress={() => setPlanSheet(true)} />
      </Card>

      {topGoal && (
        <Card>
          <Row><H>Focus principale</H><Body muted>{topGoal.p}%</Body></Row>
          <Body bold>{topGoal.t}</Body>
          <Progress value={topGoal.p} />
          <Body small muted style={{ marginTop: 8 }}>Prossima azione: {life.tasks.find((x) => !taskIsDone(x))?.t ?? 'definisci un task in Plan'}.</Body>
        </Card>
      )}

      <Card>
        <Row><H>Oggi</H><Btn small ghost title="Apri" onPress={() => go('plan')} /></Row>
        {todayEvents.length === 0 ? <Empty text="Giornata libera: goditela, o pianificaci qualcosa di bello." /> : todayEvents.map((e, i) => <Item key={i} last={i === todayEvents.length - 1}><Body>{e.time} · {e.title}</Body></Item>)}
      </Card>

      <Card onPress={() => go('lifetask')} style={{ padding: 14 }}>
        <Tag>TASK</Tag>
        <Metric>{activeCount}</Metric>
        <Body small muted>{activeCount ? `${activeCount} task da fare · ${doneCount} completati` : life.tasks.length ? 'Tutto fatto, bel lavoro' : 'Nessun task ancora'}</Body>
      </Card>

      {ns.bookings.length > 0 && (
        <Card>
          <H>I tuoi appuntamenti</H>
          {ns.bookings.map((b, i) => (
            <Item key={b.id} last={i === ns.bookings.length - 1}><Row><View style={{ flex: 1 }}><Body bold>{b.provider}</Body><Body small muted>{b.role} · {b.slot}</Body></View><Btn small ghost title="×" onPress={() => { ns.patch({ bookings: ns.bookings.filter((x) => x.id !== b.id) }); toast('Appuntamento rimosso'); }} /></Row></Item>
          ))}
        </Card>
      )}

      <SectionLabel>Salute e abitudini</SectionLabel>
      <Card onPress={() => go('lifehealth')}>
        <Tag>SALUTE</Tag>
        <Metric>{sc.health ?? '—'}</Metric>
        {stepsLast7.length > 1 && <View style={{ marginVertical: 6 }}><Bars data={stepsLast7} color={t.border} hi={t.text} height={34} /></View>}
        <Body small muted>{sleep != null ? `Sonno ${Math.floor(sleep)}h ${Math.round((sleep % 1) * 60)}m` : 'Registra i tuoi dati in LifeHealth'}</Body>
      </Card>

      <SectionLabel>Vita sociale e finanze</SectionLabel>
      <Row style={{ alignItems: 'stretch' }} gap={10}>
        <Card style={{ flex: 1 }} onPress={() => go('portfolio')}>
          <Tag>PORTAFOGLIO</Tag>
          <Metric color={hold.length ? (plPct >= 0 ? t.positive : t.danger) : t.text}>{hold.length ? `${plPct >= 0 ? '+' : ''}${plPct.toFixed(1)}%` : '—'}</Metric>
          {topHold && <Spark data={topHold.history.slice(-16)} w={120} h={34} pad={3} color={plPct >= 0 ? t.positive : t.danger} />}
          <Body small muted>{topHold ? `${topHold.symbol} ${topHold.changePct >= 0 ? '+' : ''}${topHold.changePct.toFixed(2)}% oggi` : 'Nessuna posizione aperta'}</Body>
        </Card>
        <Card style={{ flex: 1 }} onPress={() => go('lifefinance')}>
          <Tag>FINANZE</Tag>
          <Metric>{net >= 0 ? '+' : ''}{formatCHF(net)}</Metric>
          {endsChrono.length > 1 && <Spark data={endsChrono} w={120} h={34} color={net >= 0 ? t.positive : t.danger} />}
          <Body small muted>Saldo {formatCHF(cur ? monthEnd(cur) : 0)} CHF{topCat ? ` · più speso: ${topCat.n}` : ''}</Body>
        </Card>
      </Row>

      <Card accent="#c9b6ff" onPress={() => go('lifenetwork')} style={{ padding: 20 }}>
        <Tag>✦ LIFENETWORK</Tag>
        <Row>
          <View style={{ flex: 1 }}><Body bold style={{ fontSize: 16 }}>{topIdea ? topIdea.title : 'Nessuna idea ancora'}</Body><Body small muted>{topIdea ? "idea più vicina all'obiettivo" : 'Pubblica la tua prima idea'}</Body></View>
          <Text style={{ color: '#c9b6ff', fontSize: 24, fontWeight: '700' }}>{topIdea ? `${topPct}%` : '—'}</Text>
        </Row>
        {topIdea && <Progress value={Math.min(100, topPct)} color="#c9b6ff" />}
        <Row style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: t.item, paddingTop: 10 }} gap={0}>
          <View style={{ flex: 1, alignItems: 'center' }}><Body bold>{followerCountFor(name, name, demo)}</Body><Body small muted>Follower</Body></View>
          <View style={{ flex: 1, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: t.item }}><Row gap={2}><Body bold>{formatCHF(ns.lifePoints)}</Body><LpTag size={13} /></Row><Body small muted>Saldo</Body></View>
          <View style={{ flex: 1, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: t.item }}><Body bold>{donatedToday ? '✓ donato' : 'da donare'}</Body><Body small muted>LP oggi</Body></View>
        </Row>
        <Body small muted style={{ marginTop: 12, marginBottom: 6, borderTopWidth: 1, borderTopColor: t.item, paddingTop: 10 }}>Per te</Body>
        {topPosts.length === 0 ? <Body small muted>Nessun post ancora da mostrarti.</Body> : topPosts.map((p, i) => (
          <Pressable key={i} onPress={() => go('userProfile', { name: p.author })} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
            <UserAvatar name={p.author} size={26} />
            <Body small numberOfLines={1} style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>{p.author}</Text> {p.text}</Body>
            <Body small muted>♥ {p.likes}</Body>
          </Pressable>
        ))}
      </Card>

      <SectionLabel>Altri strumenti</SectionLabel>
      <Row style={{ alignItems: 'stretch' }} gap={10}>
        <Card style={{ flex: 1 }} onPress={() => go('lifetravel')}>
          <Tag>TRAVEL</Tag>
          <Metric>{lastVac ? lastVac.dest : '—'}</Metric>
          <Body small muted>{lastVac ? `${lastVac.month} · ${lastVac.days} giorni` : 'Nessuna vacanza pianificata'}</Body>
        </Card>
        <Card style={{ flex: 1 }} onPress={() => go('lifenotes')}>
          <Tag>NOTES</Tag>
          <Body bold numberOfLines={2}>{lastNote ? noteTitle(lastNote.text) : '—'}</Body>
          <Body small muted>{lastNote ? `${lastNote.date} · ${life.notes.length} note salvate` : 'Nessuna nota ancora'}</Body>
        </Card>
      </Row>
      <Card onPress={() => go('lifedrive')}>
        <Tag>DRIVE</Tag>
        <Metric>{life.drive.length}</Metric>
        <Body small muted numberOfLines={1}>{lastFile ? `ultimo: ${lastFile.n}` : 'Nessun file salvato'}</Body>
      </Card>
      <Card onPress={() => setInsight(true)}>
        <Tag>✦ INSIGHT LAB</Tag>
        <H>LifePilot ha notato</H>
        <Body muted>Nei giorni in cui inizi il lavoro importante prima delle 11:00 completi più attività prioritarie.</Body>
      </Card>

      <LifeScoreSheet visible={scoreSheet} onClose={() => setScoreSheet(false)} />
      <PlanDaySheet visible={planSheet} onClose={() => setPlanSheet(false)} />
      <Sheet visible={insight} title="Insight Lab" onClose={() => setInsight(false)}>
        <Body muted>Nei giorni in cui inizi il lavoro importante prima delle 11:00 completi più attività prioritarie.</Body>
        <Item><Row><Body>Correlazione</Body><Body bold>Alta</Body></Row></Item>
        <Item last><Row><Body>Basata su</Body><Body bold>14 giorni di dati</Body></Row></Item>
        <Body small muted style={{ marginTop: 10 }}>Esempio dimostrativo: gli insight reali richiedono abbastanza dati nel tempo.</Body>
      </Sheet>
    </Page>
  );
}
void Icon; void notePreview;
